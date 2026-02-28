/**
 * Paper Trading Handler for Momentum Trading System
 * Simulates trades, tracks P&L, manages virtual portfolio
 */

import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TableNames } from '../utils/db.js';
import { getTradingRules, DEFAULT_TRADING_CONFIG, TradingConfig } from '../prime-intelligence.js';
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
  SpreadPosition,
  HedgeStrategyType,
  calculateHedgePosition,
  calculateSpreadPosition,
  selectHedgeStrategy,
  calculateHedgedPnL,
  LOT_SIZES,
} from './hedging.js';
import { createBrokerAdapter } from '../nifty-straddle/adapters/adapter-factory.js';
import type { BrokerName } from '../nifty-straddle/broker-adapter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types and Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface PaperTrade {
  id: string;
  symbol: string;
  signal: 'BUY' | 'SELL';
  status: 'open' | 'closed';
  entryTime: number;
  exitTime?: number;
  entryPrice: number;
  exitPrice?: number;
  exitReason?: 'target' | 'stoploss' | 'momentum_exhaustion' | 'reversal' | 'manual' | 'expiry';
  
  // Position details
  futuresLots: number;
  optionLots: number;
  lotSize: number;
  
  // Hedge details
  atmStrike: number;
  optionType: 'CE' | 'PE';
  optionEntryPrice: number;
  optionExitPrice?: number;
  optionExpiry: string;
  
  // P&L
  grossPnL: number;
  hedgePnL: number;
  netPnL: number;
  pnlPercent: number;
  
  // Trading costs (Zerodha rates)
  brokerage: number;
  stt: number;
  transactionCharges: number;
  gst: number;
  totalCharges: number;
  
  // Risk metrics
  initialRisk: number;
  maxLoss: number;
  hedgeCost: number;
  marginUsed: number;
  
  // Indicator state at entry
  indicators: {
    rsi: number;
    rsiSignal: string;
    macdSignal: string;
    adx: number;
    adxTrend: string;
    momentumScore: number;
    momentumDirection: string;
    volumeConfirmation: boolean;
    falseBreakoutRisk: string;
    timeframeAlignment: string;
  };
  
  // Exit analysis
  exitIndicators?: FullIndicatorSet;
  duration?: number; // minutes
  
  // Segment
  segment?: 'FUTURES' | 'CASH';
  /** Number of shares (only set for CASH segment trades) */
  shares?: number;

  // Live trading fields
  mode?: 'paper' | 'live';
  liveOrderId?: string;
  liveExitOrderId?: string;
  broker?: string;

  // Metadata
  createdAt: number;
  updatedAt: number;
  ttl: number;
}

export interface PortfolioState {
  capital: number;
  startingCapital: number;
  availableCapital: number;
  marginUsed: number;
  totalPnl: number;
  unrealizedPnl: number;  // Current unrealized P&L from open trades
  dayPnl: number;
  openPositions: number;
  closedTrades: number;
  winRate: number;
  maxDrawdown: number;
  peakCapital: number;
  lastUpdated: number;

  // Risk tracking
  dailyLossLimit: number;
  dailyLossUsed: number;
  maxRiskPerTrade: number;
  currentRisk: number;

  // Exposure
  sectorExposure: Record<string, number>;
  symbolExposure: Record<string, number>;
}

export interface TradeEntryRequest {
  symbol: string;
  signal: 'BUY' | 'SELL';
  entryPrice: number;
  indicators: FullIndicatorSet;
  timeframeAnalysis: MultiTimeframeAnalysis;
  candles: Candle[];
  userId?: string;
}

export interface TradeExitRequest {
  tradeId: string;
  exitPrice: number;
  exitReason: PaperTrade['exitReason'];
  currentIndicators?: FullIndicatorSet;
  optionMarketPrice?: number;
  userId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Paper Trading Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const PAPER_TRADING_CONFIG = {
  STARTING_CAPITAL: 1000000, // ₹10,00,000
  MAX_RISK_PER_TRADE_PCT: 2.0, // 2% = ₹20,000
  DAILY_LOSS_LIMIT_PCT: 5.0, // 5% daily max loss (₹5,000)
  MAX_POSITIONS: 3, // Reduced for smaller capital
  MAX_SECTOR_EXPOSURE_PCT: 30, // Allow higher sector exposure
  BROKERAGE_PER_ORDER: 20, // Zerodha flat ₹20 per order
  STT_FUTURES_PCT: 0.025, // 0.025% on sell side
  STT_OPTIONS_PCT: 0.05, // 0.05% on sell side
  TRANSACTION_CHARGES_PCT: 0.00322, // NSE charges
  GST_PCT: 18, // 18% on brokerage + transaction charges
  MAX_TRADE_DURATION_HOURS: 24, // Force exit after 24 hours for paper trading
  HEDGE_ENABLED: true, // Enable hedging with ATM put options
};

/**
 * Load user-specific trading config from DynamoDB, merged with defaults.
 * Falls back to PAPER_TRADING_CONFIG values if no user config exists.
 */
export async function getUserConfig(userId?: string): Promise<TradingConfig> {
  if (!userId) return DEFAULT_TRADING_CONFIG;
  try {
    const rules = await getTradingRules(userId);
    return { ...DEFAULT_TRADING_CONFIG, ...(rules.config || {}) };
  } catch {
    return DEFAULT_TRADING_CONFIG;
  }
}

// Sector mapping for correlation checks
export const SECTOR_MAP: Record<string, string> = {
  'RELIANCE': 'Energy',
  'ONGC': 'Energy',
  'BPCL': 'Energy',
  'IOC': 'Energy',
  'GAIL': 'Energy',
  'TCS': 'IT',
  'INFY': 'IT',
  'WIPRO': 'IT',
  'HCLTECH': 'IT',
  'TECHM': 'IT',
  'HDFCBANK': 'Banking',
  'ICICIBANK': 'Banking',
  'SBIN': 'Banking',
  'AXISBANK': 'Banking',
  'KOTAKBANK': 'Banking',
  'BANDHANBNK': 'Banking',
  'FEDERALBNK': 'Banking',
  'PNB': 'Banking',
  'CANBK': 'Banking',
  'BANKBARODA': 'Banking',
  'INDUSINDBK': 'Banking',
  'YESBANK': 'Banking',
  'IDFCFIRSTB': 'Banking',
  'BAJFINANCE': 'Finance',
  'BAJAJFINSV': 'Finance',
  'SBILIFE': 'Finance',
  'HDFCLIFE': 'Finance',
  'HAL': 'Defense',
  'BDL': 'Defense',
  'LT': 'Infrastructure',
  'POWERGRID': 'Infrastructure',
  'NTPC': 'Infrastructure',
  'TATAMOTORS': 'Auto',
  'MARUTI': 'Auto',
  'M&M': 'Auto',
  'HEROMOTOCO': 'Auto',
  'EICHERMOT': 'Auto',
  'HINDUNILVR': 'FMCG',
  'ITC': 'FMCG',
  'TATACONSUM': 'FMCG',
  'NESTLEIND': 'FMCG',
  'BRITANNIA': 'FMCG',
  'BHARTIARTL': 'Telecom',
  'ADANIENT': 'Conglomerate',
  'SUNPHARMA': 'Pharma',
  'DRREDDY': 'Pharma',
  'CIPLA': 'Pharma',
  'DIVISLAB': 'Pharma',
  'APOLLOHOSP': 'Healthcare',
  'ULTRACEMCO': 'Cement',
  'GRASIM': 'Cement',
  'SHREECEM': 'Cement',
  'TATACHEM': 'Chemicals',
  'PIDILITIND': 'Chemicals',
  'ASIANPAINT': 'Paints',
  'TITAN': 'Consumer',
  'JSWSTEEL': 'Metals',
  'TATASTEEL': 'Metals',
  'HINDALCO': 'Metals',
  'VEDL': 'Metals',
  'NATIONALUM': 'Metals',
};

// ─────────────────────────────────────────────────────────────────────────────
// DynamoDB Operations
// ─────────────────────────────────────────────────────────────────────────────

const STAGE = process.env.STAGE || 'prod';
const MOMENTUM_TRADES_TABLE = process.env.MOMENTUM_TRADES_TABLE || `momentum-trades-${STAGE}`;
const MOMENTUM_PORTFOLIO_TABLE = process.env.MOMENTUM_PORTFOLIO_TABLE || `momentum-portfolio-${STAGE}`;
const MOMENTUM_SIGNALS_TABLE = process.env.MOMENTUM_SIGNALS_TABLE || `momentum-signals-${STAGE}`;

// Default userId for backwards compatibility
const DEFAULT_USER_ID = 'GLOBAL';

/**
 * Initialize or get portfolio state (user-scoped)
 */
export async function getPortfolioState(userId?: string): Promise<PortfolioState> {
  const user = userId || DEFAULT_USER_ID;
  try {
    // Try to get existing portfolio
    const result = await docClient.send(new QueryCommand({
      TableName: MOMENTUM_PORTFOLIO_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${user}#PORTFOLIO#MAIN`,
      },
      Limit: 1,
      ScanIndexForward: false,
    }));

    if (result.Items && result.Items.length > 0) {
      const portfolio = result.Items[0] as PortfolioState;

      // Reset daily counters if the portfolio was last saved on a previous trading day (IST)
      const lastDate = new Date(portfolio.lastUpdated || 0);
      const now = new Date();
      const toISTDateStr = (d: Date) => {
        const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
        return ist.toISOString().slice(0, 10);
      };
      if (toISTDateStr(lastDate) !== toISTDateStr(now)) {
        console.log(`[Portfolio] New trading day detected — resetting dayPnl (${portfolio.dayPnl}) and dailyLossUsed (${portfolio.dailyLossUsed})`);
        portfolio.dayPnl = 0;
        portfolio.dailyLossUsed = 0;
        await savePortfolioState(portfolio, user);
      }

      // Reconcile availableCapital against actual open trades to prevent stale-state rejections
      try {
        const openTrades = await getOpenTrades(user);
        const actualMarginUsed = openTrades.reduce((sum, t) => sum + (t.marginUsed || 0), 0);
        const baseCapital = (portfolio.startingCapital || PAPER_TRADING_CONFIG.STARTING_CAPITAL) + (portfolio.totalPnl || 0);
        const reconciledAvailable = baseCapital - actualMarginUsed;

        if (Math.abs(portfolio.availableCapital - reconciledAvailable) > 1000) {
          console.log(`[Portfolio] Reconciling stale capital: stored=₹${Math.round(portfolio.availableCapital)}, actual=₹${Math.round(reconciledAvailable)}, openTrades=${openTrades.length}, marginUsed=₹${Math.round(actualMarginUsed)}`);
          portfolio.availableCapital = reconciledAvailable;
          portfolio.marginUsed = actualMarginUsed;
          portfolio.openPositions = openTrades.length;
          portfolio.capital = baseCapital;
        }
      } catch {
        // If reconciliation fails, continue with stored values
      }

      return portfolio;
    }
  } catch {
    // Table might not exist, continue to create new
  }

