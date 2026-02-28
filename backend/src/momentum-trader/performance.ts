/**
 * Performance Tracking Module for Momentum Trading
 * Calculates metrics: Win Rate, Sharpe Ratio, Max Drawdown, Profit Factor
 * Generates equity curve and trade journal
 */

import {
  ScanCommand,
  QueryCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../utils/db.js';
import { PaperTrade, getAllTrades, getPortfolioState, getOpenTrades } from './paper-trading.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types and Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface PerformanceMetrics {
  // Basic Stats
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // percentage
  
  // P&L Stats
  grossProfit: number;
  grossLoss: number;
  netPnL: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  expectancy: number; // average P&L per trade
  expectancyPercent: number;
  
  // Risk Metrics
  maxDrawdown: number; // percentage
  maxDrawdownAmount: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  avgRiskPerTrade: number;
  riskRewardRatio: number;
  
  // Return Metrics
  totalReturn: number; // percentage
  annualizedReturn: number; // percentage
  volatility: number; // standard deviation of returns
  sharpeRatio: number;
  sortinoRatio: number; // downside deviation only
  calmarRatio: number; // return vs max drawdown
  
  // Trade Quality
  avgTradeDuration: number; // minutes
  avgTimeInWinners: number;
  avgTimeInLosers: number;
  timeEfficiency: number; // P&L per hour
  
  // Strategy Insights
  bestPerformingSymbol: string;
  worstPerformingSymbol: string;
  bestTimeOfDay: string;
  signalAccuracy: number; // how often indicators were correct
  
  // Progress to Live Trading
  tradesRemaining: number;
  eligibleForLive: boolean;
  recommendations: string[];
}

export interface EquityPoint {
  timestamp: number;
  capital: number;
  pnl: number;
  drawdown: number;
  openPositions: number;
}

export interface TradeJournalEntry {
  id: string;
  entryTime: number;
  exitTime?: number;
  symbol: string;
  signal: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  netPnL: number;
  exitReason?: string;
  duration?: number;
  summary: string; // AI-generated or template-based summary
  lessons?: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface DailyPerformance {
  date: string;
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  cumulativePnl: number;
  drawdown: number;
  winRate: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MOMENTUM_TRADES_TABLE = 'momentum-trades-prod';
const MOMENTUM_PERFORMANCE_TABLE = 'momentum-performance-prod';
const MOMENTUM_METRICS_TABLE = 'momentum-metrics-prod';

const MIN_TRADES_FOR_LIVE = 100;
const MIN_WIN_RATE_FOR_LIVE = 45;
const MAX_DRAWDOWN_FOR_LIVE = 15; // 15%
const MIN_SHARPE_FOR_LIVE = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate Sharpe Ratio
 * (return - risk_free_rate) / volatility
 */
function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.06): number {
  if (returns.length < 2) return 0;
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const volatility = calculateStdDev(returns);
  if (volatility === 0) return 0;
  return (avgReturn - riskFreeRate / 252) / volatility; // Daily returns, annualize rf
}

/**
 * Calculate Sortino Ratio (downside deviation only)
 */
function calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.06): number {
  if (returns.length < 2) return 0;
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downsideReturns = returns.filter(r => r < 0);
  if (downsideReturns.length < 2) return avgReturn > 0 ? 999 : 0;
  const downsideDeviation = calculateStdDev(downsideReturns);
  if (downsideDeviation === 0) return 0;
  return (avgReturn - riskFreeRate / 252) / downsideDeviation;
}

/**
 * Calculate Calmar Ratio (return / max drawdown)
 */
function calculateCalmarRatio(annualReturn: number, maxDrawdown: number): number {
  if (maxDrawdown === 0) return 0;
  return annualReturn / maxDrawdown;
}

/**
 * Grade a trade based on execution quality
 */
function gradeTrade(trade: PaperTrade): TradeJournalEntry['grade'] {
  if (!trade.exitTime) return 'D';

  const netPnL = trade.netPnL || 0;
  const riskTaken = trade.initialRisk || 10000;
  const rReturn = netPnL / riskTaken;

  if (rReturn >= 2) return 'A';
  if (rReturn >= 1) return 'B';
  if (rReturn >= 0) return 'C';
  if (rReturn >= -0.5) return 'D';
  return 'F';
}

/**
 * Generate trade summary
 */
