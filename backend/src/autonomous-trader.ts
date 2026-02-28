/**
 * Autonomous Paper Trading Lambda
 * Runs every 15 min during market hours via EventBridge.
 * Fully per-user scoped — scans all registered users and runs for each.
 *
 * Two responsibilities per user:
 * 1. SCAN: Read smart money screener results (BOS/CHOCH signals) from DynamoDB cache
 *    and enter hedged paper trades for high-conviction opportunities.
 * 2. MONITOR: Check all open paper trades for exit conditions (SL, target,
 *    momentum exhaustion, reversal, time expiry) and auto-exit.
 */

import {
  enterTradeFromScan,
  exitTrade,
  getOpenTrades,
  getPortfolioState,
  checkExitConditions,
  SECTOR_MAP,
  type PaperTrade,
  type SimplifiedTradeRequest,
} from './momentum-trader/paper-trading.js';
import {
  type FullIndicatorSet,
  type MultiTimeframeAnalysis,
  calculateAllIndicators,
} from './momentum-trader/indicators.js';
import { handleScreenerRequest, type SmartMoneyStock } from './screener-api.js';
import { scanStockYahoo } from './agents/shared.js';
import {
  makeDecision,
  getTradingRules,
  analyzeTradeOutcome,
  type ScreenerData,
  type PortfolioContext,
} from './prime-intelligence.js';
import { getPaperMode } from './momentum-trader/dashboard-api.js';
import { LOT_SIZES } from './momentum-trader/hedging.js';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { ScanCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from './utils/db.js';

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const STAGE = process.env.STAGE || 'prod';
const USERS_TABLE = process.env.USERS_TABLE || `users-${STAGE}`;
const CONFIG_TABLE = process.env.MOMENTUM_CONFIG_TABLE || `momentum-config-${STAGE}`;

// DynamoDB-based distributed lock to prevent concurrent executions
async function acquireLock(): Promise<boolean> {
  const ttl = Math.floor(Date.now() / 1000) + 600; // 10-minute TTL
  try {
    await docClient.send(new PutCommand({
      TableName: CONFIG_TABLE,
      Item: { pk: 'LOCK#AUTO_TRADER', sk: 'EXECUTION', ttl, acquiredAt: Date.now() },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
    return true;
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

async function releaseLock(): Promise<void> {
  try {
    await docClient.send(new DeleteCommand({
      TableName: CONFIG_TABLE,
      Key: { pk: 'LOCK#AUTO_TRADER', sk: 'EXECUTION' },
    }));
  } catch { /* best-effort */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// User Discovery
// Returns all users who have explicitly enabled auto-trading.
// Auto-trading runs regardless of whether the user's browser is open.
// ─────────────────────────────────────────────────────────────────────────────

async function getActiveUserIds(): Promise<string[]> {
  try {
    // Scan all registered users (no lastActive filter — auto-trading must work
    // even when the user has their browser closed)
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'sk = :sk',
      ExpressionAttributeValues: {
        ':sk': 'PROFILE',
      },
      ProjectionExpression: 'email',
    }));

    const allUsers = (result.Items || [])
      .map(item => item.email as string)
      .filter(Boolean);

    console.log(`[AutoTrader] ${allUsers.length} total users — checking auto-trading preference`);

    // Only process users who have explicitly opted in to auto-trading
    const autoEnabledUsers = (await Promise.all(
      allUsers.map(async (uid) => {
        const cfg = await getPaperMode(uid);
        return cfg.autoTradingEnabled ? uid : null;
      })
    )).filter(Boolean) as string[];

    console.log(`[AutoTrader] ${autoEnabledUsers.length}/${allUsers.length} users have auto-trading ON`);
    return autoEnabledUsers;
  } catch (err: any) {
    console.error('[AutoTrader] Failed to scan users:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

interface UserResult {
  userId: string;
  scan?: any;
  monitor?: any;
  error?: string;
}

export const handler = async (event: any): Promise<{ statusCode: number; body: string }> => {
  console.log('[AutoTrader] Triggered:', JSON.stringify(event));

  const action = event.action || event.body?.action || 'scan_and_trade';

  // Acquire distributed lock — bail out if another execution is already running
  const locked = await acquireLock();
  if (!locked) {
    console.log('[AutoTrader] Another execution is already running — skipping this trigger');
    return { statusCode: 200, body: JSON.stringify({ message: 'Skipped — already running', skipped: true }) };
  }

  try {
    // Get all registered users
    const userIds = await getActiveUserIds();
    if (userIds.length === 0) {
      console.log('[AutoTrader] No active users — skipping all processing to save costs');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No active users online — skipping', users: 0, cost: '$0' }),
      };
    }

    console.log(`[AutoTrader] Processing ${userIds.length} users: ${userIds.join(', ')}`);

    // Fetch smart money screener data once (shared across all users)
    const screenerResult = await handleScreenerRequest(false);
    let stocks: SmartMoneyStock[] = screenerResult.body?.stocks || [];
    if (stocks.length === 0) {
      console.log('[AutoTrader] No screener cache, triggering refresh');
      const freshResult = await handleScreenerRequest(true);
      stocks = freshResult.body?.stocks || [];
    }

    // Run for each user
    const results: UserResult[] = [];
    for (const userId of userIds) {
      try {
        const userResult: UserResult = { userId };

        switch (action) {
          case 'scan_signals':
            userResult.scan = await scanSmartMoneySignals(userId, stocks);
            break;

          case 'monitor_positions':
            userResult.monitor = await monitorOpenPositions(userId);
            break;

          case 'scan_and_trade':
          default: {
            const [scanRes, monitorRes] = await Promise.all([
              scanSmartMoneySignals(userId, stocks),
              monitorOpenPositions(userId),
            ]);
            userResult.scan = scanRes;
            userResult.monitor = monitorRes;
            break;
          }
        }

        results.push(userResult);
      } catch (err) {
        results.push({ userId, error: (err as Error).message });
        console.error(`[AutoTrader] Error for ${userId}:`, err);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ users: results.length, results }),
    };
  } catch (error) {
    console.error('[AutoTrader] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  } finally {
    await releaseLock();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Capital Protection Circuit Breakers (per-user)
// ─────────────────────────────────────────────────────────────────────────────

interface CircuitBreakerResult {
  canTrade: boolean;
  reason: string;
}

async function checkCircuitBreakers(userId: string): Promise<CircuitBreakerResult> {
  const portfolio = await getPortfolioState(userId);
  const rules = await getTradingRules(userId);
  const config = rules.config;

  // 1. Max positions check
  if (portfolio.openPositions >= config.maxPositions) {
    return { canTrade: false, reason: `Max positions (${config.maxPositions}) reached. ${portfolio.openPositions} open.` };
  }

  // 2. Daily loss limit check
  const dailyLossLimit = (config.dailyLossLimitPct / 100) * config.startingCapital;
  if (portfolio.dailyLossUsed >= dailyLossLimit) {
    return { canTrade: false, reason: `Daily loss limit breached: ₹${portfolio.dailyLossUsed.toLocaleString()} / ₹${dailyLossLimit.toLocaleString()}` };
  }

  // 3. Close to daily loss limit (>80% used) — warn but allow (Prime will factor this in)
  const dailyLossUsedPct = (portfolio.dailyLossUsed / dailyLossLimit) * 100;
  if (dailyLossUsedPct >= 80) {
    console.log(`[AutoTrader] Daily loss ${dailyLossUsedPct.toFixed(0)}% used — proceeding with caution`);
  }

  // 4. Total drawdown check (15% from peak = emergency halt)
  if (portfolio.maxDrawdown >= 15) {
    return { canTrade: false, reason: `Emergency halt: portfolio drawdown ${portfolio.maxDrawdown.toFixed(1)}% exceeds 15% threshold.` };
  }

  return { canTrade: true, reason: 'All circuit breakers passed' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Segment Selector: Cash Equity vs F&O Futures
// Chooses CASH or FUTURES based on IV proxy, margin, conviction, and structure.
// ─────────────────────────────────────────────────────────────────────────────

function selectSegment(params: {
  symbol: string;
  price: number;
  momentum5d: number;     // 5-day momentum % (used as IV proxy)
  confidence: number;     // Prime's confidence score 0-100
  structure: SmartMoneyStock['structure'];
}): { segment: 'FUTURES' | 'CASH'; reason: string } {
  const { symbol, price, momentum5d, confidence, structure } = params;
  const absM = Math.abs(momentum5d);

  // 1. F&O eligibility: stock must have a listed futures contract
  const lotSize = LOT_SIZES[symbol.toUpperCase()];
  if (!lotSize) {
    return { segment: 'CASH', reason: 'Not F&O listed — no lot size on record' };
  }

  // 2. Margin cap: NSE SPAN margin ≈ 15% of contract value. Must stay under ₹1L.
  const estMarginPerLot = price * lotSize * 0.15;
  if (estMarginPerLot > 100000) {
    return { segment: 'CASH', reason: `Margin ₹${Math.round(estMarginPerLot / 1000)}K/lot > ₹1L cap` };
  }

  // 3. Estimate implied volatility from 5-day momentum (proxy only)
  //    absM > 5% → stock surging, high vol → expensive hedge
  //    absM 3-5% → moderate high vol → hedge still reasonable with HIGH conviction
  //    absM 1.5-3% → medium vol → ideal zone for F&O
  //    absM < 1.5% → stock barely moving → leverage adds no benefit
  const ivProxy = absM > 5 ? 0.45 : absM > 3 ? 0.35 : absM > 1.5 ? 0.28 : 0.18;

  // 4. High IV → option hedge premium is expensive → CASH preferred
  if (ivProxy >= 0.40) {
    return { segment: 'CASH', reason: `High IV proxy ${(ivProxy * 100).toFixed(0)}% (5d mom ${momentum5d.toFixed(1)}%) — hedge cost prohibitive` };
  }

  // 5. Very low IV → stock barely moving → F&O leverage wasted → CASH
  if (ivProxy <= 0.20) {
    return { segment: 'CASH', reason: `Low momentum ${momentum5d.toFixed(1)}% — leverage inefficient` };
  }

  // 6. RANGE-bound structure with moderate confidence → CASH (no clear direction)
  if (structure === 'RANGE' && confidence < 70) {
    return { segment: 'CASH', reason: `Range-bound structure (${confidence}% confidence) — direction unclear` };
  }

  // 7. Low Prime confidence → CASH (safer, no leverage risk)
  if (confidence < 60) {
    return { segment: 'CASH', reason: `Prime confidence ${confidence}% below 60% threshold` };
  }

  // Default: FUTURES (medium IV, F&O eligible, margin within cap, good conviction)
  return {
    segment: 'FUTURES',
    reason: `IV=${(ivProxy * 100).toFixed(0)}%, margin=₹${Math.round(estMarginPerLot / 1000)}K/lot, confidence=${confidence}%`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Money Signal Scanning → Prime Decision → Trade Entry (per-user)
// ─────────────────────────────────────────────────────────────────────────────

async function scanSmartMoneySignals(userId: string, stocks: SmartMoneyStock[]): Promise<any> {
  const tradesEntered: string[] = [];
  const primeDecisions: { symbol: string; action: string; confidence: number; rationale: string }[] = [];
  const errors: string[] = [];

  // 1. Run circuit breakers
  const circuitCheck = await checkCircuitBreakers(userId);
  if (!circuitCheck.canTrade) {
    console.log(`[AutoTrader][${userId}] Circuit breaker tripped: ${circuitCheck.reason}`);
    return { message: circuitCheck.reason, circuitBreaker: 'TRIPPED', tradesEntered: [], primeDecisions: [] };
  }

  if (stocks.length === 0) {
    return { message: 'No screener data available', scanned: 0, tradesEntered: [], primeDecisions: [] };
  }

  // 2. Tier 1: Rule-based pre-filter for BOS/CHOCH signals
  const candidates = stocks.filter(s => {
    if (s.signal === 'NEUTRAL') return false;
    if (s.confidence < 45) return false;
    if (Math.abs(s.trendStrength) < 15) return false;
    // Allow RANGE structures if confidence is high enough
    if (s.structure === 'RANGE' && s.confidence < 65) return false;
    return true;
  });

  // Sort by composite score: confidence × |trendStrength|
  candidates.sort((a, b) => (b.confidence * Math.abs(b.trendStrength)) - (a.confidence * Math.abs(a.trendStrength)));

  // Get user's currently held symbols to avoid duplicates
  const openTrades = await getOpenTrades(userId);
  const heldSymbols = new Set(openTrades.map(t => t.symbol.toUpperCase()));

  // Filter out already-held symbols
  const newCandidates = candidates.filter(c => !heldSymbols.has(c.symbol.toUpperCase()));

  // Take top 5 for Prime consultation (limit LLM calls)
  const topCandidates = newCandidates.slice(0, 5);

  console.log(`[AutoTrader][${userId}] ${stocks.length} stocks → ${candidates.length} candidates → ${topCandidates.length} for Prime review`);

  if (topCandidates.length === 0) {
    return {
      scanned: stocks.length,
      candidates: candidates.length,
      candidateList: candidates.slice(0, 10).map(c => ({
        symbol: c.symbol, signal: c.signal, structure: c.structure,
        confidence: c.confidence, trendStrength: c.trendStrength, price: c.price,
      })),
      message: 'No new candidates (all held or filtered)',
      tradesEntered: [],
      primeDecisions: [],
    };
  }

  // 3. Build portfolio context for Prime
  const portfolio = await getPortfolioState(userId);
  const portfolioCtx: PortfolioContext = {
    openPositions: portfolio.openPositions,
    todayPnL: portfolio.dailyPnl || 0,
    totalPnL: portfolio.totalPnl || 0,
    capitalUsed: portfolio.marginUsed || 0,
    availableCapital: portfolio.capital - (portfolio.marginUsed || 0),
    winRate: portfolio.winRate || 0,
    maxDrawdown: portfolio.maxDrawdown || 0,
  };

  // 4. Tier 2: Consult Prime on each candidate (sequential to avoid Bedrock rate limits)
  const MAX_ENTRIES_PER_CYCLE = 2;
  let entered = 0;

  for (const stock of topCandidates) {
    if (entered >= MAX_ENTRIES_PER_CYCLE) break;
    if (portfolio.openPositions + entered >= (await getTradingRules(userId)).config.maxPositions) break;

    try {
      const signal: 'BUY' | 'SELL' = stock.signal === 'BUY' ? 'BUY' : 'SELL';

      // Get fresh price data
      const freshScan = await scanStockYahoo(stock.symbol);
      const entryPrice = freshScan?.price || stock.price;
      const rsi = freshScan?.rsi || stock.rsi;
      const support = freshScan?.support || stock.support;
      const resistance = freshScan?.resistance || stock.resistance;

      // Build screener context for Prime
      const screenerCtx: ScreenerData = {
        structure: stock.structure,
        confidence: stock.confidence,
        trendStrength: stock.trendStrength,
        rsi,
        momentum5d: stock.momentum5d,
        volumeSurge: stock.volumeSurge,
        support,
        resistance,
      };

      // Consult Prime — the intelligent decision-maker
      console.log(`[AutoTrader][${userId}] Consulting Prime on ${stock.symbol} ${signal}...`);
      const decision = await makeDecision(
        stock.symbol,
        signal,
        entryPrice,
        { overall_signal: signal, rsi: { value: rsi }, trend: { trend: stock.trend } },
        userId,
        screenerCtx,
        portfolioCtx,
      );

      primeDecisions.push({
        symbol: stock.symbol,
        action: decision.action,
        confidence: decision.confidence,
        rationale: decision.rationale.slice(0, 200),
      });

      console.log(`[AutoTrader][${userId}] Prime decision for ${stock.symbol}: ${decision.action} (${decision.confidence}%)`);

      // Only enter if Prime says ENTER with sufficient confidence
      if (decision.action !== 'ENTER' || decision.confidence < 55) {
        console.log(`[AutoTrader][${userId}] Prime skipped ${stock.symbol}: ${decision.action} @ ${decision.confidence}%`);
        continue;
      }

      // Prime approved — enter the trade
      const conviction: 'HIGH' | 'MEDIUM' | 'LOW' =
        decision.confidence >= 80 ? 'HIGH' : decision.confidence >= 60 ? 'MEDIUM' : 'LOW';

      // Autonomously choose segment: Cash equity or F&O futures
      const { segment, reason: segmentReason } = selectSegment({
        symbol: stock.symbol,
        price: entryPrice,
        momentum5d: stock.momentum5d,
        confidence: decision.confidence,
        structure: stock.structure,
      });
      console.log(`[AutoTrader][${userId}] Segment for ${stock.symbol}: ${segment} — ${segmentReason}`);

      // Compute stop-loss for cash trades (needed for share sizing)
      const stopLoss = signal === 'BUY' ? support : resistance;

      const request: SimplifiedTradeRequest = {
        symbol: stock.symbol,
        signal,
        entryPrice,
        rsi,
        rsiSignal: rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral',
        trend: stock.trend,
        trendStrength: Math.abs(stock.trendStrength) >= 60 ? 'strong' : 'moderate',
        momentum5d: stock.momentum5d,
        support,
        resistance,
        volumeSurge: stock.volumeSurge,
        score: decision.confidence,
        conviction,
        triggerSource: 'prime_scan',
        rationale: `Prime decision: ${decision.rationale.slice(0, 150)} | Structure: ${stock.structure} | Confidence: ${decision.confidence}% | Segment: ${segment} (${segmentReason})`,
        userId,
        segment,
        stopLoss,
      };

      const result = await enterTradeFromScan(request);
      if (result.success && result.trade) {
        entered++;
        tradesEntered.push(`${stock.symbol} ${signal} @ ₹${entryPrice} [${segment}][${stock.structure}] Prime:${decision.confidence}%`);
        console.log(`[AutoTrader][${userId}] Prime-approved trade entered: ${stock.symbol} ${signal} @ ₹${entryPrice} [${segment}]`);

        // Update portfolio context for next candidate
        portfolioCtx.openPositions++;
        portfolioCtx.capitalUsed += result.trade.marginUsed || 0;
        portfolioCtx.availableCapital -= result.trade.marginUsed || 0;
      } else if (result.error) {
        errors.push(`${stock.symbol}: ${result.error}`);
      }
    } catch (err) {
      errors.push(`${stock.symbol}: ${(err as Error).message}`);
      console.error(`[AutoTrader][${userId}] Error consulting Prime for ${stock.symbol}:`, err);
    }
  }

  return {
    scanned: stocks.length,
    candidates: candidates.length,
    candidateList: candidates.slice(0, 10).map(c => ({
      symbol: c.symbol, signal: c.signal, structure: c.structure,
      confidence: c.confidence, trendStrength: c.trendStrength, price: c.price,
    })),
    primeDecisions,
    tradesEntered,
    errors: errors.slice(0, 5),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Position Monitoring → Auto-Exit (per-user)
// ─────────────────────────────────────────────────────────────────────────────

interface ChartDataResponse {
  candles: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[];
  symbol: string;
  interval: string;
  current_price: number;
}

async function monitorOpenPositions(userId: string): Promise<any> {
  const openTrades = await getOpenTrades(userId);
  const exited: string[] = [];
  const monitored: string[] = [];
  const errors: string[] = [];

  if (openTrades.length === 0) {
    return { monitored: 0, exited: [], message: 'No open positions' };
  }

  console.log(`[AutoTrader][${userId}] Monitoring ${openTrades.length} open positions`);

  // Track unrealized P&L across all positions for capital protection
  const positionPnLs: { trade: PaperTrade; currentPrice: number; unrealizedPnL: number }[] = [];

  for (const trade of openTrades) {
    try {
      const chartData = await fetchChartData(trade.symbol, 'day', 50);
      if (!chartData) {
        errors.push(`${trade.symbol}: No chart data`);
        continue;
      }

      const indicators = sanitizeIndicators(calculateAllIndicators(chartData.candles));

      const timeframeAnalysis: MultiTimeframeAnalysis = {
        alignment: indicators.momentum.direction === 'bullish' ? 'bullish' :
                   indicators.momentum.direction === 'bearish' ? 'bearish' : 'neutral',
        confidence: indicators.momentum.confidence,
        dominant_trend: indicators.adx.direction,
        signals: {
          'daily': indicators.momentum.direction === 'bullish' ? 'BUY' :
                   indicators.momentum.direction === 'bearish' ? 'SELL' : 'HOLD',
        },
      };

      const exitCheck = checkExitConditions(trade, chartData.current_price, indicators, timeframeAnalysis);

      const priceDiff = chartData.current_price - trade.entryPrice;
      const direction = trade.signal === 'BUY' ? 1 : -1;
      const unrealizedPnL = priceDiff * direction * trade.lotSize * trade.futuresLots;
      const pricePct = ((priceDiff / trade.entryPrice) * 100).toFixed(1);

      monitored.push(`${trade.symbol} @ ₹${chartData.current_price} (${pricePct}%) P&L: ₹${unrealizedPnL.toFixed(0)}`);
      positionPnLs.push({ trade, currentPrice: chartData.current_price, unrealizedPnL });

      if (exitCheck.shouldExit) {
        const result = await exitTrade({
          tradeId: trade.id,
          exitPrice: chartData.current_price,
          exitReason: exitCheck.reason,
          currentIndicators: indicators,
          userId,
        });

        if (result.success && result.trade) {
          const pnl = result.trade.netPnL;
          exited.push(`${trade.symbol} ${exitCheck.reason}: ₹${pnl >= 0 ? '+' : ''}${pnl}`);
          console.log(`[AutoTrader][${userId}] Exited: ${trade.symbol} ${exitCheck.reason} P&L: ₹${pnl}`);

          // Prime learns from this trade outcome (async, non-blocking)
          analyzeTradeOutcome({
            symbol: trade.symbol,
            signal: trade.signal,
            entryPrice: trade.entryPrice,
            exitPrice: chartData.current_price,
            netPnL: result.trade.netPnL,
            pnlPercent: result.trade.pnlPercent,
            exitReason: exitCheck.reason,
            duration: result.trade.duration,
            indicators: trade.indicators,
            exitIndicators: indicators,
            sector: SECTOR_MAP[trade.symbol.toUpperCase()],
          }, userId).catch(err => console.error(`[AutoTrader][${userId}] Lesson analysis failed:`, err.message));
        } else {
          errors.push(`Exit failed for ${trade.symbol}: ${result.error}`);
        }
      }
    } catch (err) {
      errors.push(`Monitor ${trade.symbol}: ${(err as Error).message}`);
    }
  }

  // Portfolio-level capital protection: emergency exit worst position if total loss is critical
  const totalUnrealizedLoss = positionPnLs
    .filter(p => p.unrealizedPnL < 0)
    .reduce((sum, p) => sum + p.unrealizedPnL, 0);

  const rules = await getTradingRules(userId);
  const emergencyThreshold = (rules.config.dailyLossLimitPct / 100) * rules.config.startingCapital;

  if (Math.abs(totalUnrealizedLoss) > emergencyThreshold && positionPnLs.length > 0) {
    // Exit worst-performing position to protect capital
    const worstPosition = positionPnLs
      .filter(p => p.unrealizedPnL < 0)
      .sort((a, b) => a.unrealizedPnL - b.unrealizedPnL)[0];

    if (worstPosition) {
      console.log(`[AutoTrader][${userId}] CAPITAL PROTECTION: Exiting worst position ${worstPosition.trade.symbol} (₹${worstPosition.unrealizedPnL.toFixed(0)})`);
      try {
        const result = await exitTrade({
          tradeId: worstPosition.trade.id,
          exitPrice: worstPosition.currentPrice,
          exitReason: 'stoploss',
          userId,
        });
        if (result.success && result.trade) {
          exited.push(`${worstPosition.trade.symbol} CAPITAL_PROTECTION: ₹${result.trade.netPnL}`);

          // Prime learns from capital protection exit
          analyzeTradeOutcome({
            symbol: worstPosition.trade.symbol,
            signal: worstPosition.trade.signal,
            entryPrice: worstPosition.trade.entryPrice,
            exitPrice: worstPosition.currentPrice,
            netPnL: result.trade.netPnL,
            pnlPercent: result.trade.pnlPercent,
            exitReason: 'capital_protection',
            duration: result.trade.duration,
            indicators: worstPosition.trade.indicators,
            sector: SECTOR_MAP[worstPosition.trade.symbol.toUpperCase()],
          }, userId).catch(err => console.error(`[AutoTrader][${userId}] Lesson analysis failed:`, err.message));
        }
      } catch (err) {
        errors.push(`Capital protection exit failed for ${worstPosition.trade.symbol}: ${(err as Error).message}`);
      }
    }
  }

  return {
    monitored: openTrades.length,
    positions: monitored,
    exited,
    capitalProtection: Math.abs(totalUnrealizedLoss) > emergencyThreshold
      ? `TRIGGERED: Total unrealized loss ₹${totalUnrealizedLoss.toFixed(0)} exceeds ₹${emergencyThreshold.toFixed(0)}`
      : 'OK',
    errors: errors.slice(0, 5),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Fetching
// ─────────────────────────────────────────────────────────────────────────────

async function fetchChartData(
  symbol: string,
  interval: string,
  limit: number,
): Promise<ChartDataResponse | null> {
  // Try zerodha-chart-data-api Lambda first
  try {
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'zerodha-chart-data-api',
      Payload: Buffer.from(JSON.stringify({ symbol, interval, limit })),
    }));

    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    const body = typeof result.body === 'string' ? JSON.parse(result.body) : result;

    if (!body.error) {
      const chartData = body.chart_data || body.candles || [];
      const candles = chartData.map((c: any) => {
        let timestamp: number;
        if (typeof c.time === 'string') {
          timestamp = new Date(c.time).getTime();
        } else if (c.timestamp) {
          timestamp = typeof c.timestamp === 'number' ? c.timestamp : new Date(c.timestamp).getTime();
        } else {
          timestamp = c[0];
        }

        return {
          timestamp,
          open: c.open || c[1],
          high: c.high || c[2],
          low: c.low || c[3],
          close: c.close || c[4],
          volume: c.volume || c[5] || 0,
        };
      });

      const currentPrice = body.metrics?.current_price || body.current_price || candles[candles.length - 1]?.close || 0;
      return { candles, symbol, interval, current_price: currentPrice };
    }

    console.warn(`[AutoTrader] Zerodha chart API failed for ${symbol}, falling back to Yahoo Finance`);
  } catch (err) {
    console.warn(`[AutoTrader] Zerodha chart API error for ${symbol}, falling back to Yahoo Finance`);
  }

  // Fallback: Yahoo Finance
  return fetchChartDataYahoo(symbol, limit);
}

/** Replace NaN/Infinity values with 0 recursively to prevent DynamoDB serialization errors */
function sanitizeIndicators<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'number') return (Number.isFinite(obj) ? obj : 0) as unknown as T;
  if (Array.isArray(obj)) return obj.map(sanitizeIndicators) as unknown as T;
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [k, v] of Object.entries(obj as any)) {
      result[k] = sanitizeIndicators(v);
    }
    return result as T;
  }
  return obj;
}

async function fetchChartDataYahoo(
  symbol: string,
  limit: number,
): Promise<ChartDataResponse | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?interval=1d&range=3mo`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;

    const data = (await res.json()) as any;
    const chartResult = data?.chart?.result?.[0];
    if (!chartResult) return null;

    const meta = chartResult.meta;
    const timestamps: number[] = chartResult.timestamp || [];
    const quote = chartResult.indicators?.quote?.[0];
    if (!quote || timestamps.length === 0) return null;

    const candles = timestamps
      .map((t: number, i: number) => ({
        timestamp: t * 1000,
        open: quote.open?.[i],
        high: quote.high?.[i],
        low: quote.low?.[i],
        close: quote.close?.[i],
        volume: quote.volume?.[i] || 0,
      }))
      .filter((c: any) => c.close != null)
      .slice(-limit);

    const currentPrice = meta?.regularMarketPrice || candles[candles.length - 1]?.close || 0;

    return { candles, symbol, interval: 'day', current_price: currentPrice };
  } catch (err) {
    console.error(`[AutoTrader] Yahoo Finance fallback failed for ${symbol}:`, err);
    return null;
  }
}
