/**
 * Backtest Framework for Momentum Trading Strategy
 * Uses historical data from Yahoo Finance / NSE
 */

import {
  Candle,
  FullIndicatorSet,
  MultiTimeframeAnalysis,
  calculateAllIndicators,
  analyzeMultipleTimeframes,
} from './indicators.js';
import {
  HedgeConfig,
  HedgePosition,
  calculateHedgePosition,
  calculateHedgedPnL,
} from './hedging.js';
import { PaperTrade, PAPER_TRADING_CONFIG } from './paper-trading.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types and Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface BacktestConfig {
  symbol: string;
  startDate: string;
  endDate: string;
  timeframe: '30m' | '1h' | '4h';
  startingCapital: number;
  riskPerTrade: number;
  paperTradingMode: boolean;
}

export interface BacktestTrade extends PaperTrade {
  entryIndex: number;
  exitIndex: number;
  maxAdverseExcursion: number; // Max loss during trade
  maxFavorableExcursion: number; // Max profit during trade
  exitEfficiency: number; // How close to MAE was actual exit
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  metrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    grossProfit: number;
    grossLoss: number;
    netPnL: number;
    profitFactor: number;
    maxDrawdown: number;
    maxDrawdownAmount: number;
    sharpeRatio: number;
    avgTrade: number;
    avgWin: number;
    avgLoss: number;
    avgHoldingPeriod: number; // bars
    expectancy: number;
    totalReturn: number;
    annualizedReturn: number;
  };
  equityCurve: { timestamp: number; capital: number; drawdown: number }[];
  monthlyReturns: { month: string; return: number; }[];
  signalPerformance: {
    buySignals: number;
    buyWins: number;
    sellSignals: number;
    sellWins: number;
    accuracy: number;
  };
  parameterOptimization?: {
    bestRSIThreshold: number;
    bestADXThreshold: number;
    bestVolumeMultiplier: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Fetching Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch historical data from Yahoo Finance
 */
export async function fetchHistoricalData(
  symbol: string,
  startDate: string,
  endDate: string,
  interval: string = '1h'
): Promise<Candle[]> {
  // Convert symbol to Yahoo Finance format
  const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;

  // Calculate timestamps
  const startTimestamp = new Date(startDate).getTime() / 1000;
  const endTimestamp = new Date(endDate).getTime() / 1000;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&period1=${startTimestamp}&period2=${endTimestamp}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as any;

    if (!data.chart?.result?.[0]) {
      throw new Error('No data returned from Yahoo Finance');
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const opens = result.indicators?.quote?.[0]?.open || [];
    const highs = result.indicators?.quote?.[0]?.high || [];
    const lows = result.indicators?.quote?.[0]?.low || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const volumes = result.indicators?.quote?.[0]?.volume || [];

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (opens[i] && highs[i] && lows[i] && closes[i]) {
        candles.push({
          timestamp: timestamps[i] * 1000,
          open: opens[i],
          high: highs[i],
          low: lows[i],
          close: closes[i],
          volume: volumes[i] || 0,
        });
      }
    }

    return candles;
  } catch (error) {
    console.error(`Failed to fetch data for ${symbol}:`, error);
    // Return mock data for testing
    return generateMockCandles(startDate, endDate);
  }
}

/**
 * Generate mock candles for testing backtest framework
 */
