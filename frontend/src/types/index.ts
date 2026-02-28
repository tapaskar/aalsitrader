export interface Agent {
  id: string;
  name: string;
  greek: string;
  role: string;
  color: string;
  status: 'active' | 'sleeping' | 'error';
  currentTask?: string;
  nextWake?: string;
  lastActivity: Date;
  stats: {
    tasksCompleted: number;
    alertsSent: number;
    accuracy: number;
  };
}

export interface Activity {
  id: string;
  agentId: string;
  agentName: string;
  agentGreek: string;
  agentColor: string;
  type: 'info' | 'alert' | 'success' | 'warning' | 'error';
  content: string;
  timestamp: Date;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface BetaTechMetadata {
  symbol: string;
  fullAnalysis?: string;
  techData?: {
    currentPrice?: number;
    changePercent?: number;
    rsi?: { value?: number; signal?: string };
    macd?: { signalInterpretation?: string; histogram?: number };
    trend?: { trend?: string; strength?: string };
    supportResistance?: { support?: number; resistance?: number };
    bollingerPosition?: string;
    volumeSurge?: boolean;
    overallSignal?: string;
  };
}

export interface SmartMoneyStock {
  symbol: string;
  price: number;
  trendStrength: number;   // -100 to +100
  confidence: number;       // 0 to 100
  structure: 'BOS_BULLISH' | 'BOS_BEARISH' | 'CHOCH_BULLISH' | 'CHOCH_BEARISH' | 'RANGE';
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  rsi: number;
  momentum5d: number;
  trend: string;
  volumeSurge: boolean;
  support: number;
  resistance: number;
  sma20: number;
  sma50: number;
}

export interface TradingConfig {
  startingCapital: number;
  maxRiskPerTradePct: number;
  dailyLossLimitPct: number;
  maxPositions: number;
  maxSectorExposurePct: number;
  rsiOversoldThreshold: number;
  rsiOverboughtThreshold: number;
  minRewardRiskRatio: number;
  minTimeframeConfidence: number;
  rejectHighFalseBreakout: boolean;
  requireAgentAlignment: boolean;
  maxTradeDurationHours: number;
  exitOnMomentumExhaustion: boolean;
  exitOnReversalSignal: boolean;
  intradayExitTime: string;
  maxSwingHoldingDays: number;
  hedgeEnabled: boolean;
  brokeragePerOrder: number;
}

export interface TradingRules {
  userId: string;
  entryRules: string[];
  exitRules: string[];
  riskRules: string[];
  config: TradingConfig;
  lastUpdated: number;
  updatedBy: 'user' | 'prime';
}

export interface CommMessage {
  id: string;
  from: string;
  fromGreek: string;
  fromColor: string;
  to: string;
  toGreek: string;
  toColor: string;
  content: string;
  timestamp: Date;
}

export interface Trade {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  target: number;
  status: 'open' | 'closed' | 'cancelled';
  pnl?: number;
  pnlPercent?: number;
  setupType: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  entryTime: Date;
  exitTime?: Date;
  agentId: string;
  notes?: string;
}

export interface SquadStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgRMultiple: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  activeAgents: number;
  sleepingAgents: number;
}

export type FilterType = 'all' | 'alpha' | 'beta' | 'gamma' | 'theta' | 'delta' | 'sigma' | 'alerts' | 'trades' | 'paper';

// Paper Trading Types
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
  futuresLots: number;
  optionLots: number;
  lotSize: number;
  atmStrike: number;
  optionType: 'CE' | 'PE';
  optionEntryPrice: number;
  optionExitPrice?: number;
  optionExpiry?: string;
  // Margin & Risk
  marginUsed: number;
  hedgeCost: number;
  initialRisk: number;
  maxLoss: number;
  // P&L
  grossPnL: number;
  hedgePnL: number;
  netPnL: number;
  pnlPercent: number;
  // Charges
  brokerage: number;
  stt: number;
  transactionCharges: number;
  gst: number;
  totalCharges: number;
  indicators?: {
    rsi: number;
    momentumScore: number;
    timeframeAlignment: string;
    adx?: number;
    volumeConfirmation?: boolean;
  };
  duration?: number;
}

export interface PaperPortfolio {
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
}

export interface PaperMetrics {
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
  totalReturn: number;
  annualizedReturn: number;
  avgTradeDuration: number;
  bestPerformingSymbol: string;
  worstPerformingSymbol: string;
  eligibleForLive: boolean;
  tradesRemaining: number;
  recommendations: string[];
  expectancy?: number;
}

export interface EquityPoint {
  timestamp: number;
  capital: number;
  pnl: number;
  drawdown: number;
  openPositions: number;
  // Chart display fields (computed)
  formattedTime?: string;
  formattedDate?: string;
}

export interface PaperModeStat {
  mode: 'paper' | 'live';
  enabled: boolean;
  requireSigmaApproval: boolean;
  autoTradingEnabled: boolean;
}

export interface PricingTier {
  name: string;
  price: number;
  period: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export interface SigmaApprovalItem {
  tradeId: string;
  symbol: string;
  signal: 'BUY' | 'SELL';
  entryPrice: number;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  sigmaApprovedBy?: string;
  sigmaApprovedAt?: number;
  // API response fields
  indicators?: any;
  requiresApproval?: boolean;
}