  // Create new portfolio
  const newPortfolio: PortfolioState = {
    capital: PAPER_TRADING_CONFIG.STARTING_CAPITAL,
    startingCapital: PAPER_TRADING_CONFIG.STARTING_CAPITAL,
    availableCapital: PAPER_TRADING_CONFIG.STARTING_CAPITAL,
    marginUsed: 0,
    totalPnl: 0,
    unrealizedPnl: 0,
    dayPnl: 0,
    openPositions: 0,
    closedTrades: 0,
    winRate: 0,
    maxDrawdown: 0,
    peakCapital: PAPER_TRADING_CONFIG.STARTING_CAPITAL,
    lastUpdated: Date.now(),
    dailyLossLimit: PAPER_TRADING_CONFIG.STARTING_CAPITAL * (PAPER_TRADING_CONFIG.DAILY_LOSS_LIMIT_PCT / 100),
    dailyLossUsed: 0,
    maxRiskPerTrade: PAPER_TRADING_CONFIG.STARTING_CAPITAL * (PAPER_TRADING_CONFIG.MAX_RISK_PER_TRADE_PCT / 100),
    currentRisk: 0,
    sectorExposure: {},
    symbolExposure: {},
  };

  await savePortfolioState(newPortfolio, user);
  return newPortfolio;
}

/**
 * Save portfolio state to DynamoDB (user-scoped)
 */
async function savePortfolioState(portfolio: PortfolioState, userId?: string): Promise<void> {
  const user = userId || DEFAULT_USER_ID;
  await docClient.send(new PutCommand({
    TableName: MOMENTUM_PORTFOLIO_TABLE,
    Item: {
      pk: `USER#${user}#PORTFOLIO#MAIN`,
      sk: `TIMESTAMP#${Date.now()}`,
      userId: user,
      ...portfolio,
      ttl: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days retention
    },
  }));
}

/**
 * Save trade to DynamoDB (user-scoped)
 */
async function saveTrade(trade: PaperTrade, userId?: string): Promise<void> {
  const user = userId || (trade as any).userId || DEFAULT_USER_ID;
  await docClient.send(new PutCommand({
    TableName: MOMENTUM_TRADES_TABLE,
    Item: {
      pk: `USER#${user}#TRADE#${trade.id}`,
      sk: `STATUS#${trade.status}#${trade.entryTime}`,
      gsi1pk: `USER#${user}#SYMBOL#${trade.symbol}`,
      gsi1sk: trade.entryTime,
      userId: user,
      ...trade,
      ttl: Math.floor(Date.now() / 1000) + 86400 * 90, // 90 days retention
    },
  }));
}

/**
 * Get open trades (user-scoped)
 */
export async function getOpenTrades(userId?: string): Promise<PaperTrade[]> {
  const user = userId || DEFAULT_USER_ID;
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: MOMENTUM_TRADES_TABLE,
      FilterExpression: '#status = :status AND #userId = :userId',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#userId': 'userId',
      },
      ExpressionAttributeValues: {
        ':status': 'open',
        ':userId': user,
      },
    }));

    return (result.Items || []) as PaperTrade[];
  } catch {
    return [];
  }
}

/**
 * Get trade by ID (user-scoped)
 */
export async function getTradeById(tradeId: string, userId?: string): Promise<PaperTrade | null> {
  const user = userId || DEFAULT_USER_ID;
  try {
    // Query for the trade with user prefix
    const result = await docClient.send(new QueryCommand({
      TableName: MOMENTUM_TRADES_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${user}#TRADE#${tradeId}`,
      },
    }));

    if (result.Items && result.Items.length > 0) {
      return result.Items[0] as PaperTrade;
    }

    // Fallback: Try without user prefix for backwards compatibility
    const legacyResult = await docClient.send(new QueryCommand({
      TableName: MOMENTUM_TRADES_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `TRADE#${tradeId}`,
      },
    }));

    return (legacyResult.Items?.[0] as PaperTrade) || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate trading costs for a trade
 */