function generateTradeSummary(trade: PaperTrade): string {
  const direction = trade.signal === 'BUY' ? 'Long' : 'Short';
  const result = (trade.netPnL || 0) > 0 ? 'Win' : 'Loss';
  const pnl = trade.netPnL || 0;

  let summary = `${direction} ${trade.symbol} @ ₹${trade.entryPrice} → `;

  if (trade.exitPrice) {
    summary += `₹${trade.exitPrice} = ${result} of ₹${Math.abs(pnl).toFixed(0)}`;
  } else {
    summary += '(Open Position)';
  }

  if (trade.exitReason) {
    const reasonMap: Record<string, string> = {
      'target': 'Target hit',
      'stoploss': 'Stop loss triggered',
      'momentum_exhaustion': 'Momentum faded',
      'reversal': 'Reversal detected',
      'manual': 'Manual exit',
      'expiry': 'Time-based exit',
    };
    summary += ` (${reasonMap[trade.exitReason] || trade.exitReason})`;
  }

  return summary;
}

/**
 * Generate lessons from trade
 */
function generateTradeLessons(trade: PaperTrade): string {
  const lessons: string[] = [];
  const netPnL = trade.netPnL || 0;

  if (netPnL > 0) {
    if (trade.duration && trade.duration < 30) {
      lessons.push('Quick profit - good timing on entry');
    }
    if (trade.indicators.volumeConfirmation) {
      lessons.push('Volume confirmation worked well');
    }
  } else {
    if (trade.indicators.falseBreakoutRisk === 'high') {
      lessons.push('High false breakout risk was present - respect filter more');
    }
    if (!trade.indicators.volumeConfirmation) {
      lessons.push('Lack of volume confirmation - consider skip');
    }
    if (trade.indicators.rsiSignal === 'divergence') {
      lessons.push('RSI divergence present - early warning');
    }
  }

  switch (trade.exitReason) {
    case 'stoploss':
      lessons.push('Stop loss worked as intended - protected capital');
      break;
    case 'target':
      lessons.push('Target reached - good risk management');
      break;
    case 'momentum_exhaustion':
      lessons.push('Early exit on momentum fade - preserved profits');
      break;
    case 'expiry':
      lessons.push('Time-based exit - consider adjusting holding period');
      break;
  }

  return lessons.join('. ') || 'Standard trade execution';
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Calculation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate comprehensive performance metrics
 */
export async function calculatePerformanceMetrics(): Promise<PerformanceMetrics> {
  // Get all closed trades
  const { trades } = await getAllTrades(1000);
  const closedTrades = trades.filter(t => t.status === 'closed');
  const portfolio = await getPortfolioState();

  if (closedTrades.length === 0) {
    return getEmptyMetrics();
  }

  const winningTrades = closedTrades.filter(t => (t.netPnL || 0) > 0);
  const losingTrades = closedTrades.filter(t => (t.netPnL || 0) <= 0);

  const grossProfit = winningTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0));
  const netPnL = grossProfit - grossLoss;

  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
  const winRate = (winningTrades.length / closedTrades.length) * 100;

  // Profit factor
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  // Expectancy
  const winRateDecimal = winRate / 100;
  const lossRateDecimal = 1 - winRateDecimal;
  const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);
  const expectancyPercent = portfolio.startingCapital > 0 ? (expectancy / portfolio.startingCapital) * 100 : 0;

  // Return calculations
  const startingCapital = portfolio.startingCapital;
  const currentCapital = portfolio.capital;
  const totalReturn = ((currentCapital - startingCapital) / startingCapital) * 100;

  // Calculate daily returns for Sharpe
  const dailyPnl = await getDailyPerformance();
  const dailyReturns = dailyPnl.map(d => d.pnl / startingCapital);
  const sharpeRatio = calculateSharpeRatio(dailyReturns);
  const sortinoRatio = calculateSortinoRatio(dailyReturns);

  // Annualized return (assume 252 trading days)
  const daysActive = dailyPnl.length;
  const annualizedReturn = daysActive > 0
    ? (Math.pow(1 + totalReturn / 100, 252 / daysActive) - 1) * 100
    : 0;

  // Volatility
  const volatility = calculateStdDev(dailyReturns) * Math.sqrt(252) * 100;

  // Max drawdown
  let maxDrawdown = portfolio.maxDrawdown;
  let maxDrawdownAmount = portfolio.peakCapital - Math.min(portfolio.capital, portfolio.peakCapital * (1 - maxDrawdown / 100));

  // Recalculate from equity curve to be sure
  let peak = startingCapital;
  let maxDd = 0;
  for (let i = 0; i < dailyPnl.length; i++) {
    const capital = startingCapital + dailyPnl[i].cumulativePnl;
    if (capital > peak) peak = capital;
    const dd = (peak - capital) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  maxDrawdown = Math.max(maxDrawdown, maxDd * 100);
  maxDrawdownAmount = peak * (maxDrawdown / 100);

  // Calmar ratio
  const calmarRatio = calculateCalmarRatio(annualizedReturn, maxDrawdown);

  // Consecutive wins/losses
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentStreak = 0;
  let streakType: 'win' | 'loss' | null = null;
  const sortedTrades = [...closedTrades].sort((a, b) => a.exitTime! - b.exitTime!);

  for (const trade of sortedTrades) {
    const isWin = (trade.netPnL || 0) > 0;
    if (isWin) {
      if (streakType === 'win') {
        currentStreak++;
      } else {
        streakType = 'win';
        currentStreak = 1;
      }
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentStreak);
    } else {
      if (streakType === 'loss') {
        currentStreak++;
      } else {
        streakType = 'loss';
        currentStreak = 1;
      }
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentStreak);
    }
  }

  // Trade durations
  const tradesWithDuration = closedTrades.filter(t => t.duration);
  const avgDuration = tradesWithDuration.length > 0
    ? tradesWithDuration.reduce((sum, t) => sum + (t.duration || 0), 0) / tradesWithDuration.length
    : 0;

  const winningDurations = winningTrades.filter(t => t.duration);
  const losingDurations = losingTrades.filter(t => t.duration);
  const avgTimeInWinners = winningDurations.length > 0
    ? winningDurations.reduce((sum, t) => sum + (t.duration || 0), 0) / winningDurations.length
    : 0;
  const avgTimeInLosers = losingDurations.length > 0
    ? losingDurations.reduce((sum, t) => sum + (t.duration || 0), 0) / losingDurations.length
    : 0;

  // Time efficiency (P&L per hour)
  const totalHours = tradesWithDuration.reduce((sum, t) => sum + ((t.duration || 0) / 60), 0);
  const timeEfficiency = totalHours > 0 ? netPnL / totalHours : 0;

  // Symbol performance
  const symbolPnL: Record<string, number> = {};
  for (const trade of closedTrades) {
    symbolPnL[trade.symbol] = (symbolPnL[trade.symbol] || 0) + (trade.netPnL || 0);
  }
  const sortedSymbols = Object.entries(symbolPnL).sort((a, b) => b[1] - a[1]);
  const bestPerformingSymbol = sortedSymbols[0]?.[0] || 'N/A';
  const worstPerformingSymbol = sortedSymbols[sortedSymbols.length - 1]?.[0] || 'N/A';

  // Best time of day
  const hourPerformance: Record<number, { pnl: number; count: number }> = {};
  for (const trade of closedTrades) {
    const hour = new Date(trade.entryTime).getHours();
    if (!hourPerformance[hour]) hourPerformance[hour] = { pnl: 0, count: 0 };
    hourPerformance[hour].pnl += trade.netPnL || 0;
    hourPerformance[hour].count++;
  }
  const bestHour = Object.entries(hourPerformance)
    .sort((a, b) => (b[1].pnl / b[1].count) - (a[1].pnl / a[1].count))[0];
  const bestTimeOfDay = bestHour ? `${bestHour[0]}:00-${parseInt(bestHour[0]) + 1}:00` : 'N/A';

  // Signal accuracy
  const tradesWithIndicators = closedTrades.filter(t => t.indicators);
  let correctPredictions = 0;
  for (const trade of tradesWithIndicators) {
    const pred = trade.signal;
    const actual = (trade.netPnL || 0) > 0 ? pred : pred === 'BUY' ? 'SELL' : 'BUY';
    if (pred === actual) correctPredictions++;
  }
  const signalAccuracy = tradesWithIndicators.length > 0
    ? (correctPredictions / tradesWithIndicators.length) * 100
    : 0;

  // Average risk per trade
  const avgRiskPerTrade = closedTrades.reduce((sum, t) => sum + (t.initialRisk || 0), 0) / closedTrades.length;

  // Risk/Reward ratio
  const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  // Live trading eligibility check
  const tradesRemaining = Math.max(0, MIN_TRADES_FOR_LIVE - closedTrades.length);
  const eligibleForLive = closedTrades.length >= MIN_TRADES_FOR_LIVE &&
                          winRate >= MIN_WIN_RATE_FOR_LIVE &&
                          maxDrawdown <= MAX_DRAWDOWN_FOR_LIVE &&
                          sharpeRatio >= MIN_SHARPE_FOR_LIVE;

  // Recommendations
  const recommendations: string[] = [];
  if (winRate < MIN_WIN_RATE_FOR_LIVE) {
    recommendations.push(`Win rate ${winRate.toFixed(1)}% below ${MIN_WIN_RATE_FOR_LIVE}% threshold - improve entry accuracy`);
  }
  if (maxDrawdown > MAX_DRAWDOWN_FOR_LIVE) {
    recommendations.push(`Max drawdown ${maxDrawdown.toFixed(1)}% exceeds ${MAX_DRAWDOWN_FOR_LIVE}% - tighten risk controls`);
  }
  if (sharpeRatio < MIN_SHARPE_FOR_LIVE) {
    recommendations.push(`Sharpe ratio ${sharpeRatio.toFixed(2)} below ${MIN_SHARPE_FOR_LIVE} - wait for better strategy`);
  }
  if (profitFactor < 1.5) {
    recommendations.push(`Profit factor ${profitFactor.toFixed(2)} below 1.5 - improve R:R ratio`);
  }
  if (avgTimeInLosers > avgTimeInWinners * 1.5) {
    recommendations.push('Holding losers too long - enforce tighter stops');
  }
  if (recommendations.length === 0 && !eligibleForLive) {
    recommendations.push('Performance good but need more sample size - continue paper trading');
  }
  if (eligibleForLive) {
    recommendations.push('✅ Ready for live trading consideration - proceed with caution');
  }

  return {
    totalTrades: closedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: Math.round(winRate * 100) / 100,
    grossProfit: Math.round(grossProfit),
    grossLoss: Math.round(grossLoss),
    netPnL: Math.round(netPnL),
    avgWin: Math.round(avgWin),
    avgLoss: Math.round(avgLoss),
    largestWin: Math.round(Math.max(...winningTrades.map(t => t.netPnL || 0), 0)),
    largestLoss: Math.round(Math.min(...losingTrades.map(t => t.netPnL || 0), 0)),
    profitFactor: Math.round(profitFactor * 100) / 100,
    expectancy: Math.round(expectancy),
    expectancyPercent: Math.round(expectancyPercent * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownAmount: Math.round(maxDrawdownAmount),
    maxConsecutiveLosses,
    maxConsecutiveWins,
    avgRiskPerTrade: Math.round(avgRiskPerTrade),
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    volatility: Math.round(volatility * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    avgTradeDuration: Math.round(avgDuration),
    avgTimeInWinners: Math.round(avgTimeInWinners),
    avgTimeInLosers: Math.round(avgTimeInLosers),
    timeEfficiency: Math.round(timeEfficiency),
    bestPerformingSymbol,
    worstPerformingSymbol,
    bestTimeOfDay,
    signalAccuracy: Math.round(signalAccuracy * 100) / 100,
    tradesRemaining,
    eligibleForLive,
    recommendations,
  };
}

function getEmptyMetrics(): PerformanceMetrics {
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
    expectancy: 0,
    expectancyPercent: 0,
    maxDrawdown: 0,
    maxDrawdownAmount: 0,
    maxConsecutiveLosses: 0,
    maxConsecutiveWins: 0,
    avgRiskPerTrade: 0,
    riskRewardRatio: 0,
    totalReturn: 0,
    annualizedReturn: 0,
    volatility: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    avgTradeDuration: 0,
    avgTimeInWinners: 0,
    avgTimeInLosers: 0,
    timeEfficiency: 0,
    bestPerformingSymbol: 'N/A',
    worstPerformingSymbol: 'N/A',
    bestTimeOfDay: 'N/A',
    signalAccuracy: 0,
    tradesRemaining: MIN_TRADES_FOR_LIVE,
    eligibleForLive: false,
    recommendations: ['Start trading to accumulate data'],
  };
}

