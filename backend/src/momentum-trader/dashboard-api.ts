/**
 * Paper Trading Dashboard API
 * HTTP handlers for paper trading endpoints
 * All functions are user-scoped via userId parameter.
 */

import {
  ScanCommand,
  QueryCommand,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../utils/db.js';
import {
  getPortfolioState as getCorePortfolioState,
  getOpenTrades,
} from './paper-trading.js';
import { checkBrokerConfigured, getBrokerSetupGuidance } from '../utils/broker-check.js';
import { getUserProfile, checkPlanAccess } from '../auth/auth.js';

// DynamoDB Table Names (from environment or default to stage)
const STAGE = process.env.STAGE || 'prod';
const MOMENTUM_TRADES_TABLE = process.env.MOMENTUM_TRADES_TABLE || `momentum-trades-${STAGE}`;
const MOMENTUM_PORTFOLIO_TABLE = process.env.MOMENTUM_PORTFOLIO_TABLE || `momentum-portfolio-${STAGE}`;
const MOMENTUM_SIGNALS_TABLE = process.env.MOMENTUM_SIGNALS_TABLE || `momentum-signals-${STAGE}`;
const MOMENTUM_CONFIG_TABLE = process.env.MOMENTUM_CONFIG_TABLE || `momentum-config-${STAGE}`;

const DEFAULT_USER_ID = 'GLOBAL';

// ─────────────────────────────────────────────────────────────────────────────
// Paper Mode Configuration
// ─────────────────────────────────────────────────────────────────────────────

export async function getPaperMode(userId?: string): Promise<{
  mode: 'paper' | 'live';
  enabled: boolean;
  requireSigmaApproval: boolean;
  autoTradingEnabled: boolean;
  minTradesForLive: number;
  currentTradeCount: number;
}> {
  const user = userId || DEFAULT_USER_ID;
  try {
    const result = await docClient.send(new GetCommand({
      TableName: MOMENTUM_CONFIG_TABLE,
      Key: {
        pk: `USER#${user}#CONFIG#PAPER_MODE`,
        sk: 'CURRENT',
      },
    }));

    if (result.Item) {
      return {
        mode: result.Item.mode || 'paper',
        enabled: result.Item.enabled ?? true,
        requireSigmaApproval: result.Item.requireSigmaApproval ?? true,
        autoTradingEnabled: result.Item.autoTradingEnabled ?? false,
        minTradesForLive: result.Item.minTradesForLive || 100,
        currentTradeCount: result.Item.currentTradeCount || 0,
      };
    }
  } catch {
    // Return defaults
  }

  // Initialize with defaults
  const defaultConfig = {
    pk: `USER#${user}#CONFIG#PAPER_MODE`,
    sk: 'CURRENT',
    mode: 'paper',
    enabled: true,
    requireSigmaApproval: true,
    autoTradingEnabled: false,
    minTradesForLive: 100,
    currentTradeCount: 0,
    createdAt: Date.now(),
  };

  await docClient.send(new PutCommand({
    TableName: MOMENTUM_CONFIG_TABLE,
    Item: defaultConfig,
  }));

  return {
    mode: 'paper',
    enabled: true,
    requireSigmaApproval: true,
    autoTradingEnabled: false,
    minTradesForLive: 100,
    currentTradeCount: 0,
  };
}

export async function setPaperMode(config: {
  mode?: 'paper' | 'live';
  enabled?: boolean;
  requireSigmaApproval?: boolean;
  autoTradingEnabled?: boolean;
}, userId?: string): Promise<void> {
  const user = userId || DEFAULT_USER_ID;
  const current = await getPaperMode(user);

  const newConfig = {
    pk: `USER#${user}#CONFIG#PAPER_MODE`,
    sk: 'CURRENT',
    mode: config.mode || current.mode,
    enabled: config.enabled ?? current.enabled,
    requireSigmaApproval: config.requireSigmaApproval ?? current.requireSigmaApproval,
    autoTradingEnabled: config.autoTradingEnabled ?? current.autoTradingEnabled,
    minTradesForLive: current.minTradesForLive,
    currentTradeCount: current.currentTradeCount,
    updatedAt: Date.now(),
  };

  await docClient.send(new PutCommand({
    TableName: MOMENTUM_CONFIG_TABLE,
    Item: newConfig,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function getPaperPortfolio(userId?: string, mode?: 'paper' | 'live'): Promise<{
  capital: number;
  startingCapital: number;
  availableCapital: number;
  marginUsed: number;
  totalPnl: number;
  unrealizedPnl: number;
  dayPnl: number;
  openPositions: number;
  closedTrades: number;
  winRate: number;
  maxDrawdown: number;
  peakCapital: number;
}> {
  if (mode === 'live') {
    // Live mode: compute portfolio from live trades — no simulated starting capital
    const allLiveTrades = await getPaperTrades(1000, undefined, userId, 'live');
    const openTrades = allLiveTrades.filter((t: any) => t.status === 'open');
    const closedTrades = allLiveTrades.filter((t: any) => t.status === 'closed');

    const totalPnl = closedTrades.reduce((sum, t: any) => sum + (t.netPnL || 0), 0);
    const unrealizedPnl = openTrades.reduce((sum, t: any) => sum + (t.netPnL || 0), 0);
    const marginUsed = openTrades.reduce((sum, t: any) => sum + (t.marginUsed || 0), 0);
    const winningTrades = closedTrades.filter((t: any) => (t.netPnL || 0) > 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

    return {
      capital: 0,
      startingCapital: 0,
      availableCapital: 0,
      marginUsed,
      totalPnl,
      unrealizedPnl,
      dayPnl: 0,
      openPositions: openTrades.length,
      closedTrades: closedTrades.length,
      winRate: Math.round(winRate * 10) / 10,
      maxDrawdown: 0,
      peakCapital: 0,
    };
  }

  // Paper mode: delegate to the core paper-trading function
  const portfolio = await getCorePortfolioState(userId);
  return {
    capital: portfolio.capital ?? 1000000,
    startingCapital: portfolio.startingCapital ?? 1000000,
    availableCapital: portfolio.availableCapital ?? 1000000,
    marginUsed: portfolio.marginUsed ?? 0,
    totalPnl: portfolio.totalPnl ?? 0,
    unrealizedPnl: portfolio.unrealizedPnl ?? 0,
    dayPnl: portfolio.dayPnl ?? 0,
    openPositions: portfolio.openPositions ?? 0,
    closedTrades: portfolio.closedTrades ?? 0,
    winRate: portfolio.winRate ?? 0,
    maxDrawdown: portfolio.maxDrawdown ?? 0,
    peakCapital: portfolio.peakCapital ?? 1000000,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trades Operations
// ─────────────────────────────────────────────────────────────────────────────

export async function getPaperTrades(
  limit: number = 100,
  status?: 'open' | 'closed',
  userId?: string,
  mode?: 'paper' | 'live',
): Promise<Array<Record<string, unknown>>> {
  const user = userId || DEFAULT_USER_ID;
  try {
    // Build filter expression dynamically
    const filterParts: string[] = ['#userId = :userId'];
    const expressionNames: Record<string, string> = { '#userId': 'userId' };
    const expressionValues: Record<string, any> = { ':userId': user };

    if (status) {
      filterParts.push('#status = :status');
      expressionNames['#status'] = 'status';
      expressionValues[':status'] = status;
    }

    // Mode filtering: live = only mode='live'; paper = mode='paper' or no mode field (legacy)
    if (mode === 'live') {
      filterParts.push('#tradeMode = :tradeMode');
      expressionNames['#tradeMode'] = 'mode';
      expressionValues[':tradeMode'] = 'live';
    } else if (mode === 'paper') {
      filterParts.push('(attribute_not_exists(#tradeMode) OR #tradeMode = :tradeMode)');
      expressionNames['#tradeMode'] = 'mode';
      expressionValues[':tradeMode'] = 'paper';
    }

    const result = await docClient.send(new ScanCommand({
      TableName: MOMENTUM_TRADES_TABLE,
      FilterExpression: filterParts.join(' AND '),
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      Limit: limit,
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Failed to fetch paper trades:', error);
    return [];
  }
}

export async function getPaperTradeById(tradeId: string, userId?: string): Promise<Record<string, unknown> | null> {
  const user = userId || DEFAULT_USER_ID;
  try {
    const result = await docClient.send(new GetCommand({
      TableName: MOMENTUM_TRADES_TABLE,
      Key: {
        pk: `USER#${user}#TRADE#${tradeId}`,
        sk: `STATUS#open`,
      },
    }));

    if (result.Item) return result.Item;

    // Try closed status
    const closedResult = await docClient.send(new QueryCommand({
      TableName: MOMENTUM_TRADES_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${user}#TRADE#${tradeId}`,
      },
    }));

    return closedResult.Items?.[0] || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Performance Metrics
// ─────────────────────────────────────────────────────────────────────────────

export async function getPaperMetrics(userId?: string, mode?: 'paper' | 'live'): Promise<{
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  netPnL: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownAmount: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  expectancy: number;
  totalReturn: number;
  annualizedReturn: number;
  avgTradeDuration: number;
  bestPerformingSymbol: string;
  worstPerformingSymbol: string;
  eligibleForLive: boolean;
  tradesRemaining: number;
  recommendations: string[];
}> {
  const user = userId || DEFAULT_USER_ID;
  const trades = await getPaperTrades(1000, 'closed', user, mode);
  const portfolio = await getPaperPortfolio(user, mode);

  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      netPnL: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      maxDrawdown: portfolio.maxDrawdown,
      maxDrawdownAmount: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      expectancy: 0,
      totalReturn: 0,
      annualizedReturn: 0,
      avgTradeDuration: 0,
      bestPerformingSymbol: '',
      worstPerformingSymbol: '',
      eligibleForLive: false,
      tradesRemaining: 100,
      recommendations: ['Complete at least 100 paper trades before going live'],
    };
  }

  const wins = trades.filter((t: any) => (t.netPnL || 0) > 0);
  const losses = trades.filter((t: any) => (t.netPnL || 0) < 0);

  const grossProfit = wins.reduce((sum, t) => sum + (t.netPnL || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.netPnL || 0), 0));
  const netPnL = grossProfit - grossLoss;

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

  const largestWin = wins.length > 0 ? Math.max(...wins.map((t: any) => t.netPnL || 0)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map((t: any) => t.netPnL || 0)) : 0;

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  // Calculate expectancy: (Win% × Avg Win) - (Loss% × Avg Loss)
  const lossRate = 100 - winRate;
  const expectancy = ((winRate / 100) * avgWin) - ((lossRate / 100) * avgLoss);

  // Total return percentage
  const totalReturn = ((portfolio.capital - portfolio.startingCapital) / portfolio.startingCapital) * 100;

  // Sharpe ratio approximation (simplified)
  const returns = trades.map((t: any) => (t.netPnL || 0) / 10000); // Assuming 10k risk per trade
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

  // Sortino ratio (uses only downside deviation)
  const negReturns = returns.filter(r => r < 0);
  const downsideVariance = negReturns.length > 0
    ? negReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negReturns.length
    : 0;
  const downsideDev = Math.sqrt(downsideVariance);
  const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0;

  // Calmar ratio (annualized return / max drawdown)
  const calmarRatio = portfolio.maxDrawdown > 0 ? (totalReturn / portfolio.maxDrawdown) : 0;

  // Annualized return (simplified — based on trading days elapsed)
  const firstTradeTime = Math.min(...trades.map((t: any) => t.entryTime || t.createdAt || Date.now()));
  const daysSinceFirst = Math.max(1, (Date.now() - firstTradeTime) / (1000 * 60 * 60 * 24));
  const annualizedReturn = daysSinceFirst > 0 ? (totalReturn / daysSinceFirst) * 252 : 0;

  // Average trade duration in minutes
  const durations = trades
    .filter((t: any) => t.exitTime && t.entryTime)
    .map((t: any) => (t.exitTime - t.entryTime) / (1000 * 60));
  const avgTradeDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Best & worst performing symbols
  const symbolPnL: Record<string, number> = {};
  for (const t of trades) {
    const sym = (t as any).symbol || 'UNKNOWN';
    symbolPnL[sym] = (symbolPnL[sym] || 0) + ((t as any).netPnL || 0);
  }
  const sortedSymbols = Object.entries(symbolPnL).sort(([, a], [, b]) => b - a);
  const bestPerformingSymbol = sortedSymbols.length > 0 ? sortedSymbols[0][0] : '';
  const worstPerformingSymbol = sortedSymbols.length > 0 ? sortedSymbols[sortedSymbols.length - 1][0] : '';

  // Eligibility for live trading
  const minTrades = 100;
  const eligible = trades.length >= minTrades && winRate >= 45 && profitFactor >= 1.2 && portfolio.maxDrawdown < 10;

  // Recommendations
  const recommendations: string[] = [];
  if (trades.length < minTrades) recommendations.push(`Complete ${minTrades - trades.length} more trades to qualify for live`);
  if (winRate >= 50) recommendations.push(`Win rate ${Math.round(winRate)}% — solid consistency`);
  else if (winRate >= 40) recommendations.push(`Win rate ${Math.round(winRate)}% — aim for 50%+ before going live`);
  else recommendations.push(`Win rate ${Math.round(winRate)}% — needs improvement, review losing trades`);
  if (profitFactor >= 1.5) recommendations.push(`Profit factor ${profitFactor.toFixed(2)} — strong edge`);
  else if (profitFactor >= 1.0) recommendations.push(`Profit factor ${profitFactor.toFixed(2)} — breakeven, tighten stops`);
  if (portfolio.maxDrawdown > 5) recommendations.push(`Max drawdown ${portfolio.maxDrawdown.toFixed(1)}% — consider smaller position sizes`);
  if (sharpeRatio > 1) recommendations.push(`Sharpe ${sharpeRatio.toFixed(2)} — good risk-adjusted returns`);

  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRate: Math.round(winRate * 100) / 100,
    grossProfit: Math.round(grossProfit),
    grossLoss: Math.round(grossLoss),
    netPnL: Math.round(netPnL),
    avgWin: Math.round(avgWin),
    avgLoss: Math.round(avgLoss),
    largestWin: Math.round(largestWin),
    largestLoss: Math.round(largestLoss),
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdown: Math.round(portfolio.maxDrawdown * 100) / 100,
    maxDrawdownAmount: Math.round(portfolio.startingCapital * (portfolio.maxDrawdown / 100)),
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    expectancy: Math.round(expectancy),
    totalReturn: Math.round(totalReturn * 100) / 100,
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    avgTradeDuration,
    bestPerformingSymbol,
    worstPerformingSymbol,
    eligibleForLive: eligible,
    tradesRemaining: Math.max(0, minTrades - trades.length),
    recommendations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Equity Curve
// ─────────────────────────────────────────────────────────────────────────────

export async function getEquityCurve(days: number = 30, userId?: string, mode?: 'paper' | 'live'): Promise<Array<{
  timestamp: number;
  capital: number;
  pnl: number;
  drawdown: number;
  openPositions: number;
}>> {
  const user = userId || DEFAULT_USER_ID;

  if (mode === 'live') {
    // Live mode: compute equity curve from live trades
    const liveTrades = await getPaperTrades(1000, 'closed', user, 'live');
    const openLiveTrades = await getPaperTrades(100, 'open', user, 'live');

    if (liveTrades.length === 0) {
      return [{
        timestamp: Date.now(),
        capital: 1000000,
        pnl: 0,
        drawdown: 0,
        openPositions: openLiveTrades.length,
      }];
    }

    // Sort by exit time and compute cumulative P&L
    const sorted = [...liveTrades].sort((a: any, b: any) => (a.exitTime || 0) - (b.exitTime || 0));
    const startingCapital = 1000000;
    let cumPnl = 0;
    let peakCapital = startingCapital;

    return sorted.map((t: any) => {
      cumPnl += (t.netPnL || 0);
      const capital = startingCapital + cumPnl;
      peakCapital = Math.max(peakCapital, capital);
      const drawdown = peakCapital > 0 ? ((peakCapital - capital) / peakCapital) * 100 : 0;
      return {
        timestamp: t.exitTime || t.updatedAt || Date.now(),
        capital,
        pnl: cumPnl,
        drawdown,
        openPositions: openLiveTrades.length,
      };
    });
  }

  try {
    // Paper mode: query portfolio history (user-scoped)
    const result = await docClient.send(new QueryCommand({
      TableName: MOMENTUM_PORTFOLIO_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${user}#PORTFOLIO#MAIN`,
      },
      Limit: days * 10, // Approximate
      ScanIndexForward: true,
    }));

    const items = result.Items || [];

    // Get open positions count
    const userOpenTrades = await getOpenTrades(user);
    const openPositions = userOpenTrades.length;

    return items.map((item: any) => ({
      timestamp: item.lastUpdated || Date.now(),
      capital: item.capital || 1000000,
      pnl: item.totalPnl || 0,
      drawdown: item.maxDrawdown || 0,
      openPositions,
    }));
  } catch {
    // Return single point (current)
    const portfolio = await getPaperPortfolio(user);
    const userOpenTrades = await getOpenTrades(user);

    return [{
      timestamp: Date.now(),
      capital: portfolio.capital,
      pnl: portfolio.totalPnl,
      drawdown: portfolio.maxDrawdown,
      openPositions: userOpenTrades.length,
    }];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sigma Approvals
// ─────────────────────────────────────────────────────────────────────────────

export async function getPendingApprovals(): Promise<Array<{
  tradeId: string;
  symbol: string;
  signal: 'BUY' | 'SELL';
  entryPrice: number;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  indicators?: Record<string, unknown>;
}>> {
  // This would query a separate approval table
  // For now, return empty
  return [];
}

export async function processApproval(
  tradeId: string,
  action: 'approve' | 'reject',
  sigmaAgent: string = 'sigma'
): Promise<{ success: boolean; message: string }> {
  // Update approval status
  // This would integrate with the paper trading execution
  return {
    success: true,
    message: `Trade ${tradeId} ${action}d by ${sigmaAgent}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePaperModeRequest(method: string, body?: any, userId?: string): Promise<{
  statusCode: number;
  body: Record<string, unknown>;
}> {
  const user = userId || DEFAULT_USER_ID;

  if (method === 'GET') {
    const mode = await getPaperMode(user);
    return { statusCode: 200, body: mode };
  }

  if (method === 'POST' && body) {
    // Handle reset_portfolio action
    if (body.action === 'reset_portfolio') {
      const startingCapital = 1000000; // ₹10,00,000
      const resetPortfolio = {
        pk: `USER#${user}#PORTFOLIO#MAIN`,
        sk: `TIMESTAMP#${Date.now()}`,
        capital: startingCapital,
        startingCapital: startingCapital,
        availableCapital: startingCapital,
        marginUsed: 0,
        totalPnl: 0,
        unrealizedPnl: 0,
        dayPnl: 0,
        openPositions: 0,
        closedTrades: 0,
        winRate: 0,
        maxDrawdown: 0,
        peakCapital: startingCapital,
        sectorExposure: {},
        symbolExposure: {},
        dailyLossLimit: startingCapital * 0.05,
        dailyLossUsed: 0,
        maxRiskPerTrade: startingCapital * 0.02,
        currentRisk: 0,
        lastUpdated: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 86400 * 30,
      };
      await docClient.send(new PutCommand({
        TableName: MOMENTUM_PORTFOLIO_TABLE,
        Item: resetPortfolio,
      }));
      return { statusCode: 200, body: { message: 'Portfolio reset successfully', portfolio: resetPortfolio } };
    }

    // Handle sync_portfolio action - recalculate from actual trades
    if (body.action === 'sync_portfolio') {
      const trades = await getPaperTrades(1000, undefined, user);
      const openTradesList = trades.filter((t: any) => t.status === 'open');
      const closedTradesList = trades.filter((t: any) => t.status === 'closed');

      // Calculate from open trades
      const marginUsed = openTradesList.reduce((sum: number, t: any) => sum + (t.marginUsed || 0), 0);
      const hedgeCost = openTradesList.reduce((sum: number, t: any) => sum + (t.hedgeCost || 0), 0);
      const totalPnL = closedTradesList.reduce((sum: number, t: any) => sum + (t.netPnL || 0), 0);
      const unrealizedPnL = openTradesList.reduce((sum: number, t: any) => sum + (t.netPnL || 0), 0);
      const winningTrades = closedTradesList.filter((t: any) => (t.netPnL || 0) > 0);
      const winRate = closedTradesList.length > 0 ? (winningTrades.length / closedTradesList.length) * 100 : 0;

      const startingCapital = 1000000;
      const capitalUsed = marginUsed + hedgeCost;
      const availableCapital = startingCapital - capitalUsed + totalPnL;
      const currentCapital = startingCapital + totalPnL;

      const syncedPortfolio = {
        pk: `USER#${user}#PORTFOLIO#MAIN`,
        sk: `TIMESTAMP#${Date.now()}`,
        capital: currentCapital,
        startingCapital: startingCapital,
        availableCapital: Math.max(0, availableCapital),
        marginUsed: marginUsed,
        totalPnl: totalPnL,
        unrealizedPnl: unrealizedPnL,
        dayPnl: 0,
        openPositions: openTradesList.length,
        closedTrades: closedTradesList.length,
        winRate: Math.round(winRate * 10) / 10,
        maxDrawdown: 0,
        peakCapital: Math.max(startingCapital, currentCapital),
        sectorExposure: {},
        symbolExposure: {},
        dailyLossLimit: startingCapital * 0.05,
        dailyLossUsed: 0,
        maxRiskPerTrade: startingCapital * 0.02,
        currentRisk: hedgeCost,
        lastUpdated: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 86400 * 30,
      };
      await docClient.send(new PutCommand({
        TableName: MOMENTUM_PORTFOLIO_TABLE,
        Item: syncedPortfolio,
      }));
      return { statusCode: 200, body: { message: 'Portfolio synced from trades', portfolio: syncedPortfolio, openTrades: openTradesList.length, closedTrades: closedTradesList.length } };
    }

    // Gate live mode on plan access + broker credentials
    if (body.mode === 'live' && user !== DEFAULT_USER_ID) {
      const profile = await getUserProfile(user);
      if (profile) {
        const access = checkPlanAccess(profile, 'live_trading');
        if (!access.allowed) {
          return {
            statusCode: 403,
            body: { error: access.reason || 'Plan upgrade required', needsPlanUpgrade: true },
          };
        }
      }

      const brokerCheck = await checkBrokerConfigured(user);
      if (!brokerCheck.hasBroker) {
        return {
          statusCode: 400,
          body: {
            error: 'No broker configured',
            needsBrokerSetup: true,
            guidance: getBrokerSetupGuidance(),
          },
        };
      }
    }

    await setPaperMode({
      mode: body.mode,
      enabled: body.enabled,
      requireSigmaApproval: body.requireSigmaApproval,
      autoTradingEnabled: body.autoTradingEnabled,
    }, user);
    return { statusCode: 200, body: { message: 'Mode updated', mode: body.mode, autoTradingEnabled: body.autoTradingEnabled } };
  }

  return { statusCode: 405, body: { error: 'Method not allowed' } };
}

export async function handlePaperPortfolioRequest(
  queryParams?: Record<string, string>,
  userId?: string,
): Promise<{
  statusCode: number;
  body: Record<string, unknown>;
}> {
  const mode = queryParams?.mode as 'paper' | 'live' | undefined;
  const portfolio = await getPaperPortfolio(userId, mode);
  return { statusCode: 200, body: { portfolio } };
}

export async function handlePaperTradesRequest(
  queryParams?: Record<string, string>,
  userId?: string,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const limit = parseInt(queryParams?.limit || '100');
  const status = queryParams?.status as 'open' | 'closed' | undefined;
  const mode = queryParams?.mode as 'paper' | 'live' | undefined;

  const trades = await getPaperTrades(limit, status, userId, mode);
  return { statusCode: 200, body: { trades, count: trades.length } };
}

export async function handlePaperMetricsRequest(
  queryParams?: Record<string, string>,
  userId?: string,
): Promise<{
  statusCode: number;
  body: Record<string, unknown>;
}> {
  const mode = queryParams?.mode as 'paper' | 'live' | undefined;
  const metrics = await getPaperMetrics(userId, mode);
  return { statusCode: 200, body: { metrics } };
}

export async function handleEquityCurveRequest(
  queryParams?: Record<string, string>,
  userId?: string,
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const days = parseInt(queryParams?.days || '30');
  const mode = queryParams?.mode as 'paper' | 'live' | undefined;
  const curve = await getEquityCurve(days, userId, mode);
  return { statusCode: 200, body: { equityCurve: curve, days } };
}

export async function handleSigmaApprovalsRequest(
  method: string,
  body?: any
): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  if (method === 'GET') {
    const pending = await getPendingApprovals();
    return { statusCode: 200, body: { pending, count: pending.length } };
  }

  if (method === 'POST' && body) {
    const result = await processApproval(body.tradeId, body.action, body.sigmaAgent);
    return { statusCode: result.success ? 200 : 400, body: result };
  }

  return { statusCode: 405, body: { error: 'Method not allowed' } };
}