function calculateTradingCosts(
  futuresValue: number,
  optionsValue: number,
  isEntry: boolean
): { brokerage: number; stt: number; transactionCharges: number; gst: number; total: number } {
  // Brokerage: flat ₹20 per order
  const brokerage = PAPER_TRADING_CONFIG.BROKERAGE_PER_ORDER * 2; // Futures + Options orders

  // STT: Only on sell side
  let stt = 0;
  if (!isEntry) {
    stt = (futuresValue * PAPER_TRADING_CONFIG.STT_FUTURES_PCT / 100) +
          (optionsValue * PAPER_TRADING_CONFIG.STT_OPTIONS_PCT / 100);
  }

  // Transaction charges
  const transactionCharges = (futuresValue + optionsValue) * PAPER_TRADING_CONFIG.TRANSACTION_CHARGES_PCT / 100;

  // GST on brokerage + transaction charges
  const gst = (brokerage + transactionCharges) * PAPER_TRADING_CONFIG.GST_PCT / 100;

  return {
    brokerage,
    stt: Math.round(stt * 100) / 100,
    transactionCharges: Math.round(transactionCharges * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    total: Math.round((brokerage + stt + transactionCharges + gst) * 100) / 100,
  };
}

/**
 * Trading costs for cash/equity intraday (MIS) trades — Zerodha rates.
 * @param tradeValue  entryPrice × shares
 * @param isSell      true on exit (STT only on sell side for intraday equity)
 */
function calculateCashTradingCosts(tradeValue: number, isSell: boolean) {
  const brokerage = PAPER_TRADING_CONFIG.BROKERAGE_PER_ORDER; // ₹20 flat per leg
  const stt = isSell ? tradeValue * 0.00025 : 0; // 0.025% on sell side (intraday equity MIS)
  const transactionCharges = tradeValue * 0.0000322; // NSE equity 0.00322%
  const gst = (brokerage + transactionCharges) * PAPER_TRADING_CONFIG.GST_PCT / 100;
  return {
    brokerage,
    stt: Math.round(stt * 100) / 100,
    transactionCharges: Math.round(transactionCharges * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    total: Math.round((brokerage + stt + transactionCharges + gst) * 100) / 100,
  };
}

/**
 * Validate entry conditions and execute paper trade (user-scoped)
 */
export async function enterTrade(request: TradeEntryRequest): Promise<{ success: boolean; trade?: PaperTrade; error?: string }> {
  const { symbol, signal, entryPrice, indicators, timeframeAnalysis, candles, userId } = request;
  const user = userId || DEFAULT_USER_ID;

  // Load user-specific trading config
  const config = await getUserConfig(user);

  // 1. Validate signal quality
  if (config.rejectHighFalseBreakout && indicators.falseBreakoutRisk === 'high') {
    return { success: false, error: 'High false breakout risk - trade rejected' };
  }

  if (timeframeAnalysis.confidence < (config.minTimeframeConfidence / 100)) {
    return { success: false, error: 'Low multi-timeframe confidence - trade rejected' };
  }

  if (timeframeAnalysis.alignment === 'mixed' || timeframeAnalysis.alignment === 'neutral') {
    return { success: false, error: 'Timeframes not aligned - trade rejected' };
  }

  // 2. Get portfolio state (user-scoped)
  const portfolio = await getPortfolioState(user);

  // 3. Check risk limits
  if (portfolio.openPositions >= config.maxPositions) {
    return { success: false, error: 'Max positions reached - trade rejected' };
  }

  if (portfolio.dailyLossUsed >= portfolio.dailyLossLimit) {
    return { success: false, error: 'Daily loss limit hit - trading halted for day' };
  }

  // 4. Check correlation/exposure
  const sector = SECTOR_MAP[symbol.toUpperCase()] || 'Other';
  const currentSectorExposure = portfolio.sectorExposure[sector] || 0;
  if (currentSectorExposure >= config.maxSectorExposurePct) {
    return { success: false, error: `Max exposure for ${sector} sector - trade rejected` };
  }

  // 5. Calculate hedge position
  const lotSize = LOT_SIZES[symbol.toUpperCase()] || 100;
  const daysToExpiry = findNearestExpiry();

  // Use realistic implied vol based on momentum — mid/small-caps run hotter than 25%
  const impliedVol = Math.abs(momentum5d) > 5 ? 0.45
    : Math.abs(momentum5d) > 3 ? 0.35
    : 0.28;

  const hedgeConfig: HedgeConfig = {
    spotPrice: entryPrice,
    symbol,
    futuresEntry: entryPrice,
    signal,
    daysToExpiry,
    lotSize,
    volatility: impliedVol,
  };

  const hedgePosition = calculateHedgePosition(hedgeConfig);

  // 6. Calculate position sizing based on risk
  const maxRisk = config.startingCapital * (config.maxRiskPerTradePct / 100);
  const riskPerLot = hedgePosition.maxLoss;
  const marginPerLot = hedgePosition.futures.marginRequired + hedgePosition.hedgeCost;
  // Cap by risk budget, hard 5-lot cap, and ₹1,00,000 max margin per trade
  const lotsByRisk = Math.max(1, Math.floor(maxRisk / riskPerLot));
  const lotsByMargin = marginPerLot > 0 ? Math.max(1, Math.floor(100000 / marginPerLot)) : 5;
  const optimalLots = Math.min(5, lotsByRisk, lotsByMargin);

  // 7. Check capital availability
  const capitalRequired = marginPerLot * optimalLots;
  if (capitalRequired > portfolio.availableCapital) {
    return { success: false, error: 'Insufficient capital for trade' };
  }

  // 8. Calculate trading costs
  const futuresValue = entryPrice * lotSize * optimalLots;
  const optionsValue = hedgePosition.options.price * lotSize * optimalLots;
  const costs = calculateTradingCosts(futuresValue, optionsValue, true);

  // 9. Create trade object
  const tradeId = `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  const trade: PaperTrade = {
    id: tradeId,
    symbol,
    signal,
    status: 'open',
    entryTime: now,
    entryPrice,
    futuresLots: optimalLots,
    optionLots: optimalLots,
    lotSize,
    atmStrike: hedgePosition.options.strike,
    optionType: hedgePosition.options.optionType,
    optionEntryPrice: hedgePosition.options.price,
    optionExpiry: hedgePosition.options.expiry,
    grossPnL: 0,
    hedgePnL: 0,
    netPnL: 0,
    pnlPercent: 0,
    brokerage: costs.brokerage,
    stt: 0, // Entry has no STT
    transactionCharges: costs.transactionCharges,
    gst: costs.gst,
    totalCharges: costs.total,
    initialRisk: riskPerLot * optimalLots,
    maxLoss: hedgePosition.maxLoss * optimalLots,
    hedgeCost: hedgePosition.hedgeCost * optimalLots,
    marginUsed: hedgePosition.futures.marginRequired * optimalLots,
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
      timeframeAlignment: timeframeAnalysis.alignment,
    },
    createdAt: now,
    updatedAt: now,
    ttl: Math.floor(now / 1000) + 86400 * 7,
  };

  // 10. Update portfolio
  portfolio.availableCapital -= capitalRequired;
  portfolio.marginUsed += hedgePosition.futures.marginRequired * optimalLots;
  portfolio.currentRisk += riskPerLot * optimalLots;
  portfolio.openPositions += 1;
  portfolio.symbolExposure[symbol] = (portfolio.symbolExposure[symbol] || 0) + 1;
  portfolio.sectorExposure[sector] = (portfolio.sectorExposure[sector] || 0) + (futuresValue / portfolio.capital * 100);
  portfolio.lastUpdated = now;

  // 11. Save to DynamoDB (user-scoped)
  await saveTrade(trade, user);
  await savePortfolioState(portfolio, user);

  // 12. Log signal (user-scoped)
  await logSignal({
    symbol,
    signal,
    entryPrice,
    indicators,
    timeframeAnalysis,
    tradeId,
    timestamp: now,
    userId: user,
  });

  return { success: true, trade };
}

/**
 * Log trading signal for analysis (user-scoped)
 */
async function logSignal(data: {
  symbol: string;
  signal: 'BUY' | 'SELL';
  entryPrice: number;
  indicators: FullIndicatorSet;
  timeframeAnalysis: MultiTimeframeAnalysis;
  tradeId: string;
  timestamp: number;
  userId?: string;
}): Promise<void> {
  const user = data.userId || DEFAULT_USER_ID;
  await docClient.send(new PutCommand({
    TableName: MOMENTUM_SIGNALS_TABLE,
    Item: {
      pk: `USER#${user}#SIGNAL#${data.symbol}`,
      sk: `TIME#${data.timestamp}`,
      userId: user,
      symbol: data.symbol,
      signal: data.signal,
      entryPrice: data.entryPrice,
      rsi: data.indicators.rsi.value,
      macd: data.indicators.macd.macd,
      adx: data.indicators.adx.adx,
      momentumScore: data.indicators.momentum.score,
      confidence: data.timeframeAnalysis.confidence,
      alignment: data.timeframeAnalysis.alignment,
      tradeId: data.tradeId,
      timestamp: data.timestamp,
      ttl: Math.floor(data.timestamp / 1000) + 86400 * 30,
    },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Simplified Entry for Scan-Based / Chat-Based Trades
// ─────────────────────────────────────────────────────────────────────────────

export interface SimplifiedTradeRequest {
  symbol: string;
  signal: 'BUY' | 'SELL';
  entryPrice: number;
  rsi: number;
  rsiSignal: string;
  trend: string;
  trendStrength?: string;
  momentum5d: number;
  support: number;
  resistance: number;
  volumeSurge: boolean;
  score: number; // 0-100 scan score
  conviction: 'HIGH' | 'MEDIUM' | 'LOW';
  triggerSource: 'prime_scan' | 'prime_chat' | 'auto';
  rationale: string;
  userId?: string;
  /** 'CASH' = direct equity buy/sell, no hedging. Defaults to 'FUTURES'. */
  segment?: 'FUTURES' | 'CASH';
  /** Explicit stop-loss price for position sizing in cash trades */
  stopLoss?: number;
}

/**
 * Enter a hedged paper trade from scan results or Prime chat commands.
 * Constructs the required indicator data from simplified scan params,
 * selects the optimal hedging strategy based on conviction/conditions,
 * and executes the trade.
 */
export async function enterTradeFromScan(
  request: SimplifiedTradeRequest
): Promise<{ success: boolean; trade?: PaperTrade; strategy?: SpreadPosition; error?: string }> {
  const {
    symbol, signal, entryPrice, rsi, rsiSignal, trend, trendStrength = 'moderate',
    momentum5d, support, resistance, volumeSurge, score, conviction,
    triggerSource, rationale, userId, segment = 'FUTURES', stopLoss,
  } = request;
  const user = userId || DEFAULT_USER_ID;

  // ── CASH SEGMENT PATH (no hedging) ─────────────────────────────────────────
  if (segment === 'CASH') {
    const config = await getUserConfig(user);
    const portfolio = await getPortfolioState(user);

    if (portfolio.openPositions >= config.maxPositions) {
      return { success: false, error: `Max positions (${config.maxPositions}) reached.` };
    }
    if (portfolio.dailyLossUsed >= portfolio.dailyLossLimit) {
      return { success: false, error: 'Daily loss limit hit. Trading halted for today.' };
    }
    const sector = SECTOR_MAP[symbol.toUpperCase()] || 'Other';
    if ((portfolio.sectorExposure[sector] || 0) >= config.maxSectorExposurePct) {
      return { success: false, error: `Max exposure for ${sector} sector reached.` };
    }

    // Position sizing: risk-based using stop-loss distance
    const sl = stopLoss ?? (signal === 'BUY' ? support : resistance);
    const stopDistance = Math.abs(entryPrice - sl);
    const maxRisk = config.startingCapital * (config.maxRiskPerTradePct / 100);
    // shares from risk, capped at 20% of available capital, and hard ₹1L notional cap
    const sharesByRisk = stopDistance > 0 ? Math.floor(maxRisk / stopDistance) : 1;
    const sharesByCap  = Math.floor((portfolio.availableCapital * 0.20) / entryPrice);
    const sharesByMarginCap = Math.max(1, Math.floor(100000 / entryPrice)); // ₹1L max notional
    const shares = Math.max(1, Math.min(sharesByRisk, sharesByCap, sharesByMarginCap));
    const capitalRequired = entryPrice * shares;

    if (capitalRequired > portfolio.availableCapital) {
      return { success: false, error: `Insufficient capital. Need ₹${Math.round(capitalRequired).toLocaleString()}, available ₹${Math.round(portfolio.availableCapital).toLocaleString()}.` };
    }

    const entryCosts = calculateCashTradingCosts(capitalRequired, false);
    const initialRisk = stopDistance * shares;

    const tradeId = `cash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const trade: PaperTrade = {
      id: tradeId,
      symbol,
      signal,
      status: 'open',
      entryTime: now,
      entryPrice,
      segment: 'CASH',
      shares,
      // Futures/option fields set to 0 — not applicable for cash trades
      futuresLots: 0,
      optionLots: 0,
      lotSize: 1,
      atmStrike: 0,
      optionType: signal === 'BUY' ? 'PE' : 'CE', // placeholder
      optionEntryPrice: 0,
      optionExpiry: '',
      grossPnL: 0,
      hedgePnL: 0,
      netPnL: 0,
      pnlPercent: 0,
      brokerage: entryCosts.brokerage,
      stt: entryCosts.stt,
      transactionCharges: entryCosts.transactionCharges,
      gst: entryCosts.gst,
      totalCharges: entryCosts.total,
      initialRisk,
      maxLoss: initialRisk,
      hedgeCost: 0,
      marginUsed: capitalRequired,
      indicators: {
        rsi,
        rsiSignal,
        macdSignal: trend.includes('bull') ? 'bullish_crossover' : trend.includes('bear') ? 'bearish_crossover' : 'neutral',
        adx: score > 80 ? 30 : score > 60 ? 22 : 15,
        adxTrend: trendStrength === 'strong' ? 'strong' : trendStrength === 'moderate' ? 'moderate' : 'weak',
        momentumScore: score,
        momentumDirection: signal === 'BUY' ? 'bullish' : 'bearish',
        volumeConfirmation: volumeSurge,
        falseBreakoutRisk: score > 80 ? 'low' : score > 60 ? 'medium' : 'high',
        timeframeAlignment: conviction === 'HIGH' ? 'bullish' : conviction === 'MEDIUM' ? 'mixed' : 'neutral',
      },
      createdAt: now,
      updatedAt: now,
      ttl: Math.floor(now / 1000) + 86400 * 7,
    };

    (trade as any).triggerSource = triggerSource;
    (trade as any).rationale = rationale;
    (trade as any).conviction = conviction;
    (trade as any).support = support;
    (trade as any).resistance = resistance;
    (trade as any).stopLossPrice = sl;

    portfolio.availableCapital -= capitalRequired;
    portfolio.marginUsed += capitalRequired;
    portfolio.currentRisk += initialRisk;
    portfolio.openPositions += 1;
    portfolio.symbolExposure[symbol] = (portfolio.symbolExposure[symbol] || 0) + 1;
    portfolio.sectorExposure[sector] = (portfolio.sectorExposure[sector] || 0) + (capitalRequired / portfolio.capital * 100);
    portfolio.lastUpdated = now;

    await saveTrade(trade, user);
    await savePortfolioState(portfolio, user);

    console.log(`[CashTrade] Entered ${signal} ${shares} shares of ${symbol} @ ₹${entryPrice}  |  risk ₹${Math.round(initialRisk).toLocaleString()}  |  capital ₹${Math.round(capitalRequired).toLocaleString()}`);
    return { success: true, trade };
  }

  // ── FUTURES + HEDGE PATH (existing logic) ──────────────────────────────────

  // 1. Select hedging strategy based on conviction and market conditions
  const strategyType = selectHedgeStrategy({
    signal,
    conviction,
    volatility: Math.abs(momentum5d) > 3 ? 0.35 : 0.25,
    trendStrength,
    rsi,
  });

  // Load user-specific trading config
  const config = await getUserConfig(user);

  // 2. Get portfolio state
  const portfolio = await getPortfolioState(user);

  // 3. Check risk limits
  if (portfolio.openPositions >= config.maxPositions) {
    return { success: false, error: `Max positions (${config.maxPositions}) reached. Close existing trades first.` };
  }
  if (portfolio.dailyLossUsed >= portfolio.dailyLossLimit) {
    return { success: false, error: 'Daily loss limit hit. Trading halted for today.' };
  }

  // 4. Check sector exposure
  const sector = SECTOR_MAP[symbol.toUpperCase()] || 'Other';
  const currentSectorExposure = portfolio.sectorExposure[sector] || 0;
  if (currentSectorExposure >= config.maxSectorExposurePct) {
    return { success: false, error: `Max exposure for ${sector} sector reached.` };
  }

  // 5. Calculate hedge position
  const lotSize = LOT_SIZES[symbol.toUpperCase()] || 100;
  const daysToExpiry = findNearestExpiry();

  const hedgeConfig: HedgeConfig = {
    spotPrice: entryPrice,
    symbol,
    futuresEntry: entryPrice,
    signal,
    daysToExpiry,
    lotSize,
    strategy: strategyType,
  };

  const spreadPosition = calculateSpreadPosition(hedgeConfig);

  // 6. Position sizing based on risk
  const maxRisk = config.startingCapital * (config.maxRiskPerTradePct / 100);
  const riskPerLot = spreadPosition.maxLoss;
  const marginPerLot = spreadPosition.marginRequired;
  // Cap by risk budget, hard 5-lot cap, and ₹1,00,000 max margin per trade
  const lotsByRisk = Math.max(1, Math.floor(maxRisk / riskPerLot));
  const lotsByMargin = marginPerLot > 0 ? Math.max(1, Math.floor(100000 / marginPerLot)) : 5;
  const optimalLots = Math.min(5, lotsByRisk, lotsByMargin);

  // 7. Check capital availability
  const capitalRequired = marginPerLot * optimalLots;
  if (capitalRequired > portfolio.availableCapital) {
    return { success: false, error: `Insufficient capital. Need ₹${capitalRequired.toLocaleString()}, available ₹${Math.round(portfolio.availableCapital).toLocaleString()}.` };
  }

  // 8. Calculate trading costs
  const futuresValue = entryPrice * lotSize * optimalLots;
  const optionsValue = spreadPosition.legs.reduce((sum, leg) => sum + leg.price * lotSize, 0) * optimalLots;
  const costs = calculateTradingCosts(futuresValue, optionsValue, true);

  // 9. Create trade object
  const tradeId = `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();

  // Use primary leg for option details (first buy leg)
  const primaryLeg = spreadPosition.legs.find(l => l.action === 'buy') || spreadPosition.legs[0];

  const trade: PaperTrade = {
    id: tradeId,
    symbol,
    signal,
    status: 'open',
    entryTime: now,
    entryPrice,
    futuresLots: optimalLots,
    optionLots: optimalLots,
    lotSize,
    atmStrike: primaryLeg.strike,
    optionType: primaryLeg.optionType,
    optionEntryPrice: primaryLeg.price,
    optionExpiry: primaryLeg.expiry,
    grossPnL: 0,
    hedgePnL: 0,
    netPnL: 0,
    pnlPercent: 0,
    brokerage: costs.brokerage,
    stt: 0,
    transactionCharges: costs.transactionCharges,
    gst: costs.gst,
    totalCharges: costs.total,
    initialRisk: riskPerLot * optimalLots,
    maxLoss: spreadPosition.maxLoss * optimalLots,
    hedgeCost: spreadPosition.hedgeCost * optimalLots,
    marginUsed: spreadPosition.marginRequired * optimalLots,
    indicators: {
      rsi,
      rsiSignal,
      macdSignal: trend.includes('bull') ? 'bullish_crossover' : trend.includes('bear') ? 'bearish_crossover' : 'neutral',
      adx: score > 80 ? 30 : score > 60 ? 22 : 15,
      adxTrend: trendStrength === 'strong' ? 'strong' : trendStrength === 'moderate' ? 'moderate' : 'weak',
      momentumScore: score,
      momentumDirection: signal === 'BUY' ? 'bullish' : 'bearish',
      volumeConfirmation: volumeSurge,
      falseBreakoutRisk: score > 80 ? 'low' : score > 60 ? 'medium' : 'high',
      timeframeAlignment: conviction === 'HIGH' ? 'bullish' : conviction === 'MEDIUM' ? 'mixed' : 'neutral',
    },
    createdAt: now,
    updatedAt: now,
    ttl: Math.floor(now / 1000) + 86400 * 7,
  };

  // Store the strategy details in the trade metadata
  (trade as any).hedgeStrategy = strategyType;
  (trade as any).spreadDetails = {
    strategy: spreadPosition.strategy,
    description: spreadPosition.description,
    legs: spreadPosition.legs.map(l => ({
      type: l.optionType,
      strike: l.strike,
      action: l.action,
      price: l.price,
    })),
    maxProfit: spreadPosition.maxProfit === Infinity ? 'Unlimited' : spreadPosition.maxProfit,
    maxLoss: spreadPosition.maxLoss,
    breakeven: spreadPosition.breakeven,
    netPremium: spreadPosition.netPremium,
  };
  (trade as any).triggerSource = triggerSource;
  (trade as any).rationale = rationale;
  (trade as any).conviction = conviction;
  (trade as any).support = support;
  (trade as any).resistance = resistance;

  // 9b. Live order placement (if mode is live)
  try {
    const { getPaperMode } = await import('./dashboard-api.js');
    const modeConfig = await getPaperMode(user);
    trade.mode = modeConfig.mode;

    if (modeConfig.mode === 'live' && user !== DEFAULT_USER_ID) {
      const { checkBrokerConfigured } = await import('../utils/broker-check.js');
      const brokerCheck = await checkBrokerConfigured(user);
      if (brokerCheck.hasBroker && brokerCheck.primaryBroker) {
        const adapter = await createBrokerAdapter(brokerCheck.primaryBroker as BrokerName, user);
        if (adapter?.placeFuturesOrder) {
          const orderResult = await adapter.placeFuturesOrder({
            symbol,
            action: signal,
            quantity: lotSize * optimalLots,
            lotSize,
            orderType: 'MARKET',
            productType: 'INTRADAY',
          });
          if (orderResult) {
            trade.liveOrderId = orderResult.orderId;
            trade.broker = brokerCheck.primaryBroker;
            console.log(`[LiveTrade] Order placed: ${orderResult.orderId} for ${symbol} ${signal} ${lotSize * optimalLots} qty via ${brokerCheck.primaryBroker}`);
          } else {
            console.error(`[LiveTrade] Order failed for ${symbol} — falling back to paper`);
            trade.mode = 'paper';
          }
        }
      }
    }
  } catch (err: any) {
    console.error(`[LiveTrade] Error during live order:`, err.message);
    trade.mode = trade.mode || 'paper';
  }

  // 10. Update portfolio
  portfolio.availableCapital -= capitalRequired;
  portfolio.marginUsed += spreadPosition.marginRequired * optimalLots;
  portfolio.currentRisk += riskPerLot * optimalLots;
  portfolio.openPositions += 1;
  portfolio.symbolExposure[symbol] = (portfolio.symbolExposure[symbol] || 0) + 1;
  portfolio.sectorExposure[sector] = (portfolio.sectorExposure[sector] || 0) + (futuresValue / portfolio.capital * 100);
  portfolio.lastUpdated = now;

  // 11. Save to DynamoDB
  await saveTrade(trade, user);
  await savePortfolioState(portfolio, user);

  // 12. Log signal (simplified)
  await docClient.send(new PutCommand({
    TableName: MOMENTUM_SIGNALS_TABLE,
    Item: {
      pk: `USER#${user}#SIGNAL#${symbol}`,
      sk: `TIME#${now}`,
      userId: user,
      symbol,
      signal,
      entryPrice,
      rsi,
      score,
      conviction,
      strategy: strategyType,
      triggerSource,
      tradeId,
      timestamp: now,
      ttl: Math.floor(now / 1000) + 86400 * 30,
    },
  }));

  return { success: true, trade, strategy: spreadPosition };
}

/**
 * Find nearest monthly expiry (simplified - last Thursday of month)
 */
function findNearestExpiry(): number {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Find last Thursday of current month
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const offset = (lastDay.getDay() + 3) % 7; // Days since last Thursday
  const lastThursday = lastDay.getDate() - offset;

  let daysToExpiry: number;
  if (currentDay < lastThursday) {
    daysToExpiry = lastThursday - currentDay;
  } else {
    // Move to next month
    const nextMonthLastDay = new Date(currentYear, currentMonth + 2, 0);
    const nextOffset = (nextMonthLastDay.getDay() + 3) % 7;
    const nextLastThursday = nextMonthLastDay.getDate() - nextOffset;
    const daysToNextMonth = lastDay.getDate() - currentDay + nextLastThursday;
    daysToExpiry = daysToNextMonth;
  }

  return Math.min(Math.max(daysToExpiry, 0), 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// Exit Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if trade should be exited based on exit conditions
 */
export function checkExitConditions(
  trade: PaperTrade,
  currentPrice: number,
  currentIndicators: FullIndicatorSet,
  timeframeAnalysis: MultiTimeframeAnalysis,
  config?: Partial<TradingConfig>
): { shouldExit: boolean; reason?: PaperTrade['exitReason']; targetPrice?: number; stopPrice?: number } {
  const maxDurationHours = config?.maxTradeDurationHours ?? PAPER_TRADING_CONFIG.MAX_TRADE_DURATION_HOURS;
  const exitMomentumExhaustion = config?.exitOnMomentumExhaustion ?? true;
  const exitReversalSignal = config?.exitOnReversalSignal ?? true;
  const minHoldHours = config?.minHoldHoursBeforeExhaustion ?? 4;
  const durationHours = (Date.now() - trade.entryTime) / (1000 * 60 * 60);
  const pastMinHold = durationHours >= minHoldHours;
  // Calculate target and stop based on R:R of 1:2 minimum
  const riskPoints = Math.abs(trade.entryPrice - trade.atmStrike) + trade.optionEntryPrice;
  const targetPoints = riskPoints * 2; // 1:2 R:R

  let targetPrice: number;
  let stopPrice: number;

  if (trade.signal === 'BUY') {
    targetPrice = trade.entryPrice + targetPoints;
    stopPrice = trade.entryPrice - riskPoints;

    // Check target hit
    if (currentPrice >= targetPrice) {
      return { shouldExit: true, reason: 'target', targetPrice, stopPrice };
    }

    // Check stop loss
    if (currentPrice <= stopPrice) {
      return { shouldExit: true, reason: 'stoploss', targetPrice, stopPrice };
    }
  } else {
    targetPrice = trade.entryPrice - targetPoints;
    stopPrice = trade.entryPrice + riskPoints;

    if (currentPrice <= targetPrice) {
      return { shouldExit: true, reason: 'target', targetPrice, stopPrice };
    }

    if (currentPrice >= stopPrice) {
      return { shouldExit: true, reason: 'stoploss', targetPrice, stopPrice };
    }
  }

  // Check momentum exhaustion — only after minimum hold time matching analysis timeframe
  if (exitMomentumExhaustion && pastMinHold && currentIndicators.momentum.strength === 'weak') {
    return { shouldExit: true, reason: 'momentum_exhaustion', targetPrice, stopPrice };
  }

  // Check reversal signal — only after minimum hold time
  if (exitReversalSignal && pastMinHold) {
    const directionMismatch = (trade.signal === 'BUY' && currentIndicators.momentum.direction === 'bearish') ||
                             (trade.signal === 'SELL' && currentIndicators.momentum.direction === 'bullish');
    if (directionMismatch && currentIndicators.momentum.strength !== 'weak') {
      return { shouldExit: true, reason: 'reversal', targetPrice, stopPrice };
    }
  }

  // Check time-based exit for paper trading
  if (durationHours >= maxDurationHours) {
    return { shouldExit: true, reason: 'expiry', targetPrice, stopPrice };
  }

  return { shouldExit: false, targetPrice, stopPrice };
}

/**
 * Exit a paper trade (user-scoped)
 */
export async function exitTrade(request: TradeExitRequest): Promise<{ success: boolean; trade?: PaperTrade; error?: string }> {
  const { tradeId, exitPrice, exitReason, currentIndicators, optionMarketPrice, userId } = request;
  const user = userId || DEFAULT_USER_ID;

  // 1. Get trade (user-scoped)
  const trade = await getTradeById(tradeId, user);
  if (!trade) {
    return { success: false, error: 'Trade not found' };
  }

  if (trade.status !== 'open') {
    return { success: false, error: 'Trade already closed' };
  }

  // 2. Calculate P&L
  let grossPnL: number;
  let optionsPnL: number;
  let exitCosts: ReturnType<typeof calculateTradingCosts>;

  if (trade.segment === 'CASH') {
    // ── Cash segment: simple directional P&L, no hedge ──
    const shares = trade.shares ?? 1;
    const multiplier = trade.signal === 'BUY' ? 1 : -1;
    grossPnL = (exitPrice - trade.entryPrice) * shares * multiplier;
    optionsPnL = 0;
    const exitValue = exitPrice * shares;
    const cashExitCosts = calculateCashTradingCosts(exitValue, true); // STT on sell
    exitCosts = cashExitCosts;
  } else {
    // ── Futures + hedge P&L ──
    const lotSize = trade.lotSize;
    const futureMultiplier = trade.signal === 'BUY' ? 1 : -1;
    const futuresPnL = (exitPrice - trade.entryPrice) * lotSize * trade.futuresLots * futureMultiplier;
    const optionExitValue = (optionMarketPrice || trade.optionEntryPrice * 0.5) * lotSize * trade.optionLots;
    const optionEntryValue = trade.optionEntryPrice * lotSize * trade.optionLots;
    optionsPnL = optionExitValue - optionEntryValue;
    grossPnL = futuresPnL + optionsPnL;
    const entryValue = trade.entryPrice * lotSize * trade.futuresLots;
    exitCosts = calculateTradingCosts(entryValue, optionEntryValue, false);
  }

  // Net P&L after charges
  const netPnL = grossPnL - exitCosts.total;

  // P&L percentage on capital at risk
  const pnlPercent = (netPnL / trade.initialRisk) * 100;

  const now = Date.now();
  const duration = Math.round((now - trade.entryTime) / (1000 * 60)); // minutes

  // 3. Update trade
  const updatedTrade: PaperTrade = {
    ...trade,
    status: 'closed',
    exitTime: now,
    exitPrice,
    exitReason,
    optionExitPrice: optionMarketPrice || trade.optionEntryPrice * 0.5,
    grossPnL: Math.round(grossPnL),
    hedgePnL: Math.round(optionsPnL),
    netPnL: Math.round(netPnL),
    pnlPercent: Math.round(pnlPercent * 100) / 100,
    brokerage: trade.brokerage + exitCosts.brokerage,
    stt: trade.stt + exitCosts.stt,
    transactionCharges: trade.transactionCharges + exitCosts.transactionCharges,
    gst: trade.gst + exitCosts.gst,
    totalCharges: trade.totalCharges + exitCosts.total,
    exitIndicators: currentIndicators,
    duration,
    updatedAt: now,
    ttl: Math.floor(now / 1000) + 86400 * 90,
  };

  // 3b. Place live exit order if trade was live
  if (trade.liveOrderId && trade.broker) {
    try {
      const adapter = await createBrokerAdapter(trade.broker as BrokerName, user);
      if (adapter?.placeFuturesOrder) {
        const exitAction = trade.signal === 'BUY' ? 'SELL' : 'BUY';
        const exitOrderResult = await adapter.placeFuturesOrder({
          symbol: trade.symbol,
          action: exitAction,
          quantity: trade.lotSize * trade.futuresLots,
          lotSize: trade.lotSize,
          orderType: 'MARKET',
          productType: 'INTRADAY',
        });
        if (exitOrderResult) {
          updatedTrade.liveExitOrderId = exitOrderResult.orderId;
          console.log(`[LiveTrade] Exit order placed: ${exitOrderResult.orderId} for ${trade.symbol} ${exitAction}`);
        } else {
          console.error(`[LiveTrade] Exit order FAILED for ${trade.symbol} — manual intervention needed`);
        }
      }
    } catch (err: any) {
      console.error(`[LiveTrade] Exit order error for ${trade.symbol}:`, err.message);
    }
  }

  // 4. Update portfolio (user-scoped)
  const portfolio = await getPortfolioState(user);
  // Cash trades: full position value returned; futures: margin + hedge cost returned
  const capitalFreed = trade.segment === 'CASH'
    ? trade.marginUsed   // marginUsed holds the full cash value
    : trade.marginUsed + trade.hedgeCost;

  portfolio.capital += netPnL;
  portfolio.availableCapital += capitalFreed + netPnL;
  portfolio.marginUsed -= trade.marginUsed;
  portfolio.currentRisk -= trade.initialRisk;
  portfolio.totalPnl += netPnL;
  portfolio.dayPnl += netPnL;
  portfolio.openPositions -= 1;
  portfolio.closedTrades += 1;

  // Update win rate (user-scoped)
  const allTradesResult = await docClient.send(new ScanCommand({
    TableName: MOMENTUM_TRADES_TABLE,
    FilterExpression: '#status = :status AND #userId = :userId',
    ExpressionAttributeNames: { '#status': 'status', '#userId': 'userId' },
    ExpressionAttributeValues: { ':status': 'closed', ':userId': user },
  }));

  const allClosedTrades = (allTradesResult.Items || []) as PaperTrade[];
  const wins = allClosedTrades.filter(t => (t.netPnL || 0) > 0).length + (netPnL > 0 ? 1 : 0);
  const total = allClosedTrades.length + 1;
  portfolio.winRate = Math.round((wins / total) * 100);

  // Update max drawdown
  if (portfolio.capital > portfolio.peakCapital) {
    portfolio.peakCapital = portfolio.capital;
  }
  const drawdown = ((portfolio.peakCapital - portfolio.capital) / portfolio.peakCapital) * 100;
  if (drawdown > portfolio.maxDrawdown) {
    portfolio.maxDrawdown = Math.round(drawdown * 100) / 100;
  }

  // Update exposures
  const sector = SECTOR_MAP[trade.symbol.toUpperCase()] || 'Other';
  portfolio.symbolExposure[trade.symbol] = Math.max(0, (portfolio.symbolExposure[trade.symbol] || 1) - 1);
  const positionValue = trade.segment === 'CASH'
    ? trade.entryPrice * (trade.shares ?? 1)
    : trade.entryPrice * trade.lotSize * trade.futuresLots;
  const sectorExposureReduction = positionValue / PAPER_TRADING_CONFIG.STARTING_CAPITAL * 100;
  portfolio.sectorExposure[sector] = Math.max(0, (portfolio.sectorExposure[sector] || 0) - sectorExposureReduction);

  // Update daily loss
  if (netPnL < 0) {
    portfolio.dailyLossUsed += Math.abs(netPnL);
  }

  portfolio.lastUpdated = now;

  // 5. Save updates (user-scoped)
  await saveTrade(updatedTrade, user);
  await savePortfolioState(portfolio, user);

  return { success: true, trade: updatedTrade };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all trades with pagination (user-scoped)
 */
export async function getAllTrades(
  limit: number = 100,
  lastEvaluatedKey?: Record<string, any>,
  userId?: string
): Promise<{ trades: PaperTrade[]; lastKey?: Record<string, any> }> {
  const user = userId || DEFAULT_USER_ID;
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: MOMENTUM_TRADES_TABLE,
      FilterExpression: '#userId = :userId',
      ExpressionAttributeNames: { '#userId': 'userId' },
      ExpressionAttributeValues: { ':userId': user },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    }));

    return {
      trades: (result.Items || []) as PaperTrade[],
      lastKey: result.LastEvaluatedKey,
    };
  } catch {
    return { trades: [] };
  }
}

/**
 * Get trades by symbol (user-scoped)
 */
export async function getTradesBySymbol(symbol: string, userId?: string): Promise<PaperTrade[]> {
  const user = userId || DEFAULT_USER_ID;
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: MOMENTUM_TRADES_TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'gsi1pk = :symbol',
      ExpressionAttributeValues: {
        ':symbol': `USER#${user}#SYMBOL#${symbol}`,
      },
    }));

    return (result.Items || []) as PaperTrade[];
  } catch {
    return [];
  }
}