/**
 * Calculate daily performance timeline
 */
export async function getDailyPerformance(): Promise<DailyPerformance[]> {
  const { trades } = await getAllTrades(1000);
  const closedTrades = trades.filter(t => t.status === 'closed' && t.exitTime);

  // Group by date
  const dailyData: Record<string, { trades: PaperTrade[] }> = {};

  for (const trade of closedTrades) {
    const date = new Date(trade.exitTime!).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { trades: [] };
    }
    dailyData[date].trades.push(trade);
  }

  // Calculate metrics per day
  const sortedDates = Object.keys(dailyData).sort();
  let cumulativePnl = 0;
  let peakCapital = 1000000;

  return sortedDates.map(date => {
    const dayTrades = dailyData[date].trades;
    const wins = dayTrades.filter(t => (t.netPnL || 0) > 0);
    const dayPnl = dayTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
    cumulativePnl += dayPnl;

    const capital = 1000000 + cumulativePnl;
    if (capital > peakCapital) peakCapital = capital;
    const drawdown = peakCapital > 0 ? ((peakCapital - capital) / peakCapital) * 100 : 0;

    return {
      date,
      trades: dayTrades.length,
      wins: wins.length,
      losses: dayTrades.length - wins.length,
      pnl: Math.round(dayPnl),
      cumulativePnl: Math.round(cumulativePnl),
      drawdown: Math.round(drawdown * 100) / 100,
      winRate: dayTrades.length > 0 ? Math.round((wins.length / dayTrades.length) * 100) : 0,
    };
  });
}