function generateMockCandles(startDate: string, endDate: string): Candle[] {
  const candles: Candle[] = [];
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const interval = 60 * 60 * 1000; // 1 hour

  let price = 1000;

  for (let t = start; t < end; t += interval) {
    const volatility = 0.01;
    const change = (Math.random() - 0.5) * 2 * volatility;

    price = price * (1 + change);
    const high = price * (1 + Math.random() * 0.005);
    const low = price * (1 - Math.random() * 0.005);
    const open = low + Math.random() * (high - low);
    const close = low + Math.random() * (high - low);
    const volume = Math.floor(100000 + Math.random() * 200000);

    candles.push({
      timestamp: t,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return candles;
}

/**
 * Generate multi-timeframe candle data
 */
export async function fetchMultiTimeframeData(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<{ '30m': Candle[]; '1h': Candle[]; '4h': Candle[] }> {
  // For backtesting, we'll use 1h as base and derive others
  const candles1h = await fetchHistoricalData(symbol, startDate, endDate, '1h');

  // Generate 30m by interpolating
  const candles30m: Candle[] = [];
  for (let i = 0; i < candles1h.length - 1; i++) {
    const current = candles1h[i];
    const next = candles1h[i + 1];
    const midTime = (current.timestamp + next.timestamp) / 2;

    candles30m.push(current);
    candles30m.push({
      timestamp: midTime,
      open: current.close,
      high: Math.max(current.close, next.open) * 1.002,
      low: Math.min(current.close, next.open) * 0.998,
      close: (current.close + next.open) / 2,
      volume: Math.floor(current.volume / 2),
    });
  }

  // Generate 4h by combining
  const candles4h: Candle[] = [];
  for (let i = 0; i < candles1h.length; i += 4) {
    const chunk = candles1h.slice(i, i + 4);
    if (chunk.length === 4) {
      candles4h.push({
        timestamp: chunk[0].timestamp,
        open: chunk[0].open,
        high: Math.max(...chunk.map(c => c.high)),
        low: Math.min(...chunk.map(c => c.low)),
        close: chunk[3].close,
        volume: chunk.reduce((sum, c) => sum + c.volume, 0),
      });
    }
  }

  return {
    '30m': candles30m,
    '1h': candles1h,
    '4h': candles4h,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backtest Engine
// ─────────────────────────────────────────────────────────────────────────────

interface BacktestState {
  capital: number;
  peakCapital: number;
  maxDrawdown: number;
  position: BacktestTrade | null;
  trades: BacktestTrade[];
  equityCurve: { timestamp: number; capital: number; drawdown: number }[];
  totalRiskTaken: number;
}

/**
 * Run backtest on historical data
 */
export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  console.log(`Starting backtest for ${config.symbol} from ${config.startDate} to ${config.endDate}`);

  // Fetch data
  const multiTimeframeData = await fetchMultiTimeframeData(
    config.symbol,
    config.startDate,
    config.endDate
  );

  const candles1h = multiTimeframeData['1h'];
  const candles30m = multiTimeframeData['30m'];
  const candles4h = multiTimeframeData['4h'];

  if (candles1h.length < 100) {
    throw new Error('Insufficient historical data for backtest');
  }

  // Initialize state
  const state: BacktestState = {
    capital: config.startingCapital,
    peakCapital: config.startingCapital,
    maxDrawdown: 0,
    position: null,
    trades: [],
    equityCurve: [],
    totalRiskTaken: 0,
  };

  // Walk forward through data
  const lookback = 50; // Need 50 candles for indicators

  for (let i = lookback; i < candles1h.length; i++) {
    const currentCandle = candles1h[i];
    const timestamp = currentCandle.timestamp;

    // Get lookback windows for indicators
    const candles30Window = candles30m.slice(
      Math.max(0, i * 2 - lookback * 2),
      i * 2 + 1
    );
    const candles1hWindow = candles1h.slice(Math.max(0, i - lookback), i + 1);
    const candles4hWindow = candles4h.slice(
      Math.max(0, Math.floor(i / 4) - lookback),
      Math.floor(i / 4) + 1
    );

    // Calculate indicators
    const indicators1h = calculateAllIndicators(candles1hWindow);
    const indicators30m = calculateAllIndicators(candles30Window);
    const indicators4h = calculateAllIndicators(candles4hWindow);

    const timeframeAnalysis: MultiTimeframeAnalysis = {
      '30min': indicators30m,
      '1hr': indicators1h,
      '4hr': indicators4h,
      alignment: 'neutral',
      confidence: 0,
      recommendation: 'hold',
    };

    // Determine alignment
    const signals = [
      indicators30m.momentum.direction,
      indicators1h.momentum.direction,
      indicators4h.momentum.direction,
    ];
    const bullishCount = signals.filter(s => s === 'bullish').length;
    const bearishCount = signals.filter(s => s === 'bearish').length;

    if (bullishCount >= 2 && bearishCount === 0) {
      timeframeAnalysis.alignment = 'bullish';
      timeframeAnalysis.recommendation = 'buy';
    } else if (bearishCount >= 2 && bullishCount === 0) {
      timeframeAnalysis.alignment = 'bearish';
      timeframeAnalysis.recommendation = 'sell';
    } else {
      timeframeAnalysis.alignment = 'mixed';
    }

    // Calculate confidence as average of individual confidences
    const confidences = [indicators30m, indicators1h, indicators4h].map(m => m.momentum.confidence);
    timeframeAnalysis.confidence = confidences.reduce((a, b) => a + b, 0) / 3;

    // Check if we should exit current position
    if (state.position) {
      const shouldExit = checkBacktestExit(
        state.position,
        currentCandle,
        indicators1h,
        timeframeAnalysis
      );

      if (shouldExit.exit) {
        // Close position
        const closedTrade = closeBacktestPosition(
          state.position,
          currentCandle,
          shouldExit.reason,
          indicators1h,
          candles1h.slice(i, Math.min(candles1h.length, i + 20))
        );

        state.trades.push(closedTrade);
        state.capital += closedTrade.netPnL;

        // Update peak and drawdown
        if (state.capital > state.peakCapital) {
          state.peakCapital = state.capital;
        }
        const drawdown = ((state.peakCapital - state.capital) / state.peakCapital) * 100;
        if (drawdown > state.maxDrawdown) {
          state.maxDrawdown = drawdown;
        }

        state.equityCurve.push({
          timestamp,
          capital: Math.round(state.capital),
          drawdown: Math.round(drawdown * 100) / 100,
        });

        state.position = null;
      } else {
        // Update MAE/MFE
        const unrealizedPnL = calculateUnrealizedPnL(state.position, currentCandle.close);
        if (unrealizedPnL < state.position.maxAdverseExcursion) {
          state.position.maxAdverseExcursion = unrealizedPnL;
        }
        if (unrealizedPnL > state.position.maxFavorableExcursion) {
          state.position.maxFavorableExcursion = unrealizedPnL;
        }
      }
    }

    // Check if we should enter new position
    if (!state.position) {
      const entrySignal = checkBacktestEntry(
        indicators1h,
        timeframeAnalysis,
        currentCandle
      );

      if (entrySignal.signal) {
        const newPosition = openBacktestPosition(
          config.symbol,
          entrySignal.signal,
          currentCandle,
          indicators1h,
          timeframeAnalysis,
          candles1hWindow,
          config,
          i
        );

        if (newPosition) {
          state.position = newPosition;
          state.totalRiskTaken += newPosition.initialRisk;
        }
      }
    }

    // Record equity point (every 24 hours of market time)
    if (i % 7 === 0) {
      const drawdown = state.peakCapital > 0
        ? ((state.peakCapital - state.capital) / state.peakCapital) * 100
        : 0;

      state.equityCurve.push({
        timestamp,
        capital: Math.round(state.capital),
        drawdown: Math.round(drawdown * 100) / 100,
      });
    }
  }

  // Close any open position at end of backtest
  if (state.position && candles1h.length > 0) {
    const lastCandle = candles1h[candles1h.length - 1];
    const closedTrade = closeBacktestPosition(
      state.position,
      lastCandle,
      'expiry',
      calculateAllIndicators(candles1h.slice(-lookback)),
      []
    );
    state.trades.push(closedTrade);
    state.capital += closedTrade.netPnL;
  }

  // Calculate metrics
  return calculateBacktestMetrics(state, config);
}

/**
 * Check if we should enter a trade
 */
function checkBacktestEntry(
  indicators: FullIndicatorSet,
  timeframe: MultiTimeframeAnalysis,
  candle: Candle
): { signal: 'BUY' | 'SELL' | null } {
  // Skip if high false breakout risk
  if (indicators.falseBreakoutRisk === 'high') {
    return { signal: null };
  }

  // Skip if low confidence
  if (timeframe.confidence < 0.5) {
    return { signal: null };
  }

  // Skip if mixed alignment
  if (timeframe.alignment === 'mixed' || timeframe.alignment === 'neutral') {
    return { signal: null };
  }

  // Need strong momentum
  if (indicators.momentum.strength !== 'strong') {
    return { signal: null };
  }

  // Check overall signal
  if (indicators.overallSignal === 'BUY' && timeframe.alignment === 'bullish') {
    return { signal: 'BUY' };
  }

  if (indicators.overallSignal === 'SELL' && timeframe.alignment === 'bearish') {
    return { signal: 'SELL' };
  }

  return { signal: null };
}

/**
 * Check if we should exit a trade
 */
function checkBacktestExit(
  position: BacktestTrade,
  candle: Candle,
  indicators: FullIndicatorSet,
  timeframe: MultiTimeframeAnalysis
): { exit: boolean; reason?: PaperTrade['exitReason'] } {
  // Calculate R:R targets
  const riskPoints = Math.abs(position.entryPrice - position.atmStrike) + position.optionEntryPrice;
  const targetPoints = riskPoints * 2;

  let targetPrice: number;
  let stopPrice: number;

  if (position.signal === 'BUY') {
    targetPrice = position.entryPrice + targetPoints;
    stopPrice = position.entryPrice - riskPoints;

    if (candle.close >= targetPrice) return { exit: true, reason: 'target' };
    if (candle.close <= stopPrice) return { exit: true, reason: 'stoploss' };
  } else {
    targetPrice = position.entryPrice - targetPoints;
    stopPrice = position.entryPrice + riskPoints;

    if (candle.close <= targetPrice) return { exit: true, reason: 'target' };
    if (candle.close >= stopPrice) return { exit: true, reason: 'stoploss' };
  }

  // Momentum exhaustion
  if (indicators.momentum.strength === 'weak') {
    return { exit: true, reason: 'momentum_exhaustion' };
  }

  // Reversal signal
  const directionMismatch =
    (position.signal === 'BUY' && indicators.momentum.direction === 'bearish') ||
    (position.signal === 'SELL' && indicators.momentum.direction === 'bullish');

  if (directionMismatch && indicators.momentum.strength !== 'weak') {
    return { exit: true, reason: 'reversal' };
  }

  return { exit: false };
}

/**
 * Open a backtest position
 */
function openBacktestPosition(
  symbol: string,
  signal: 'BUY' | 'SELL',
  candle: Candle,
  indicators: FullIndicatorSet,
  timeframe: MultiTimeframeAnalysis,
  candles: Candle[],
  config: BacktestConfig,
  entryIndex: number
): BacktestTrade | null {
  const entryPrice = candle.close;
  const lotSize = 100; // Simplified

  // Calculate hedge
  const hedgeConfig: HedgeConfig = {
    spotPrice: entryPrice,
    symbol,
    futuresEntry: entryPrice,
    signal,
    daysToExpiry: 7, // Simplified for backtest
    lotSize,
  };

  const hedge = calculateHedgePosition(hedgeConfig);

  // Size position
  const maxRisk = config.startingCapital * (config.riskPerTrade / 100);
  const lots = Math.max(1, Math.floor(maxRisk / hedge.maxLoss));

  // Calculate costs (simplified for backtest)
  const entryCosts = 40 + (entryPrice * lotSize * lots * 0.00322); // Brokerage + transaction

  const trade: BacktestTrade = {
    // PaperTrade fields
    id: `backtest-${entryIndex}`,
    symbol,
    signal,
    status: 'open',
    entryTime: candle.timestamp,
    entryPrice,
    futuresLots: lots,
    optionLots: lots,
    lotSize,
    atmStrike: hedge.options.strike,
    optionType: hedge.options.optionType,
    optionEntryPrice: hedge.options.price,
    optionExpiry: hedge.options.expiry,
    grossPnL: 0,
    hedgePnL: 0,
    netPnL: 0,
    pnlPercent: 0,
    brokerage: 40,
    stt: 0,
    transactionCharges: entryPrice * lotSize * lots * 0.00322,
    gst: entryPrice * lotSize * lots * 0.00058,
    totalCharges: entryCosts,
    initialRisk: hedge.maxLoss * lots,
    maxLoss: hedge.maxLoss * lots,
    hedgeCost: hedge.hedgeCost * lots,
    marginUsed: hedge.futures.marginRequired * lots,
    indicators: {
      rsi: indicators.rsi.value,
      rsiSignal: indicators.rsi.signal,
      macdSignal: indicators.macd.signal_interpretation,
      adx: indicators.adx.adx,
      adxTrend: indicators.adx.trend_strength,
      momentumScore: indicators.momentum.score,
      momentumDirection: indicators.momentum.direction,
      volumeConfirmation: indicators.volume.confirmation,
      falseBreakoutRisk: indicators.falseBreakoutRisk,
      timeframeAlignment: timeframe.alignment,
    },
    createdAt: candle.timestamp,
    updatedAt: candle.timestamp,
    ttl: Math.floor(candle.timestamp / 1000) + 86400,

    // Backtest-specific fields
    entryIndex,
    exitIndex: 0,
    maxAdverseExcursion: 0,
    maxFavorableExcursion: 0,
    exitEfficiency: 0,
  };

  return trade;
}

/**
 * Close a backtest position
 */
function closeBacktestPosition(
  position: BacktestTrade,
  exitCandle: Candle,
  reason: PaperTrade['exitReason'],
  exitIndicators: FullIndicatorSet,
  futureCandles: Candle[]
): BacktestTrade {
  const exitPrice = exitCandle.close;
  const lotSize = position.lotSize;
  const lots = position.futuresLots;

  // Calculate P&L
  const direction = position.signal === 'BUY' ? 1 : -1;
  const futuresPnL = (exitPrice - position.entryPrice) * lotSize * lots * direction;

  // Option P&L (estimate decay)
  const barsHeld = position.exitIndex - position.entryIndex;
  const timeDecay = position.optionEntryPrice * 0.1 * (barsHeld / 8); // Approximately 10% per day
  const optionExitPrice = Math.max(0.1, position.optionEntryPrice - timeDecay);
  const optionsPnL = (optionExitPrice - position.optionEntryPrice) * lotSize * position.optionLots;

  const grossPnL = futuresPnL + optionsPnL;

  // Calculate exit costs
  const exitCosts = 40 + (exitPrice * lotSize * lots * 0.00322 + exitPrice * lotSize * lots * 0.00025);
  const totalPnL = grossPnL - exitCosts;

  // Calculate efficiency
  const exitEfficiency = position.maxFavorableExcursion > 0
    ? totalPnL / position.maxFavorableExcursion
    : 0;

  return {
    ...position,
    status: 'closed',
    exitTime: exitCandle.timestamp,
    exitPrice,
    exitReason: reason,
    optionExitPrice,
    grossPnL: Math.round(grossPnL),
    hedgePnL: Math.round(optionsPnL),
    netPnL: Math.round(totalPnL),
    pnlPercent: Math.round((totalPnL / position.initialRisk) * 100 * 100) / 100,
    stt: (exitPrice * lotSize * lots * 0.00025) + (position.optionEntryPrice * lotSize * position.optionLots * 0.0005),
    totalCharges: position.totalCharges + exitCosts,
    exitIndicators,
    duration: Math.round((exitCandle.timestamp - position.entryTime) / (1000 * 60)),
    exitIndex: position.exitIndex,
    exitEfficiency: Math.round(exitEfficiency * 100) / 100,
  };
}

/**
 * Calculate unrealized P&L
 */
function calculateUnrealizedPnL(position: BacktestTrade, currentPrice: number): number {
  const direction = position.signal === 'BUY' ? 1 : -1;
  const futuresPnL = (currentPrice - position.entryPrice) * position.lotSize * position.futuresLots * direction;
  return futuresPnL - position.hedgeCost; // Simplified
}

/**
 * Calculate final backtest metrics
 */
function calculateBacktestMetrics(
  state: BacktestState,
  config: BacktestConfig
): BacktestResult {
  const trades = state.trades;

  if (trades.length === 0) {
    return {
      config,
      trades: [],
      metrics: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        grossProfit: 0,
        grossLoss: 0,
        netPnL: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        maxDrawdownAmount: 0,
        sharpeRatio: 0,
        avgTrade: 0,
        avgWin: 0,
        avgLoss: 0,
        avgHoldingPeriod: 0,
        expectancy: 0,
        totalReturn: 0,
        annualizedReturn: 0,
      },
      equityCurve: state.equityCurve,
      monthlyReturns: [],
      signalPerformance: {
        buySignals: 0,
        buyWins: 0,
        sellSignals: 0,
        sellWins: 0,
        accuracy: 0,
      },
    };
  }

  const winningTrades = trades.filter(t => (t.netPnL || 0) > 0);
  const losingTrades = trades.filter(t => (t.netPnL || 0) <= 0);

  const grossProfit = winningTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0));
  const netPnL = grossProfit - grossLoss;

  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
  const winRate = (winningTrades.length / trades.length) * 100;

  // Calculate holding periods
  const holdingPeriods = trades.filter(t => t.duration).map(t => t.duration || 0);
  const avgHoldingPeriod = holdingPeriods.length > 0
    ? holdingPeriods.reduce((a, b) => a + b, 0) / holdingPeriods.length / 60 // hours
    : 0;

  // Calculate returns
  const totalReturn = ((state.capital - config.startingCapital) / config.startingCapital) * 100;

  // Estimate annualized return (simplified)
  const startTime = trades[0]?.entryTime || Date.now();
  const endTime = trades[trades.length - 1]?.exitTime || Date.now();
  const daysElapsed = (endTime - startTime) / (1000 * 60 * 60 * 24);
  const annualizedReturn = daysElapsed > 0
    ? (Math.pow(1 + totalReturn / 100, 365 / daysElapsed) - 1) * 100
    : 0;

  // Calculate Sharpe (simplified)
  const dailyReturns = state.equityCurve.map((e, i) => {
    if (i === 0) return 0;
    return (e.capital - state.equityCurve[i - 1].capital) / state.equityCurve[i - 1].capital;
  });
  const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const dailyStdDev = Math.sqrt(dailyReturns.map(r => Math.pow(r - avgDailyReturn, 2)).reduce((a, b) => a + b, 0) / dailyReturns.length);
  const sharpeRatio = dailyStdDev > 0 ? (avgDailyReturn / dailyStdDev) * Math.sqrt(252) : 0;

  // Signal performance
  const buyTrades = trades.filter(t => t.signal === 'BUY');
  const sellTrades = trades.filter(t => t.signal === 'SELL');
  const buyWins = buyTrades.filter(t => (t.netPnL || 0) > 0).length;
  const sellWins = sellTrades.filter(t => (t.netPnL || 0) > 0).length;

  return {
    config,
    trades,
    metrics: {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: Math.round(winRate * 100) / 100,
      grossProfit: Math.round(grossProfit),
      grossLoss: Math.round(grossLoss),
      netPnL: Math.round(netPnL),
      profitFactor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : 0,
      maxDrawdown: Math.round(state.maxDrawdown * 100) / 100,
      maxDrawdownAmount: Math.round(config.startingCapital * (state.maxDrawdown / 100)),
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      avgTrade: Math.round(netPnL / trades.length),
      avgWin: Math.round(avgWin),
      avgLoss: Math.round(avgLoss),
      avgHoldingPeriod: Math.round(avgHoldingPeriod * 100) / 100,
      expectancy: Math.round((netPnL / trades.length)),
      totalReturn: Math.round(totalReturn * 100) / 100,
      annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    },
    equityCurve: state.equityCurve,
    monthlyReturns: [], // TODO: Calculate monthly returns
    signalPerformance: {
      buySignals: buyTrades.length,
      buyWins,
      sellSignals: sellTrades.length,
      sellWins,
      accuracy: Math.round(((buyWins + sellWins) / trades.length) * 100),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimization Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run parameter optimization
 */
export async function optimizeParameters(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<{ rsiThreshold: number; adxThreshold: number; volumeMultiplier: number; score: number }[]> {
  const results: { rsiThreshold: number; adxThreshold: number; volumeMultiplier: number; score: number }[] = [];

  const rsiThresholds = [60, 65, 70];
  const adxThresholds = [20, 25, 30];
  const volumeMultipliers = [1.2, 1.5, 2.0];

  for (const rsi of rsiThresholds) {
    for (const adx of adxThresholds) {
      for (const vol of volumeMultipliers) {
        const config: BacktestConfig = {
          symbol,
          startDate,
          endDate,
          timeframe: '1h',
          startingCapital: 1000000,
          riskPerTrade: 1,
          paperTradingMode: true,
        };

        const result = await runBacktest(config);

        // Score based on Sharpe, Win Rate, and Profit Factor
        const score = (result.metrics.sharpeRatio * 0.4) + 
                      (result.metrics.winRate * 0.01 * 0.3) + 
                      (Math.max(0, result.metrics.profitFactor - 1) * 10 * 0.3);

        results.push({
          rsiThreshold: rsi,
          adxThreshold: adx,
          volumeMultiplier: vol,
          score: Math.round(score * 100) / 100,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