/**
 * Reset paper trading portfolio (for testing) (user-scoped)
 */
export async function resetPortfolio(userId?: string): Promise<void> {
  const user = userId || DEFAULT_USER_ID;
  const now = Date.now();

  // Create fresh portfolio
  const newPortfolio: PortfolioState = {
    capital: PAPER_TRADING_CONFIG.STARTING_CAPITAL,
    startingCapital: PAPER_TRADING_CONFIG.STARTING_CAPITAL,
    availableCapital: PAPER_TRADING_CONFIG.STARTING_CAPITAL,
    marginUsed: 0,
    totalPnl: 0,
    unrealizedPnl: 0,
    dayPnl: 0,
    openPositions: 0,
    closedTrades: 0,
    winRate: 0,
    maxDrawdown: 0,
    peakCapital: PAPER_TRADING_CONFIG.STARTING_CAPITAL,
    lastUpdated: now,
    dailyLossLimit: PAPER_TRADING_CONFIG.STARTING_CAPITAL * (PAPER_TRADING_CONFIG.DAILY_LOSS_LIMIT_PCT / 100),
    dailyLossUsed: 0,
    maxRiskPerTrade: PAPER_TRADING_CONFIG.STARTING_CAPITAL * (PAPER_TRADING_CONFIG.MAX_RISK_PER_TRADE_PCT / 100),
    currentRisk: 0,
    sectorExposure: {},
    symbolExposure: {},
  };

  await savePortfolioState(newPortfolio, user);

  // Close all open trades as "manual" with zero P&L (user-scoped)
  const openTrades = await getOpenTrades(user);
  for (const trade of openTrades) {
    await exitTrade({
      tradeId: trade.id,
      exitPrice: trade.entryPrice, // Flat exit
      exitReason: 'manual',
      optionMarketPrice: trade.optionEntryPrice * 0.5,
      userId: user,
    });
  }
}