/**
 * Generate equity curve data
 */
export async function getEquityCurve(): Promise<EquityPoint[]> {
  const { trades } = await getAllTrades(1000);
  const closedTrades = trades.filter(t => t.status === 'closed' && t.exitTime);
  const openTrades = trades.filter(t => t.status === 'open');

  // Sort by exit time
  const sortedTrades = [...closedTrades].sort((a, b) => a.exitTime! - b.exitTime!);

  const equityPoints: EquityPoint[] = [];
  let capital = 1000000;
  let peak = capital;

  // Add starting point
  equityPoints.push({
    timestamp: sortedTrades[0]?.entryTime || Date.now(),
    capital,
    pnl: 0,
    drawdown: 0,
    openPositions: 0,
  });

  for (const trade of sortedTrades) {
    capital += trade.netPnL || 0;
    if (capital > peak) peak = capital;

    const drawdown = ((peak - capital) / peak) * 100;

    equityPoints.push({
      timestamp: trade.exitTime!,
      capital: Math.round(capital),
      pnl: Math.round(trade.netPnL || 0),
      drawdown: Math.round(drawdown * 100) / 100,
      openPositions: openTrades.filter(t => t.entryTime < trade.exitTime!).length,
    });
  }

  return equityPoints;
}

/**
 * Generate trade journal
 */