/**
 * Calculate unrealized P&L for a single trade based on current price
 */
export function calculateUnrealizedPnL(
  trade: PaperTrade,
  currentPrice: number,
  currentOptionPrice?: number
): { grossPnL: number; hedgePnL: number; netPnL: number; pnlPercent: number } {
  const futureMultiplier = trade.signal === 'BUY' ? 1 : -1;

  // Futures P&L
  const futuresPnL = (currentPrice - trade.entryPrice) * trade.lotSize * trade.futuresLots * futureMultiplier;

  // Options P&L (hedge position)
  const optionCurrentValue = (currentOptionPrice ?? trade.optionEntryPrice * 0.7) * trade.lotSize * trade.optionLots;
  const optionEntryValue = trade.optionEntryPrice * trade.lotSize * trade.optionLots;
  const optionsPnL = optionCurrentValue - optionEntryValue;

  // Gross P&L (before charges)
  const grossPnL = futuresPnL + optionsPnL;

  // Net P&L (minus entry charges already paid)
  const netPnL = grossPnL - trade.totalCharges;

  // P&L percentage on initial risk
  const pnlPercent = trade.initialRisk > 0 ? (netPnL / trade.initialRisk) * 100 : 0;

  return {
    grossPnL: Math.round(grossPnL),
    hedgePnL: Math.round(optionsPnL),
    netPnL: Math.round(netPnL),
    pnlPercent: Math.round(pnlPercent * 100) / 100,
  };
}