export async function getTradeJournal(
  limit: number = 50,
  onlyOpen: boolean = false
): Promise<TradeJournalEntry[]> {
  const { trades } = await getAllTrades(limit);
  const filteredTrades = onlyOpen ? trades.filter(t => t.status === 'open') : trades;

  return filteredTrades.map(trade => ({
    id: trade.id,
    entryTime: trade.entryTime,
    exitTime: trade.exitTime,
    symbol: trade.symbol,
    signal: trade.signal,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    netPnL: trade.netPnL || 0,
    exitReason: trade.exitReason,
    duration: trade.duration,
    summary: generateTradeSummary(trade),
    lessons: generateTradeLessons(trade),
    grade: gradeTrade(trade),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Save Performance Data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save metrics snapshot to DynamoDB
 */
export async function saveMetricsSnapshot(): Promise<void> {
  const metrics = await calculatePerformanceMetrics();
  const timestamp = Date.now();

  await docClient.send(new PutCommand({
    TableName: MOMENTUM_METRICS_TABLE,
    Item: {
      pk: `METRICS#SNAPSHOT`,
      sk: `TIME#${timestamp}`,
      ...metrics,
      timestamp,
      ttl: Math.floor(timestamp / 1000) + 86400 * 365, // 1 year retention
    },
  }));
}

/**
 * Get latest saved metrics
 */
export async function getLatestMetrics(): Promise<PerformanceMetrics | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: MOMENTUM_METRICS_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': 'METRICS#SNAPSHOT',
      },
      Limit: 1,
      ScanIndexForward: false,
    }));

    return (result.Items?.[0] as PerformanceMetrics) || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Data Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get complete dashboard data
 */
export async function getDashboardData() {
  const [metrics, equityCurve, dailyPerformance, journal, portfolio, openTrades] = await Promise.all([
    calculatePerformanceMetrics(),
    getEquityCurve(),
    getDailyPerformance(),
    getTradeJournal(20),
    getPortfolioState(),
    getOpenTrades(),
  ]);

  return {
    metrics,
    equityCurve: equityCurve.slice(-30), // Last 30 points
    dailyPerformance: dailyPerformance.slice(-30), // Last 30 days
    journal,
    portfolio: {
      capital: Math.round(portfolio.capital),
      availableCapital: Math.round(portfolio.availableCapital),
      totalPnl: Math.round(portfolio.totalPnl),
      dayPnl: Math.round(portfolio.dayPnl),
      openPositions: portfolio.openPositions,
      winRate: portfolio.winRate,
      maxDrawdown: portfolio.maxDrawdown,
    },
    openTrades: openTrades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      signal: t.signal,
      entryPrice: t.entryPrice,
      entryTime: t.entryTime,
      atmStrike: t.atmStrike,
      initialRisk: t.initialRisk,
    })),
    timestamp: Date.now(),
  };
}