/**
 * Fetch current market price from Yahoo Finance for a given NSE symbol.
 */
async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

/**
 * Update unrealized P&L for all open trades and portfolio (user-scoped)
 * Uses real market prices from Yahoo Finance when price data is not provided.
 */
export async function updateUnrealizedPnL(
  priceUpdates?: Record<string, { price: number; optionPrice?: number }>,
  userId?: string
): Promise<{
  updatedTrades: Array<{ id: string; symbol: string; unrealizedPnL: number }>;
  totalUnrealizedPnL: number;
}> {
  const user = userId || DEFAULT_USER_ID;
  const openTrades = await getOpenTrades(user);
  const updatedTrades: Array<{ id: string; symbol: string; unrealizedPnL: number }> = [];
  let totalUnrealizedPnL = 0;

  // Collect unique symbols that need real price lookups
  const symbolsNeedingPrice = new Set<string>();
  for (const trade of openTrades) {
    if (!priceUpdates?.[trade.symbol]) {
      symbolsNeedingPrice.add(trade.symbol);
    }
  }

  // Fetch real prices from Yahoo Finance in parallel
  const fetchedPrices: Record<string, number> = {};
  if (symbolsNeedingPrice.size > 0) {
    const results = await Promise.allSettled(
      Array.from(symbolsNeedingPrice).map(async (symbol) => {
        const price = await fetchYahooPrice(symbol);
        return { symbol, price };
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.price != null) {
        fetchedPrices[result.value.symbol] = result.value.price;
      }
    }
  }

  for (const trade of openTrades) {
    let currentPrice: number;
    let currentOptionPrice: number | undefined;

    if (priceUpdates && priceUpdates[trade.symbol]) {
      // Use provided price data
      currentPrice = priceUpdates[trade.symbol].price;
      currentOptionPrice = priceUpdates[trade.symbol].optionPrice;
    } else if (fetchedPrices[trade.symbol]) {
      // Use real price from Yahoo Finance
      currentPrice = fetchedPrices[trade.symbol];
    } else {
      // No real price available — skip update to avoid fake P&L
      console.warn(`[PaperTrading] No real price for ${trade.symbol}, skipping P&L update`);
      continue;
    }

    const pnl = calculateUnrealizedPnL(trade, currentPrice, currentOptionPrice);

    // Update trade in DynamoDB with current unrealized P&L (user-scoped)
    const updatedTrade: PaperTrade = {
      ...trade,
      grossPnL: pnl.grossPnL,
      hedgePnL: pnl.hedgePnL,
      netPnL: pnl.netPnL,
      pnlPercent: pnl.pnlPercent,
      updatedAt: Date.now(),
    };

    await saveTrade(updatedTrade, user);

    updatedTrades.push({
      id: trade.id,
      symbol: trade.symbol,
      unrealizedPnL: pnl.netPnL,
    });

    totalUnrealizedPnL += pnl.netPnL;
  }

  // Update portfolio with total unrealized P&L (user-scoped)
  if (openTrades.length > 0) {
    const portfolio = await getPortfolioState(user);
    portfolio.unrealizedPnl = totalUnrealizedPnL;
    portfolio.lastUpdated = Date.now();
    await savePortfolioState(portfolio, user);
  }

  return { updatedTrades, totalUnrealizedPnL };
}

/**
 * Check and auto-exit trades that meet exit conditions (user-scoped)
 */
export async function monitorOpenTrades(
  priceData: Record<string, { price: number; indicators: FullIndicatorSet; timeframe: MultiTimeframeAnalysis }>,
  userId?: string
): Promise<{ exited: string[]; errors: string[] }> {
  const user = userId || DEFAULT_USER_ID;
  const openTrades = await getOpenTrades(user);
  const exited: string[] = [];
  const errors: string[] = [];

  for (const trade of openTrades) {
    const data = priceData[trade.symbol];
    if (!data) continue;

    const exitCheck = checkExitConditions(trade, data.price, data.indicators, data.timeframe);

    if (exitCheck.shouldExit) {
      const result = await exitTrade({
        tradeId: trade.id,
        exitPrice: data.price,
        exitReason: exitCheck.reason,
        currentIndicators: data.indicators,
        userId: user,
      });

      if (result.success) {
        exited.push(trade.id);
      } else {
        errors.push(`${trade.id}: ${result.error}`);
      }
    }
  }

  return { exited, errors };
}
