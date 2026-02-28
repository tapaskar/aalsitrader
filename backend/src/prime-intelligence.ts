/**
 * Prime Intelligence Module
 *
 * Handles Prime (Sigma) agent's intelligent decision-making:
 * - Memory storage and retrieval
 * - Agent consultation and collaboration
 * - Decision rationale logging
 * - Human communication
 */

import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fnoStocks, batchScanStocks, scanStockYahoo } from './agents/shared.js';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
const lambdaClient = new LambdaClient({ region: AWS_REGION });
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });

const MEMORY_TABLE = process.env.MEMORY_TABLE || 'sigma-memory-prod';
const TTL_DAYS = 30; // Keep memory for 30 days

// Default userId for backwards compatibility (global/shared context)
const DEFAULT_USER_ID = 'GLOBAL';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentConsultation {
  agentId: string;
  agentName: string;
  question: string;
  response: string;
  timestamp: number;
  userId?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface DecisionMemory {
  id: string;
  symbol: string;
  action: 'ENTER' | 'EXIT' | 'HOLD' | 'SKIP';
  signal: 'BUY' | 'SELL' | null;
  confidence: number;
  rationale: string;
  consultations: AgentConsultation[];
  technicalData: any;
  newsContext: string;
  riskAssessment: string;
  timestamp: number;
  userId?: string;
  outcome?: {
    actualAction: string;
    pnl?: number;
    notes?: string;
  };
}

export interface ThinkingLog {
  id: string;
  symbol: string;
  phase: 'analysis' | 'consultation' | 'decision' | 'communication';
  content: string;
  timestamp: number;
  userId?: string;
}

// User trading preferences stored in Prime's memory
export interface UserTradingPreferences {
  userId: string;
  tradingStyle?: 'aggressive' | 'moderate' | 'conservative';
  preferredSectors?: string[];
  riskTolerance?: number; // 1-10
  preferredTimeframes?: string[];
  customRules?: string[];
  lastUpdated: number;
}

// Structured trading configuration (numerical parameters + toggles)
export interface TradingConfig {
  // Position Sizing & Capital
  startingCapital: number;
  maxRiskPerTradePct: number;
  dailyLossLimitPct: number;
  maxPositions: number;
  maxSectorExposurePct: number;

  // Entry Thresholds
  rsiOversoldThreshold: number;
  rsiOverboughtThreshold: number;
  minRewardRiskRatio: number;
  minTimeframeConfidence: number;
  rejectHighFalseBreakout: boolean;
  requireAgentAlignment: boolean;

  // Exit Thresholds
  maxTradeDurationHours: number;
  exitOnMomentumExhaustion: boolean;
  exitOnReversalSignal: boolean;
  minHoldHoursBeforeExhaustion: number; // Minimum hold time before momentum/reversal exits can fire
  intradayExitTime: string;
  maxSwingHoldingDays: number;

  // Costs & Hedging
  hedgeEnabled: boolean;
  brokeragePerOrder: number;
}

// Trading rules that Prime follows for entry/exit decisions
export interface TradingRules {
  userId: string;
  entryRules: string[];
  exitRules: string[];
  riskRules: string[];
  config: TradingConfig;
  lastUpdated: number;
  updatedBy: 'user' | 'prime';
}

// Default config values (mirrors PAPER_TRADING_CONFIG + decision logic thresholds)
export const DEFAULT_TRADING_CONFIG: TradingConfig = {
  startingCapital: 1000000,
  maxRiskPerTradePct: 2.5,
  dailyLossLimitPct: 5.0,
  maxPositions: 5,
  maxSectorExposurePct: 40,
  rsiOversoldThreshold: 30,
  rsiOverboughtThreshold: 70,
  minRewardRiskRatio: 1.5,
  minTimeframeConfidence: 40,
  rejectHighFalseBreakout: false,
  requireAgentAlignment: false,
  maxTradeDurationHours: 48,
  exitOnMomentumExhaustion: true,
  exitOnReversalSignal: true,
  minHoldHoursBeforeExhaustion: 4, // Daily-candle analysis → hold at least 4h before momentum/reversal exits
  intradayExitTime: '15:15',
  maxSwingHoldingDays: 7,
  hedgeEnabled: true,
  brokeragePerOrder: 20,
};

// Default trading rules
const DEFAULT_TRADING_RULES: Omit<TradingRules, 'userId'> = {
  entryRules: [
    'RSI below 30 (oversold) supports BUY signals',
    'RSI above 70 (overbought) supports SELL signals',
    'MACD crossover confirms trend direction',
    'Price above 20-day EMA for longs, below for shorts',
    'Minimum 1.5:1 reward-to-risk ratio preferred',
    'Agent majority (2 of 3) agreement is sufficient for entry',
  ],
  exitRules: [
    'Stop loss hit - exit immediately (no averaging down)',
    'Target reached - book 50% profits, trail remaining',
    'RSI divergence against position - tighten stop',
    'News turns negative - reduce position by 50%',
    'End of day - close all intraday positions by 3:15 PM',
    'Maximum holding period: 5 trading days for swing trades',
  ],
  riskRules: [
    'Maximum 2.5% capital risk per trade',
    'Maximum 5 open positions at any time',
    'Maximum 5% daily loss limit - reduce position sizing beyond this',
    'Position sizing: lotSize = (2.5% of capital) / (entry - stopLoss)',
    'Every position must have a defined stop loss',
  ],
  config: DEFAULT_TRADING_CONFIG,
  lastUpdated: Date.now(),
  updatedBy: 'user',
};

// ─────────────────────────────────────────────────────────────────────────────
// Memory Functions (User-Scoped)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store a decision in Prime's memory (user-scoped)
 */
export async function storeDecision(decision: DecisionMemory, userId?: string): Promise<void> {
  const timestamp = decision.timestamp || Date.now();
  const ttl = Math.floor(timestamp / 1000) + (TTL_DAYS * 24 * 60 * 60);
  const user = userId || decision.userId || DEFAULT_USER_ID;

  await docClient.send(new PutCommand({
    TableName: MEMORY_TABLE,
    Item: {
      pk: `USER#${user}#DECISION#${decision.symbol}`,
      sk: `${timestamp}#${decision.id}`,
      gsi1pk: `USER#${user}#DATE#${new Date(timestamp).toISOString().split('T')[0]}`,
      gsi1sk: `${timestamp}#${decision.symbol}`,
      ...decision,
      userId: user,
      ttl,
    },
  }));
}

/**
 * Store a thinking log entry (user-scoped)
 */
export async function storeThinking(log: ThinkingLog, userId?: string): Promise<void> {
  const timestamp = log.timestamp || Date.now();
  const ttl = Math.floor(timestamp / 1000) + (TTL_DAYS * 24 * 60 * 60);
  const user = userId || log.userId || DEFAULT_USER_ID;

  await docClient.send(new PutCommand({
    TableName: MEMORY_TABLE,
    Item: {
      pk: `USER#${user}#THINKING#${log.symbol}`,
      sk: `${timestamp}#${log.id}`,
      gsi1pk: `USER#${user}#PHASE#${log.phase}`,
      gsi1sk: `${timestamp}`,
      ...log,
      userId: user,
      ttl,
    },
  }));
}

/**
 * Store an agent consultation (user-scoped)
 */
export async function storeConsultation(
  symbol: string,
  consultation: AgentConsultation,
  userId?: string
): Promise<void> {
  const timestamp = consultation.timestamp || Date.now();
  const ttl = Math.floor(timestamp / 1000) + (TTL_DAYS * 24 * 60 * 60);
  const user = userId || consultation.userId || DEFAULT_USER_ID;

  await docClient.send(new PutCommand({
    TableName: MEMORY_TABLE,
    Item: {
      pk: `USER#${user}#CONSULTATION#${symbol}`,
      sk: `${timestamp}#${consultation.agentId}`,
      gsi1pk: `USER#${user}#AGENT#${consultation.agentId}`,
      gsi1sk: `${timestamp}`,
      ...consultation,
      symbol,
      userId: user,
      ttl,
    },
  }));
}

/**
 * Store user trading preferences
 */
export async function storeUserPreferences(prefs: UserTradingPreferences): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year TTL

  await docClient.send(new PutCommand({
    TableName: MEMORY_TABLE,
    Item: {
      pk: `USER#${prefs.userId}#PREFERENCES`,
      sk: 'TRADING',
      ...prefs,
      ttl,
    },
  }));
}

/**
 * Get user trading preferences
 */
export async function getUserPreferences(userId: string): Promise<UserTradingPreferences | null> {
  const result = await docClient.send(new GetCommand({
    TableName: MEMORY_TABLE,
    Key: {
      pk: `USER#${userId}#PREFERENCES`,
      sk: 'TRADING',
    },
  }));

  return result.Item as UserTradingPreferences | null;
}

/**
 * Store trading rules
 */
export async function storeTradingRules(rules: TradingRules): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year TTL

  await docClient.send(new PutCommand({
    TableName: MEMORY_TABLE,
    Item: {
      pk: `USER#${rules.userId}#RULES`,
      sk: 'TRADING',
      ...rules,
      ttl,
    },
  }));
}

/**
 * Get trading rules for a user (returns defaults if none set).
 * Always merges stored config with defaults so new config fields are populated.
 */
export async function getTradingRules(userId: string): Promise<TradingRules> {
  const result = await docClient.send(new GetCommand({
    TableName: MEMORY_TABLE,
    Key: {
      pk: `USER#${userId}#RULES`,
      sk: 'TRADING',
    },
  }));

  if (result.Item) {
    const stored = result.Item as TradingRules;
    // Merge with defaults so new config fields are always present
    return {
      ...stored,
      config: { ...DEFAULT_TRADING_CONFIG, ...(stored.config || {}) },
    };
  }

  // Return default rules with userId
  return { userId, ...DEFAULT_TRADING_RULES };
}

/**
 * Update specific trading rules (entry/exit/risk text rules + structured config)
 */
export async function updateTradingRules(
  userId: string,
  updates: Partial<Pick<TradingRules, 'entryRules' | 'exitRules' | 'riskRules' | 'config'>>,
  updatedBy: 'user' | 'prime' = 'prime'
): Promise<TradingRules> {
  const currentRules = await getTradingRules(userId);

  // Merge config partially (so user can update individual fields)
  const mergedConfig = updates.config
    ? { ...currentRules.config, ...updates.config }
    : currentRules.config;

  const updatedRules: TradingRules = {
    ...currentRules,
    ...(updates.entryRules && { entryRules: updates.entryRules }),
    ...(updates.exitRules && { exitRules: updates.exitRules }),
    ...(updates.riskRules && { riskRules: updates.riskRules }),
    config: mergedConfig,
    userId,
    lastUpdated: Date.now(),
    updatedBy,
  };

  await storeTradingRules(updatedRules);
  return updatedRules;
}

/**
 * Get recent decisions for a symbol (user-scoped)
 */
export async function getRecentDecisions(
  symbol: string,
  limit: number = 10,
  userId?: string
): Promise<DecisionMemory[]> {
  const user = userId || DEFAULT_USER_ID;
  const result = await docClient.send(new QueryCommand({
    TableName: MEMORY_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user}#DECISION#${symbol}` },
    ScanIndexForward: false,
    Limit: limit,
  }));

  return (result.Items || []) as DecisionMemory[];
}

/**
 * Get all decisions from today (user-scoped)
 */
export async function getTodaysDecisions(userId?: string): Promise<DecisionMemory[]> {
  const today = new Date().toISOString().split('T')[0];
  const user = userId || DEFAULT_USER_ID;

  const result = await docClient.send(new QueryCommand({
    TableName: MEMORY_TABLE,
    IndexName: 'gsi1',
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user}#DATE#${today}` },
    ScanIndexForward: false,
  }));

  return (result.Items || []) as DecisionMemory[];
}

/**
 * Get recent consultations with a specific agent (user-scoped)
 */
export async function getAgentConsultations(
  agentId: string,
  limit: number = 20,
  userId?: string
): Promise<AgentConsultation[]> {
  const user = userId || DEFAULT_USER_ID;
  const result = await docClient.send(new QueryCommand({
    TableName: MEMORY_TABLE,
    IndexName: 'gsi1',
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user}#AGENT#${agentId}` },
    ScanIndexForward: false,
    Limit: limit,
  }));

  return (result.Items || []) as AgentConsultation[];
}

/**
 * Get thinking logs for a symbol (user-scoped)
 */
export async function getThinkingLogs(
  symbol: string,
  limit: number = 50,
  userId?: string
): Promise<ThinkingLog[]> {
  const user = userId || DEFAULT_USER_ID;
  const result = await docClient.send(new QueryCommand({
    TableName: MEMORY_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user}#THINKING#${symbol}` },
    ScanIndexForward: false,
    Limit: limit,
  }));

  return (result.Items || []) as ThinkingLog[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Trade Learning & Lesson Memory (per-user)
// ─────────────────────────────────────────────────────────────────────────────

export interface TradeLesson {
  id: string;
  symbol: string;
  signal: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  netPnL: number;
  exitReason: string;
  lesson: string;
  mistakeType: string;
  avoidPattern: string;
  timestamp: number;
  userId: string;
  sector?: string;
}

/**
 * Analyze a completed trade and extract lessons (especially from losses).
 * Called after every trade exit — uses LLM to reflect on what went wrong/right.
 */
export async function analyzeTradeOutcome(trade: {
  symbol: string;
  signal: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  netPnL: number;
  pnlPercent: number;
  exitReason: string;
  duration?: number;
  indicators?: {
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
  exitIndicators?: any;
  sector?: string;
}, userId: string): Promise<TradeLesson | null> {
  const isLoss = trade.netPnL < 0;

  // Always analyze losses; for wins, only analyze if P&L was very small (missed potential)
  if (!isLoss && trade.pnlPercent > 5) return null;

  try {
    // Get recent lessons to avoid repetitive analysis
    const recentLessons = await getRecentLessons(5, userId);
    const recentLessonContext = recentLessons.length > 0
      ? recentLessons.map(l => `- ${l.symbol}: ${l.mistakeType} — ${l.lesson}`).join('\n')
      : 'No previous lessons recorded.';

    const prompt = `You are Prime (Sigma), reflecting on a trade that just closed. Analyze what happened and extract a clear lesson.

TRADE DETAILS:
- Symbol: ${trade.symbol} (${trade.sector || 'Unknown sector'})
- Signal: ${trade.signal}
- Entry: ₹${trade.entryPrice} → Exit: ₹${trade.exitPrice}
- Net P&L: ₹${trade.netPnL} (${trade.pnlPercent.toFixed(1)}%)
- Exit Reason: ${trade.exitReason}
- Duration: ${trade.duration ? Math.round(trade.duration / 60) + ' hours' : 'Unknown'}
- Entry RSI: ${trade.indicators?.rsi || 'N/A'}, Momentum: ${trade.indicators?.momentumDirection || 'N/A'}
- Volume Confirmation: ${trade.indicators?.volumeConfirmation || 'N/A'}
- False Breakout Risk: ${trade.indicators?.falseBreakoutRisk || 'N/A'}
- Timeframe Alignment: ${trade.indicators?.timeframeAlignment || 'N/A'}

PREVIOUS LESSONS:
${recentLessonContext}

Analyze this trade. Respond in this exact format:
MISTAKE_TYPE: [One of: bad_entry_timing, false_breakout, against_trend, weak_momentum, poor_risk_reward, overexposure, early_exit, late_exit, sector_weakness, good_trade]
LESSON: [1-2 sentences describing what went wrong or what could be improved. Be specific about the indicators/conditions that failed.]
AVOID_PATTERN: [A concise pattern description to watch out for in future, e.g. "Avoid BUY when RSI > 60 and momentum declining" or "Skip entries in banking sector during RBI week"]`;

    const response = await callClaudeOpus(prompt, 500);

    const mistakeMatch = response.match(/MISTAKE_TYPE:\s*(.+)/i);
    const lessonMatch = response.match(/LESSON:\s*(.+?)(?=AVOID_PATTERN:|$)/is);
    const avoidMatch = response.match(/AVOID_PATTERN:\s*(.+)/is);

    const lesson: TradeLesson = {
      id: crypto.randomUUID(),
      symbol: trade.symbol,
      signal: trade.signal,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      netPnL: trade.netPnL,
      exitReason: trade.exitReason,
      lesson: lessonMatch?.[1]?.trim() || 'No lesson extracted',
      mistakeType: mistakeMatch?.[1]?.trim() || 'unknown',
      avoidPattern: avoidMatch?.[1]?.trim() || '',
      timestamp: Date.now(),
      userId,
      sector: trade.sector,
    };

    // Store the lesson in memory
    await storeTradeLessson(lesson);

    // Also update the original decision's outcome if we can find it
    await updateDecisionOutcome(trade.symbol, trade.netPnL, lesson.lesson, userId);

    console.log(`[Prime][${userId}] Trade lesson recorded for ${trade.symbol}: ${lesson.mistakeType} — ${lesson.lesson.slice(0, 80)}`);
    return lesson;
  } catch (err: any) {
    console.error(`[Prime][${userId}] Failed to analyze trade outcome for ${trade.symbol}:`, err.message);
    return null;
  }
}

/**
 * Store a trade lesson in Prime's memory
 */
async function storeTradeLessson(lesson: TradeLesson): Promise<void> {
  const ttl = Math.floor(lesson.timestamp / 1000) + (90 * 24 * 60 * 60); // 90 days TTL

  await docClient.send(new PutCommand({
    TableName: MEMORY_TABLE,
    Item: {
      pk: `USER#${lesson.userId}#LESSON`,
      sk: `${lesson.timestamp}#${lesson.id}`,
      gsi1pk: `USER#${lesson.userId}#LESSON#${lesson.symbol}`,
      gsi1sk: `${lesson.timestamp}`,
      ...lesson,
      ttl,
    },
  }));
}

/**
 * Update the original decision record with the trade outcome
 */
async function updateDecisionOutcome(symbol: string, pnl: number, notes: string, userId: string): Promise<void> {
  try {
    const recentDecisions = await getRecentDecisions(symbol, 1, userId);
    if (recentDecisions.length > 0) {
      const decision = recentDecisions[0];
      decision.outcome = {
        actualAction: 'ENTERED_AND_CLOSED',
        pnl,
        notes: notes.slice(0, 200),
      };
      await storeDecision(decision, userId);
    }
  } catch (err: any) {
    // Non-critical — log and continue
    console.warn(`[Prime] Failed to update decision outcome for ${symbol}:`, err.message);
  }
}

/**
 * Get recent trade lessons (across all symbols, most recent first)
 */
export async function getRecentLessons(limit: number = 10, userId?: string): Promise<TradeLesson[]> {
  const user = userId || DEFAULT_USER_ID;
  const result = await docClient.send(new QueryCommand({
    TableName: MEMORY_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user}#LESSON` },
    ScanIndexForward: false,
    Limit: limit,
  }));

  return (result.Items || []) as TradeLesson[];
}

/**
 * Get lessons for a specific symbol
 */
export async function getLessonsForSymbol(symbol: string, limit: number = 5, userId?: string): Promise<TradeLesson[]> {
  const user = userId || DEFAULT_USER_ID;
  const result = await docClient.send(new QueryCommand({
    TableName: MEMORY_TABLE,
    IndexName: 'gsi1',
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: { ':pk': `USER#${user}#LESSON#${symbol}` },
    ScanIndexForward: false,
    Limit: limit,
  }));

  return (result.Items || []) as TradeLesson[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Consultation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Consult Professor (Alpha) for news and fundamental context
 */
export async function consultProfessor(symbol: string, userId?: string, currentPrice?: number, techData?: any): Promise<AgentConsultation> {
  const timestamp = Date.now();
  const question = `What is the current news sentiment and fundamental outlook for ${symbol}? Any recent developments I should know about?`;

  // Fetch RAG news + Yahoo Finance data in parallel
  const yahooTicker = `${symbol}.NS`;
  const [ragResult, yahooResult] = await Promise.all([
    // 1) RAG news (12s timeout)
    (async () => {
      try {
        const ragController = new AbortController();
        const ragTimeout = setTimeout(() => ragController.abort(), 12000);
        const response = await lambdaClient.send(new InvokeCommand({
          FunctionName: 'stock-news-rag-query',
          Payload: Buffer.from(JSON.stringify({
            query: `Latest news, sentiment, and key developments for ${symbol} stock. Include any earnings, management changes, sector trends.`,
            symbol,
          })),
        }), { abortSignal: ragController.signal });
        clearTimeout(ragTimeout);
        const result = JSON.parse(new TextDecoder().decode(response.Payload));
        const body = typeof result.body === 'string' ? JSON.parse(result.body) : result;
        return body.answer || body.response || body.summary || '';
      } catch {
        return '';
      }
    })(),

    // 2) Yahoo Finance chart metadata + Google News RSS (6s timeout)
    (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const [chartRes, newsRss] = await Promise.all([
          fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=1y&interval=1d`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: ctrl.signal,
          }).then(r => r.json() as Promise<any>).catch(() => null),
          fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(symbol + ' stock NSE')}&hl=en-IN&gl=IN&ceid=IN:en`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: ctrl.signal,
          }).then(r => r.text()).catch(() => ''),
        ]);
        clearTimeout(t);

        const meta = chartRes?.chart?.result?.[0]?.meta || {};

        // Parse RSS XML for headlines
        const headlines: string[] = [];
        const titleRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>/g;
        let rssMatch;
        while ((rssMatch = titleRegex.exec(newsRss)) !== null && headlines.length < 5) {
          const title = rssMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          const source = rssMatch[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          headlines.push(`- ${title} (${source})`);
        }

        return {
          companyName: meta.longName || meta.shortName || symbol,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
          yearStartPrice: meta.chartPreviousClose,
          headlines: headlines.join('\n'),
        };
      } catch {
        return { companyName: symbol, headlines: '' };
      }
    })(),
  ]);

  // Build comprehensive context
  let newsContext = '';
  if (ragResult) newsContext += `RAG News Analysis:\n${ragResult}\n`;
  if (yahooResult.headlines) newsContext += `\nRecent Headlines:\n${yahooResult.headlines}\n`;
  if (!ragResult && !yahooResult.headlines) newsContext = 'No recent news available for this stock.';

  // Stock metadata
  let metaContext = '';
  if (yahooResult.companyName !== symbol) metaContext += `Company: ${yahooResult.companyName}\n`;
  if (yahooResult.fiftyTwoWeekHigh) metaContext += `52-Week High: ₹${yahooResult.fiftyTwoWeekHigh} | 52-Week Low: ₹${yahooResult.fiftyTwoWeekLow}\n`;
  if (yahooResult.yearStartPrice && currentPrice) {
    const ytdChange = ((currentPrice - yahooResult.yearStartPrice) / yahooResult.yearStartPrice * 100).toFixed(1);
    metaContext += `YTD Change: ${Number(ytdChange) > 0 ? '+' : ''}${ytdChange}%\n`;
  }

  // Technical summary (if available)
  let techSummary = '';
  if (techData && techData.current_price) {
    techSummary = `Technical Summary: RSI ${techData.rsi?.value} (${techData.rsi?.signal}), Trend: ${techData.trend?.trend}, MACD: ${techData.macd?.signal_interpretation}, Support: ₹${techData.support_resistance?.support}, Resistance: ₹${techData.support_resistance?.resistance}, Volume: ${techData.volume?.current?.toLocaleString()} (avg: ${techData.volume?.average_20d?.toLocaleString()})`;
  }

  // Generate Professor's response using Claude
  const priceNote = currentPrice ? `Current Market Price: ₹${currentPrice} (verified live data — use ONLY this price, do NOT make up a different price)` : '';
  const prompt = `You are Professor (Alpha), a research and fundamentals agent for Indian stock markets. Prime (Sigma) is asking for your assessment on ${symbol}.

${priceNote}
${metaContext}
${techSummary}

News/Context:
${newsContext}

Prime's Question: ${question}

Instructions:
1. Provide a comprehensive analysis combining news, fundamentals, and market context
2. If news headlines are available, reference specific ones
3. Comment on the 52-week range position and what it implies
4. Give a clear sentiment verdict: Bullish / Bearish / Neutral with reasoning
5. If sector/industry trends are relevant, mention them
6. Keep it 4-6 sentences — analytical and data-driven
7. CRITICAL: Do NOT fabricate any numbers. Only use data provided above.

Respond as Professor:`;

  const responseText = await callClaude(prompt);
  const response = responseText || 'No significant news to report. Maintaining neutral stance pending new information.';

  // Determine sentiment from response
  const lowerResponse = response.toLowerCase();
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (lowerResponse.includes('bullish') || lowerResponse.includes('positive') || lowerResponse.includes('favorable') || lowerResponse.includes('strong buy')) {
    sentiment = 'positive';
  } else if (lowerResponse.includes('bearish') || lowerResponse.includes('negative') || lowerResponse.includes('caution') || lowerResponse.includes('sell') || lowerResponse.includes('concern')) {
    sentiment = 'negative';
  }

  const consultation: AgentConsultation = {
    agentId: 'alpha',
    agentName: 'Professor',
    question,
    response,
    timestamp,
    userId,
    sentiment,
  };

  await storeConsultation(symbol, consultation, userId);
  return consultation;
}

/**
 * Consult Techno-Kid (Beta) for technical analysis
 */
export async function consultTechnoKid(symbol: string, userId?: string): Promise<AgentConsultation> {
  const timestamp = Date.now();
  const question = `What are the key technical levels and signals for ${symbol}? Is the setup favorable for entry/exit?`;

  // Get technical data from Zerodha
  let techData: any = null;
  try {
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'zerodha-technical-indicators',
      Payload: Buffer.from(JSON.stringify({ symbol, days: 365 })),
    }));
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    techData = typeof result.body === 'string' ? JSON.parse(result.body) : result;
  } catch (err) {
    techData = { error: 'Technical data unavailable' };
  }

  // Fallback: Yahoo Finance when Zerodha is unavailable
  if (!techData || techData.error) {
    try {
      // 6 months for flag/cup detection + better volume baseline
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?interval=1d&range=6mo`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = (await res.json()) as any;
      const chartResult = data?.chart?.result?.[0];
      const meta = chartResult?.meta;
      const quote = chartResult?.indicators?.quote?.[0] || {};

      // Extract OHLCV arrays, filtering nulls
      const closes: number[] = (quote.close || []).filter((c: any) => c != null);
      const highs: number[] = (quote.high || []).filter((h: any) => h != null);
      const lows: number[] = (quote.low || []).filter((l: any) => l != null);
      const volumes: number[] = (quote.volume || []).filter((v: any) => v != null);

      if (meta?.regularMarketPrice && closes.length >= 20) {
        const price = meta.regularMarketPrice;

        // ── RSI (14-period) ──────────────────────────────────────────────────
        const gains: number[] = [];
        const losses: number[] = [];
        for (let i = closes.length - 14; i < closes.length; i++) {
          const change = closes[i] - closes[i - 1];
          if (change > 0) gains.push(change); else losses.push(Math.abs(change));
        }
        const avgGain = gains.reduce((s, g) => s + g, 0) / 14;
        const avgLoss = losses.reduce((s, l) => s + l, 0) / 14 || 0.001;
        const rsi = Math.round((100 - (100 / (1 + avgGain / avgLoss))) * 10) / 10;

        // ── SMAs ─────────────────────────────────────────────────────────────
        const sma20 = closes.slice(-20).reduce((s, c) => s + c, 0) / 20;
        const sma50 = closes.length >= 50 ? closes.slice(-50).reduce((s, c) => s + c, 0) / 50 : null;
        const trend = price > sma20 ? 'uptrend' : 'downtrend';

        // ── Bollinger Bands (20, 2σ) — squeeze detection ─────────────────────
        const variance = closes.slice(-20).reduce((s, c) => s + (c - sma20) ** 2, 0) / 20;
        const stdDev = Math.sqrt(variance);
        const bbUpper = Math.round((sma20 + 2 * stdDev) * 100) / 100;
        const bbLower = Math.round((sma20 - 2 * stdDev) * 100) / 100;
        const bbWidth = Math.round(((bbUpper - bbLower) / sma20) * 10000) / 100; // % of price
        const bbSqueeze = bbWidth < 4; // <4% = energy coiling

        // ── ATR (14-period) — volatility & consolidation ──────────────────────
        const atrN = Math.min(14, closes.length - 1);
        const trValues: number[] = [];
        for (let i = closes.length - atrN; i < closes.length; i++) {
          const h = highs[i] ?? closes[i];
          const l = lows[i] ?? closes[i];
          const pc = closes[i - 1] ?? closes[i];
          trValues.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
        }
        const atr = Math.round((trValues.reduce((s, v) => s + v, 0) / trValues.length) * 100) / 100;
        const atrPct = Math.round((atr / price) * 10000) / 100; // ATR as % of price

        // ATR compression (last 5 vs last 14 days) — consolidation
        const atrShort = trValues.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, trValues.length);
        const isConsolidating = atrShort < (atr * 0.7); // short ATR < 70% of avg

        // ── Support / Resistance (20-day range) ───────────────────────────────
        const support = Math.min(...(lows.length ? lows.slice(-20) : closes.slice(-20)));
        const resistance = Math.max(...(highs.length ? highs.slice(-20) : closes.slice(-20)));
        const distToResistancePct = Math.round(((resistance - price) / price) * 10000) / 100;
        const isAboveResistance = price > resistance;

        // ── Volume analysis ───────────────────────────────────────────────────
        const avgVol20 = volumes.length >= 20
          ? volumes.slice(-20).reduce((s, v) => s + v, 0) / 20 : null;
        const lastVol = volumes[volumes.length - 1] || null;
        const volRatio = avgVol20 && lastVol
          ? Math.round((lastVol / avgVol20) * 100) / 100 : null;
        const volConfirmed = volRatio !== null && volRatio >= 1.5;
        const falseBreakoutRisk = isAboveResistance && volRatio !== null && volRatio < 0.8;

        // ── Flag pattern (strong recent move + consolidation) ─────────────────
        const change5d = closes.length >= 6
          ? Math.round(((price - closes[closes.length - 6]) / closes[closes.length - 6]) * 10000) / 100 : 0;
        const isBullFlag = change5d >= 3 && isConsolidating;
        const isBearFlag = change5d <= -3 && isConsolidating;

        // ── 6-month high breakout proximity ───────────────────────────────────
        const periodHigh = Math.max(...(highs.length ? highs : closes));
        const near6mHigh = price >= periodHigh * 0.98;

        // ── SuperTrend (period=10, multiplier=3) ──────────────────────────────
        let superTrendDirection: 'bullish' | 'bearish' = 'bearish';
        let superTrendLine: number | null = null;
        const stPeriod = 10;
        const stMultiplier = 3;

        if (highs.length >= stPeriod + 1 && lows.length >= stPeriod + 1) {
          // Per-bar True Range
          const barTR: number[] = [];
          for (let i = 1; i < closes.length; i++) {
            const h = highs[i] ?? closes[i];
            const l = lows[i] ?? closes[i];
            const pc = closes[i - 1];
            barTR.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
          }

          // Wilder-smoothed ATR
          const smoothATR: number[] = new Array(barTR.length).fill(0);
          smoothATR[stPeriod - 1] = barTR.slice(0, stPeriod).reduce((s, v) => s + v, 0) / stPeriod;
          for (let i = stPeriod; i < barTR.length; i++) {
            smoothATR[i] = (smoothATR[i - 1] * (stPeriod - 1) + barTR[i]) / stPeriod;
          }

          // Band and direction computation
          const finalUpper: number[] = new Array(closes.length).fill(0);
          const finalLower: number[] = new Array(closes.length).fill(0);
          const isBull: boolean[] = new Array(closes.length).fill(true);

          for (let i = stPeriod; i < closes.length; i++) {
            const sATR = smoothATR[i - 1] || 0; // barTR is offset by 1
            const hl2 = ((highs[i] ?? closes[i]) + (lows[i] ?? closes[i])) / 2;
            const basicUpper = hl2 + stMultiplier * sATR;
            const basicLower = hl2 - stMultiplier * sATR;

            finalUpper[i] = (i > stPeriod && basicUpper < finalUpper[i - 1]) || closes[i - 1] > finalUpper[i - 1]
              ? basicUpper : finalUpper[i - 1];
            finalLower[i] = (i > stPeriod && basicLower > finalLower[i - 1]) || closes[i - 1] < finalLower[i - 1]
              ? basicLower : finalLower[i - 1];

            if (i === stPeriod) {
              isBull[i] = closes[i] > basicUpper;
            } else {
              isBull[i] = isBull[i - 1] ? closes[i] >= finalLower[i] : closes[i] > finalUpper[i];
            }
          }

          const li = closes.length - 1;
          superTrendDirection = isBull[li] ? 'bullish' : 'bearish';
          superTrendLine = Math.round((isBull[li] ? finalLower[li] : finalUpper[li]) * 100) / 100;
        }

        // ── Overall signal — SuperTrend is the primary deciding factor ─────────
        let overallSignal = 'NEUTRAL';
        if (superTrendDirection === 'bullish') {
          if (volConfirmed && isAboveResistance) overallSignal = 'BREAKOUT_BUY';
          else if (isBullFlag) overallSignal = 'BULL_FLAG';
          else if (near6mHigh) overallSignal = 'BUY';
          else if (bbSqueeze) overallSignal = 'SQUEEZE_WATCH';
          else overallSignal = 'BUY';
        } else {
          if (falseBreakoutRisk) overallSignal = 'FALSE_BREAKOUT';
          else if (isBearFlag) overallSignal = 'BEAR_FLAG';
          else if (bbSqueeze) overallSignal = 'SQUEEZE_WATCH';
          else overallSignal = 'SELL';
        }

        techData = {
          current_price: price,
          rsi: { value: rsi, signal: rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : rsi < 40 ? 'bullish' : rsi > 60 ? 'bearish' : 'neutral' },
          supertrend: { direction: superTrendDirection, line: superTrendLine },
          trend: { trend, strength: 'moderate' },
          sma: { sma20: Math.round(sma20 * 100) / 100, sma50: sma50 ? Math.round(sma50 * 100) / 100 : null },
          support_resistance: {
            support: Math.round(support * 100) / 100,
            resistance: Math.round(resistance * 100) / 100,
            distToResistancePct,
          },
          bollinger: { upper: bbUpper, lower: bbLower, width: bbWidth, squeeze: bbSqueeze },
          atr: { value: atr, pct: atrPct, consolidating: isConsolidating },
          volume: { ratio: volRatio, confirmed: volConfirmed },
          patterns: {
            bullFlag: isBullFlag,
            bearFlag: isBearFlag,
            falseBreakoutRisk,
            near6mHigh,
            isAboveResistance,
            change5d,
          },
          macd: { signal_interpretation: trend === 'uptrend' ? 'bullish' : 'bearish' },
          overall_signal: overallSignal,
          dataSource: 'yahoo',
        };
      }
    } catch (err) {
      console.log('Yahoo Finance fallback for consultTechnoKid failed:', err);
    }
  }

  // Generate Techno-Kid's response
  let techSummary = 'Technical data unavailable.';
  if (techData && !techData.error) {
    const d = techData;
    const st = d.supertrend ? `SuperTrend: ${d.supertrend.direction?.toUpperCase()} (line ₹${d.supertrend.line ?? 'N/A'})` : '';
    const bb = d.bollinger ? `BB: width ${d.bollinger.width}%${d.bollinger.squeeze ? ' [SQUEEZE]' : ''}, upper ₹${d.bollinger.upper}, lower ₹${d.bollinger.lower}` : '';
    const vol = d.volume?.ratio != null ? `Volume ratio: ${d.volume.ratio}x avg${d.volume.confirmed ? ' [CONFIRMED]' : d.volume.ratio < 0.8 ? ' [WEAK]' : ''}` : '';
    const atrStr = d.atr ? `ATR: ₹${d.atr.value} (${d.atr.pct}%)${d.atr.consolidating ? ' [CONSOLIDATING]' : ''}` : '';
    const smaStr = d.sma ? `SMA20: ₹${d.sma.sma20}${d.sma.sma50 ? `, SMA50: ₹${d.sma.sma50}` : ''}` : '';
    const patterns: string[] = [];
    if (d.patterns?.bullFlag) patterns.push('BULL FLAG forming');
    if (d.patterns?.bearFlag) patterns.push('BEAR FLAG forming');
    if (d.patterns?.falseBreakoutRisk) patterns.push('FALSE BREAKOUT risk (broke resistance on weak volume)');
    if (d.patterns?.near6mHigh) patterns.push('Near 6-month HIGH');
    if (d.patterns?.isAboveResistance) patterns.push(`Above 20d resistance ₹${d.support_resistance?.resistance}`);
    const change5dStr = d.patterns?.change5d != null ? `5d change: ${d.patterns.change5d > 0 ? '+' : ''}${d.patterns.change5d}%` : '';

    techSummary = [
      `Price: ₹${d.current_price}`,
      st,
      `RSI: ${d.rsi?.value} (${d.rsi?.signal})`,
      smaStr,
      `Trend: ${d.trend?.trend}`,
      `Support: ₹${d.support_resistance?.support} | Resistance: ₹${d.support_resistance?.resistance} (${d.support_resistance?.distToResistancePct}% away)`,
      bb,
      atrStr,
      vol,
      change5dStr,
      patterns.length ? `Patterns: ${patterns.join(', ')}` : '',
      `Signal: ${d.overall_signal}`,
      d.dataSource === 'yahoo' ? '(Yahoo Finance data)' : '',
    ].filter(Boolean).join(' | ');
  }

  const prompt = `You are Techno-Kid (Beta), a breakout specialist and technical analyst for Indian F&O markets. Prime (Sigma) is consulting you about ${symbol}.

BREAKOUT IDENTIFICATION RULES you must apply:
1. SUPERTREND (primary signal): Bullish SuperTrend → bias long. Bearish SuperTrend → bias short. SuperTrend flip = high-conviction signal.
2. VOLUME BREAKOUT: Price breaks above resistance with volume ≥1.5x avg → confirmed breakout. Volume ratio <0.8 = likely false breakout / trap.
3. BOLLINGER SQUEEZE: BB width <4% → energy coiling, explosive move imminent in direction of SuperTrend.
4. RANGE BREAKOUT: Price exits 20-session consolidation (ATR consolidating) by >1% → trend starting.
5. BULL/BEAR FLAG: After ≥3% move in 5 days + consolidating ATR → flag forming. Breakout of flag = high-conviction continuation.
6. 6-MONTH HIGH BREAKOUT: Price near or above the 6-month high with rising volume → momentum breakout.
7. SMA ALIGNMENT: Price > SMA20 > SMA50 = strong uptrend structure (golden alignment). Reverse = bearish.
8. FALSE BREAKOUT: Broke resistance BUT volume <0.8x avg → trap likely. Wait for re-break with volume.
9. RSI CONTEXT: RSI 50-65 during breakout = healthy, room to run. RSI >75 at breakout = overextended. RSI rising from <35 = reversal breakout.

Technical Data:
${techSummary}

Prime's Question: ${question}

Respond as Techno-Kid: identify the BREAKOUT PATTERN (or why there isn't one), state whether SuperTrend confirms, check volume confirmation, and give the key level (entry, target, or invalidation). Be specific with ₹ levels and numbers. Keep it to 3-4 sentences.`;

  const responseText = await callClaude(prompt);

  const consultation: AgentConsultation = {
    agentId: 'beta',
    agentName: 'Techno-Kid',
    question,
    response: responseText || 'Insufficient data for technical analysis. Recommend waiting for clearer price action.',
    timestamp,
    userId,
  };

  await storeConsultation(symbol, consultation, userId);
  return consultation;
}

/**
 * Consult Risko-Frisco (Gamma) for risk assessment
 */
export async function consultRiskoFrisco(
  symbol: string,
  proposedAction: 'BUY' | 'SELL',
  entryPrice: number,
  userId?: string
): Promise<AgentConsultation> {
  const timestamp = Date.now();

  // Guard: refuse to assess risk if price is unknown
  if (!entryPrice || entryPrice <= 0) {
    return {
      agentId: 'gamma',
      agentName: 'Risko-Frisco',
      question: `Risk assessment for ${symbol} ${proposedAction}`,
      response: `${symbol}: Entry price is unavailable (₹0). Cannot compute position size, stop-loss, or capital risk. Skipping this trade until a valid live price is obtained.`,
      timestamp,
      userId,
      riskLevel: 'high',
    };
  }

  const question = `Prime is considering a ${proposedAction} on ${symbol} at ₹${entryPrice}. What's our current risk capacity and is this trade within our limits?`;

  // Get user's trading preferences if available
  let userPrefs: UserTradingPreferences | null = null;
  if (userId) {
    userPrefs = await getUserPreferences(userId);
  }

  // Get current portfolio status
  let portfolioStatus = 'Portfolio data unavailable.';
  try {
    // Check paper trading portfolio
    const { getPortfolioState, getOpenTrades } = await import('./momentum-trader/paper-trading.js');
    const [portfolio, openTrades] = await Promise.all([
      getPortfolioState(userId),
      getOpenTrades(userId),
    ]);

    const openPositions = openTrades.length;
    const capitalUtilized = openTrades.reduce((sum, t) => sum + (t.entryPrice * t.lotSize * t.futuresLots), 0);
    const unrealizedPnL = portfolio.unrealizedPnl || 0;

    // Derive available capital from starting capital + realized P&L - currently utilized
    // (portfolio.capital can be stale if a prior save failed, so recompute)
    const baseCapital = (portfolio.startingCapital || 1000000) + (portfolio.totalPnl || 0);
    const availableCapital = baseCapital - capitalUtilized;

    portfolioStatus = `Open Positions: ${openPositions}, Capital Utilized: ₹${capitalUtilized.toLocaleString()}, Unrealized P&L: ₹${unrealizedPnL.toLocaleString()}, Win Rate: ${portfolio.winRate}%, Available Capital: ₹${availableCapital.toLocaleString()}, Total Capital: ₹${baseCapital.toLocaleString()}`;
  } catch (err) {
    portfolioStatus = 'Could not fetch portfolio data.';
  }

  // Customize risk rules based on user preferences
  let riskRules = `- Max 2% risk per trade
- Max 6 open positions
- Stop at 1.5% from entry
- Target at 3% from entry (2:1 R:R minimum)`;

  if (userPrefs) {
    const riskMod = userPrefs.riskTolerance ? (userPrefs.riskTolerance / 5) : 1;
    const styleDesc = userPrefs.tradingStyle === 'aggressive' ? 'aggressive (wider stops, higher targets)'
      : userPrefs.tradingStyle === 'conservative' ? 'conservative (tighter stops, safer entries)'
      : 'moderate (balanced approach)';
    riskRules += `\n- User Trading Style: ${styleDesc}`;
    if (userPrefs.customRules?.length) {
      riskRules += `\n- Custom Rules: ${userPrefs.customRules.join(', ')}`;
    }
  }

  const prompt = `You are Risko-Frisco (Gamma), the risk manager. Prime (Sigma) is asking about a potential ${proposedAction} trade on ${symbol}.

Portfolio Status:
${portfolioStatus}

Trade Details:
- Symbol: ${symbol}
- Action: ${proposedAction}
- Entry Price: ₹${entryPrice}

Risk Rules:
${riskRules}

Prime's Question: ${question}

Assess risk neutrally based only on the portfolio status and risk rules above. Give a clear verdict:
- APPROVED: Portfolio has capacity (open positions < max), daily loss limit not breached, trade size within limits. This is the correct answer when rules are not violated.
- REDUCE SIZE: Trade is valid but size should be trimmed (e.g. position count near max).
- REJECT: Only when a hard rule is clearly broken (daily loss limit exceeded, position limit full, capital insufficient for minimum lot).

Do NOT reject based on market opinion or stock fundamentals — that is Prime's job. Keep it concise (2-3 sentences). State your verdict explicitly as APPROVED, REDUCE SIZE, or REJECT.`;

  const responseText = await callClaude(prompt);
  const response = responseText || 'Risk assessment pending. Please verify portfolio status manually.';

  // Determine risk level from response
  const lowerResponse = response.toLowerCase();
  let riskLevel: 'low' | 'medium' | 'high' = 'medium';
  if (lowerResponse.includes('approved') || lowerResponse.includes('low risk') || lowerResponse.includes('well within limits')) {
    riskLevel = 'low';
  } else if (lowerResponse.includes('reject') || lowerResponse.includes('high risk') || lowerResponse.includes('exceeds') || lowerResponse.includes('too risky') || lowerResponse.includes('not recommended')) {
    riskLevel = 'high';
  } else if (lowerResponse.includes('reduce') || lowerResponse.includes('caution') || lowerResponse.includes('moderate')) {
    riskLevel = 'medium';
  }

  const consultation: AgentConsultation = {
    agentId: 'gamma',
    agentName: 'Risko-Frisco',
    question,
    response,
    timestamp,
    userId,
    riskLevel,
  };

  await storeConsultation(symbol, consultation, userId);
  return consultation;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prime Decision Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prime's main decision-making function
 * Consults all agents and makes an informed decision (user-scoped)
 */
export interface ScreenerData {
  structure: string;       // BOS_BULLISH, BOS_BEARISH, CHOCH_BULLISH, CHOCH_BEARISH, RANGE
  confidence: number;
  trendStrength: number;
  rsi: number;
  momentum5d: number;
  volumeSurge: boolean;
  support: number;
  resistance: number;
}

export interface PortfolioContext {
  openPositions: number;
  todayPnL: number;
  totalPnL: number;
  capitalUsed: number;
  availableCapital: number;
  winRate: number;
  maxDrawdown: number;
}

export async function makeDecision(
  symbol: string,
  signal: 'BUY' | 'SELL',
  entryPrice: number,
  technicalData: any,
  userId?: string,
  screenerData?: ScreenerData,
  portfolioContext?: PortfolioContext,
): Promise<DecisionMemory> {
  const timestamp = Date.now();
  const decisionId = crypto.randomUUID();

  // Log thinking: Starting analysis
  await storeThinking({
    id: crypto.randomUUID(),
    symbol,
    phase: 'analysis',
    content: `Analyzing ${signal} signal for ${symbol} at ₹${entryPrice}. Structure: ${screenerData?.structure || 'N/A'}, Confidence: ${screenerData?.confidence || 'N/A'}%`,
    timestamp,
  }, userId);

  // Fetch user rules and preferences in parallel with agent consultations
  const user = userId || DEFAULT_USER_ID;
  const [
    professorResponse,
    technoKidResponse,
    riskoFriscoResponse,
    tradingRules,
    userPrefs,
  ] = await Promise.all([
    consultProfessor(symbol, userId),
    consultTechnoKid(symbol, userId),
    consultRiskoFrisco(symbol, signal, entryPrice, userId),
    getTradingRules(user),
    getUserPreferences(user),
  ]);

  const consultations = [professorResponse, technoKidResponse, riskoFriscoResponse];

  // ─────────────────────────────────────────────────────────────────────────
  // Structured pre-score — deterministic confidence anchor derived from data.
  // Prime receives this and must justify any significant deviation from it.
  // ─────────────────────────────────────────────────────────────────────────
  const scoreBreakdown: string[] = [];
  let preScore = 0;

  // 1. Smart money structure alignment (screener) — up to 25 pts
  if (screenerData) {
    const structure = screenerData.structure || '';
    const isBullish = structure.includes('BULLISH');
    const isBearish = structure.includes('BEARISH');
    const isBOS = structure.includes('BOS');
    const isCHOCH = structure.includes('CHOCH');
    const alignedWithSignal = (signal === 'BUY' && isBullish) || (signal === 'SELL' && isBearish);

    if (alignedWithSignal && isBOS) {
      preScore += 25; scoreBreakdown.push('BOS aligned +25');
    } else if (alignedWithSignal && isCHOCH) {
      preScore += 18; scoreBreakdown.push('CHOCH aligned +18');
    } else if (!isBullish && !isBearish) {
      preScore += 5; scoreBreakdown.push('RANGE structure +5');
    }

    // 2. Screener's own confidence — up to 20 pts
    const screenerBonus = Math.round((screenerData.confidence || 0) * 0.20);
    preScore += screenerBonus;
    scoreBreakdown.push(`screener confidence ${screenerData.confidence}% → +${screenerBonus}`);

    // 3. Volume surge — +8 pts
    if (screenerData.volumeSurge) {
      preScore += 8; scoreBreakdown.push('volume surge +8');
    }

    // 4. 5-day momentum alignment — +5 pts
    const momentumAligned = (signal === 'BUY' && screenerData.momentum5d > 0) ||
                            (signal === 'SELL' && screenerData.momentum5d < 0);
    if (momentumAligned) {
      preScore += 5; scoreBreakdown.push(`momentum5d aligned (${screenerData.momentum5d}%) +5`);
    }

    // 5. Trend strength — up to +5 pts
    if (screenerData.trendStrength >= 70) {
      preScore += 5; scoreBreakdown.push(`trend strength ${screenerData.trendStrength} +5`);
    } else if (screenerData.trendStrength >= 40) {
      preScore += 2; scoreBreakdown.push(`trend strength ${screenerData.trendStrength} +2`);
    }

    // 6. RSI zone — up to ±8 pts
    const rsi = screenerData.rsi;
    if (signal === 'BUY') {
      if (rsi >= 35 && rsi <= 65)      { preScore += 8; scoreBreakdown.push(`RSI ${rsi} healthy +8`); }
      else if (rsi < 35)               { preScore += 5; scoreBreakdown.push(`RSI ${rsi} oversold bounce +5`); }
      else if (rsi > 65 && rsi <= 75)  { preScore += 3; scoreBreakdown.push(`RSI ${rsi} extended +3`); }
      else if (rsi > 75)               { preScore -= 5; scoreBreakdown.push(`RSI ${rsi} overbought -5`); }
    } else {
      if (rsi >= 35 && rsi <= 65)      { preScore += 8; scoreBreakdown.push(`RSI ${rsi} healthy short +8`); }
      else if (rsi > 65)               { preScore += 5; scoreBreakdown.push(`RSI ${rsi} overbought short +5`); }
      else if (rsi < 35)               { preScore -= 5; scoreBreakdown.push(`RSI ${rsi} oversold short -5`); }
    }
  }

  // 7. Techno-Kid sentiment — up to ±12 pts
  const tkSentiment = technoKidResponse.sentiment;
  const tkAligned = (signal === 'BUY' && tkSentiment === 'positive') ||
                    (signal === 'SELL' && tkSentiment === 'negative');
  const tkOpposed = (signal === 'BUY' && tkSentiment === 'negative') ||
                    (signal === 'SELL' && tkSentiment === 'positive');
  if (tkAligned)      { preScore += 12; scoreBreakdown.push('Techno-Kid aligned +12'); }
  else if (tkOpposed) { preScore -= 5;  scoreBreakdown.push('Techno-Kid opposed -5'); }
  else                { preScore += 5;  scoreBreakdown.push('Techno-Kid neutral +5'); }

  // 8. Professor sentiment — up to ±8 pts
  const profSentiment = professorResponse.sentiment;
  const profAligned = (signal === 'BUY' && profSentiment === 'positive') ||
                      (signal === 'SELL' && profSentiment === 'negative');
  const profOpposed = (signal === 'BUY' && profSentiment === 'negative') ||
                      (signal === 'SELL' && profSentiment === 'positive');
  if (profAligned)      { preScore += 8; scoreBreakdown.push('Professor aligned +8'); }
  else if (profOpposed) { preScore -= 5; scoreBreakdown.push('Professor opposed -5'); }
  else                  { preScore += 3; scoreBreakdown.push('Professor neutral +3'); }

  // 9. Risko-Frisco risk verdict — up to ±20 pts
  const riskoLevel = riskoFriscoResponse.riskLevel;
  if (riskoLevel === 'low')       { preScore += 10; scoreBreakdown.push('Risko APPROVED +10'); }
  else if (riskoLevel === 'medium') { preScore += 5; scoreBreakdown.push('Risko CAUTION +5'); }
  else if (riskoLevel === 'high') { preScore -= 20; scoreBreakdown.push('Risko REJECT -20'); }

  // Clamp to [20, 95] — never 0 (avoid divide-by-zero in downstream), never overconfident
  preScore = Math.max(20, Math.min(95, preScore));
  const preScoreSummary = `Pre-score: ${preScore}/95 [${scoreBreakdown.join(' | ')}]`;

  // Log thinking: Consultation complete
  await storeThinking({
    id: crypto.randomUUID(),
    symbol,
    phase: 'consultation',
    content: `Consulted Professor (${professorResponse.response.slice(0, 50)}...), Techno-Kid (${technoKidResponse.response.slice(0, 50)}...), Risko-Frisco (${riskoFriscoResponse.response.slice(0, 50)}...) | ${preScoreSummary}`,
    timestamp: Date.now(),
  }, userId);

  // Get recent decisions for this symbol for context (user-scoped)
  const [recentDecisions, symbolLessons, recentLessons] = await Promise.all([
    getRecentDecisions(symbol, 3, userId),
    getLessonsForSymbol(symbol, 3, userId),
    getRecentLessons(5, userId),
  ]);
  const recentContext = recentDecisions.length > 0
    ? recentDecisions.map(d => {
        const outcomeStr = d.outcome ? ` → P&L: ₹${d.outcome.pnl || 0}` : '';
        return `${new Date(d.timestamp).toLocaleDateString()}: ${d.action} - ${d.rationale.slice(0, 100)}${outcomeStr}`;
      }).join('\n')
    : 'No recent decisions for this symbol.';

  // Build lessons context — both symbol-specific and general
  const allLessons = [...symbolLessons];
  for (const lesson of recentLessons) {
    if (!allLessons.find(l => l.id === lesson.id)) allLessons.push(lesson);
  }
  const lessonsContext = allLessons.length > 0
    ? allLessons.slice(0, 7).map(l =>
        `- ${l.symbol} ${l.signal} (₹${l.netPnL}): ${l.mistakeType} — ${l.lesson}${l.avoidPattern ? ` [AVOID: ${l.avoidPattern}]` : ''}`
      ).join('\n')
    : 'No lessons recorded yet — this is a fresh start.';

  // Build user context sections
  const userStyleSection = userPrefs
    ? `\nUSER TRADING STYLE: ${userPrefs.tradingStyle || 'moderate'}
- Risk Tolerance: ${userPrefs.riskTolerance || 5}/10
- Preferred Sectors: ${userPrefs.preferredSectors?.join(', ') || 'All'}
${userPrefs.customRules?.length ? `- Custom Rules: ${userPrefs.customRules.join('; ')}` : ''}`
    : '';

  const rulesSection = `
USER'S TRADING RULES:
Entry Rules: ${tradingRules.entryRules.join(' | ')}
Exit Rules: ${tradingRules.exitRules.join(' | ')}
Risk Rules: ${tradingRules.riskRules.join(' | ')}
Config: maxPositions=${tradingRules.config.maxPositions}, maxRiskPerTrade=${tradingRules.config.maxRiskPerTradePct}%, dailyLossLimit=${tradingRules.config.dailyLossLimitPct}%, R:R min=${tradingRules.config.minRewardRiskRatio}`;

  const screenerSection = screenerData
    ? `\nSMART MONEY SCAN DATA:
- Structure: ${screenerData.structure} (${screenerData.confidence}% confidence)
- Trend Strength: ${screenerData.trendStrength}
- RSI: ${screenerData.rsi}
- 5d Momentum: ${screenerData.momentum5d}%
- Volume Surge: ${screenerData.volumeSurge ? 'YES' : 'No'}
- Support: ₹${screenerData.support} | Resistance: ₹${screenerData.resistance}`
    : '';

  const portfolioSection = portfolioContext
    ? `\nPORTFOLIO STATE:
- Open Positions: ${portfolioContext.openPositions}/${tradingRules.config.maxPositions}
- Today's P&L: ₹${portfolioContext.todayPnL.toLocaleString()}
- Total P&L: ₹${portfolioContext.totalPnL.toLocaleString()}
- Capital Used: ₹${portfolioContext.capitalUsed.toLocaleString()}
- Available Capital: ₹${portfolioContext.availableCapital.toLocaleString()}
- Win Rate: ${portfolioContext.winRate}%
- Max Drawdown: ${portfolioContext.maxDrawdown}%`
    : '';

  // Prime makes the final decision using Claude
  const decisionPrompt = `You are Prime (Sigma), the intelligent trade hunter and capital protector for the Trading Squad. You make final decisions on trade entries after consulting your squad and evaluating user-defined rules.
${userStyleSection}
${rulesSection}

SIGNAL DETAILS:
- Symbol: ${symbol}
- Signal: ${signal}
- Entry Price: ₹${entryPrice}
- Technical Score: ${technicalData?.overall_signal || 'N/A'}
- RSI: ${technicalData?.rsi?.value || 'N/A'}
- Trend: ${technicalData?.trend?.trend || 'N/A'}
${screenerSection}
${portfolioSection}

AGENT CONSULTATIONS:

Professor (News/Fundamentals):
"${professorResponse.response}"

Techno-Kid (Technical Analysis):
"${technoKidResponse.response}"

Risko-Frisco (Risk Assessment):
"${riskoFriscoResponse.response}"

RECENT HISTORY:
${recentContext}

LESSONS FROM PAST TRADES (DO NOT REPEAT THESE MISTAKES):
${lessonsContext}

DECISION FRAMEWORK:
1. HARD BLOCKS (the ONLY valid reasons to SKIP): daily loss limit breached, position limit full, no stop-loss possible, Risko explicitly says REJECT with a specific rule violation.
2. If Risko says APPROVED or REDUCE SIZE — the trade is within risk limits. ENTER (or ENTER with reduced size). Do NOT override Risko's APPROVED with a SKIP.
3. If portfolio context is missing or unclear — assume 0 open positions and full capital available. Err on the side of ENTERING.
4. Technical signal (BUY/SELL) already confirms direction — no additional BOS/CHOCH confirmation required. Trust the signal.
5. Agent majority (2 of 3 supportive) is sufficient. A lone cautious opinion does not veto entry.
6. HOLD means: signal detected but wait for a better price or confirmation in the next cycle.
7. SKIP means: hard rule violation only. NOT "I'm not sure" or "market looks risky."
8. This is paper trading — the PURPOSE is to learn by taking trades. An empty portfolio that never trades teaches nothing.
9. DEFAULT ACTION: When in doubt between ENTER and HOLD/SKIP, choose ENTER. Bias toward action.

STRUCTURED PRE-SCORE (deterministic calculation from raw data — your CONFIDENCE must stay within ±15 of this unless you have a specific reason to deviate, which you must state in RATIONALE):
${preScoreSummary}

Make your decision. Respond in this exact format:
ACTION: [ENTER/HOLD/SKIP]
CONFIDENCE: [1-100]
RATIONALE: [2-3 sentence explanation addressing user rules, capital protection, each agent's input, and why you decided this way]
HUMAN_MESSAGE: [A clear message to the human trader explaining your decision in plain terms]`;

  const decisionResponse = await callClaudeOpus(decisionPrompt);

  // Parse the decision
  const actionMatch = decisionResponse.match(/ACTION:\s*(ENTER|HOLD|SKIP)/i);
  const confidenceMatch = decisionResponse.match(/CONFIDENCE:\s*(\d+)/i);
  const rationaleMatch = decisionResponse.match(/RATIONALE:\s*(.+?)(?=HUMAN_MESSAGE:|$)/is);
  const humanMessageMatch = decisionResponse.match(/HUMAN_MESSAGE:\s*(.+)/is);

  const action = (actionMatch?.[1]?.toUpperCase() || 'SKIP') as 'ENTER' | 'HOLD' | 'SKIP';
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1], 10) : preScore;
  const rationale = rationaleMatch?.[1]?.trim() || decisionResponse;
  const humanMessage = humanMessageMatch?.[1]?.trim() || rationale;

  // Log thinking: Decision made
  await storeThinking({
    id: crypto.randomUUID(),
    symbol,
    phase: 'decision',
    content: `Decision: ${action} with ${confidence}% confidence. ${rationale}`,
    timestamp: Date.now(),
  }, userId);

  // Create decision memory
  const decision: DecisionMemory = {
    id: decisionId,
    symbol,
    action,
    signal,
    confidence,
    rationale,
    consultations,
    technicalData,
    newsContext: professorResponse.response,
    riskAssessment: riskoFriscoResponse.response,
    timestamp,
    userId,
  };

  // Store the decision (user-scoped)
  await storeDecision(decision, userId);

  // Log thinking: Communication to human
  await storeThinking({
    id: crypto.randomUUID(),
    symbol,
    phase: 'communication',
    content: `Communicating to human: ${humanMessage}`,
    timestamp: Date.now(),
  }, userId);

  return decision;
}

/**
 * Generate a summary of Prime's recent activity for human (user-scoped)
 */
export async function generateHumanSummary(userId?: string): Promise<string> {
  const todaysDecisions = await getTodaysDecisions(userId);

  if (todaysDecisions.length === 0) {
    return "No trading decisions made today yet. I'm monitoring the markets and will consult the squad when opportunities arise.";
  }

  const entered = todaysDecisions.filter(d => d.action === 'ENTER');
  const skipped = todaysDecisions.filter(d => d.action === 'SKIP');
  const held = todaysDecisions.filter(d => d.action === 'HOLD');

  let summary = `Today's Activity Summary:\n`;
  summary += `- Analyzed: ${todaysDecisions.length} opportunities\n`;
  summary += `- Entered: ${entered.length} trades\n`;
  summary += `- Skipped: ${skipped.length} (didn't meet criteria)\n`;
  summary += `- Holding: ${held.length} (waiting for better entry)\n\n`;

  if (entered.length > 0) {
    summary += `Trades Entered:\n`;
    for (const d of entered) {
      summary += `• ${d.symbol} ${d.signal} @ ${d.confidence}% confidence\n`;
      summary += `  Reason: ${d.rationale.slice(0, 100)}...\n`;
    }
  }

  if (skipped.length > 0) {
    summary += `\nSkipped Opportunities:\n`;
    for (const d of skipped.slice(0, 3)) {
      summary += `• ${d.symbol}: ${d.rationale.slice(0, 80)}...\n`;
    }
  }

  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prime's decision model: Nova Pro (APAC, cost-optimized).
 * Nova Pro is ~13x more capable than Nova Lite at $0.80/$3.20 per MTok.
 * Falls back to Haiku → Nova Lite if Nova Pro is unavailable.
 * Cost: ~$0.003/decision → ~$5.50/user/month
 */
async function callClaudeOpus(prompt: string, maxTokens: number = 1500): Promise<string> {
  const models: Array<{ id: string; format: 'nova' | 'claude' }> = [
    { id: 'apac.amazon.nova-pro-v1:0', format: 'nova' },
    { id: 'apac.anthropic.claude-3-haiku-20240307-v1:0', format: 'claude' },
    { id: 'apac.amazon.nova-lite-v1:0', format: 'nova' },
  ];

  for (const model of models) {
    try {
      let requestBody: string;
      if (model.format === 'nova') {
        requestBody = JSON.stringify({
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens, temperature: 0.7 },
        });
      } else {
        requestBody = JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });
      }

      // 8s timeout per model — fail fast and try next
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await bedrockClient.send(new InvokeModelCommand({
        modelId: model.id,
        contentType: 'application/json',
        accept: 'application/json',
        body: requestBody,
      }), { abortSignal: controller.signal });

      clearTimeout(timeout);
      const result = JSON.parse(new TextDecoder().decode(response.body));
      console.log(`[Prime] Decision made with ${model.id}`);

      if (model.format === 'nova') {
        return result.output?.message?.content?.[0]?.text || '';
      } else {
        return result.content?.[0]?.text || '';
      }
    } catch (err: any) {
      console.error(`Bedrock ${model.id} call failed:`, err.message || err);
      continue;
    }
  }

  return '';
}

async function callClaude(prompt: string, maxTokens: number = 1500): Promise<string> {
  // Nova Pro primary (same model as callClaudeOpus — Lite gets throttled under concurrent load)
  const models: Array<{ id: string; format: 'nova' | 'claude' }> = [
    { id: 'apac.amazon.nova-pro-v1:0', format: 'nova' },
    { id: 'apac.amazon.nova-lite-v1:0', format: 'nova' },
    { id: 'apac.anthropic.claude-3-haiku-20240307-v1:0', format: 'claude' },
  ];

  for (const model of models) {
    try {
      let requestBody: string;
      if (model.format === 'nova') {
        requestBody = JSON.stringify({
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens, temperature: 0.7 },
        });
      } else {
        requestBody = JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });
      }

      // 8s timeout per model — ensures total stays under 29s API Gateway limit
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await bedrockClient.send(new InvokeModelCommand({
        modelId: model.id,
        contentType: 'application/json',
        accept: 'application/json',
        body: requestBody,
      }), { abortSignal: controller.signal });

      clearTimeout(timeout);
      const result = JSON.parse(new TextDecoder().decode(response.body));

      if (model.format === 'nova') {
        return result.output?.message?.content?.[0]?.text || '';
      } else {
        return result.content?.[0]?.text || '';
      }
    } catch (err: any) {
      console.error(`Bedrock ${model.id} call failed:`, err.message || err);
      continue;
    }
  }

  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat/Conversation Functions
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'prime';
  content: string;
  timestamp: number;
  context?: {
    intent?: string;
    symbols?: string[];
    action?: string;
  };
}

/**
 * Store a chat message
 */
export async function storeChatMessage(message: ChatMessage): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + (TTL_DAYS * 24 * 60 * 60);

  await docClient.send(new PutCommand({
    TableName: MEMORY_TABLE,
    Item: {
      pk: `USER#${message.userId}#CHAT`,
      sk: `${message.timestamp}#${message.id}`,
      ...message,
      ttl,
    },
  }));
}

/**
 * Get chat history for a user
 */
export async function getChatHistory(userId: string, limit: number = 50): Promise<ChatMessage[]> {
  // Only return messages from the last 24 hours
  const since = String(Date.now() - 24 * 60 * 60 * 1000);

  // Fetch user-specific messages and GLOBAL decision broadcasts in parallel
  const queries = [
    docClient.send(new QueryCommand({
      TableName: MEMORY_TABLE,
      KeyConditionExpression: 'pk = :pk AND sk >= :since',
      ExpressionAttributeValues: { ':pk': `USER#${userId}#CHAT`, ':since': since },
      ScanIndexForward: false,
      Limit: limit,
    })),
  ];

  // Also fetch global Prime decision messages (autonomous decisions broadcast to all users)
  if (userId !== 'GLOBAL') {
    queries.push(
      docClient.send(new QueryCommand({
        TableName: MEMORY_TABLE,
        KeyConditionExpression: 'pk = :pk AND sk >= :since',
        ExpressionAttributeValues: { ':pk': `USER#GLOBAL#CHAT`, ':since': since },
        ScanIndexForward: false,
        Limit: limit,
      })),
    );
  }

  const results = await Promise.all(queries);
  const allMessages = results.flatMap(r => (r.Items || []) as ChatMessage[]);

  // Deduplicate by id, sort by timestamp descending, take limit, then reverse for chronological
  const seen = new Set<string>();
  const unique = allMessages.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  return unique
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .reverse();
}

/**
 * Parse user intent from message using simple NLU
 */
function parseIntent(message: string): { intent: string; symbols: string[]; params: Record<string, any> } {
  const lowerMessage = message.toLowerCase();
  const symbols: string[] = [];

  // Extract stock symbols: accept any uppercase word that looks like an NSE symbol
  // Filter out common English words that appear uppercase in user messages
  const COMMON_WORDS = new Set([
    'I', 'A', 'THE', 'AND', 'OR', 'NOT', 'IS', 'IT', 'MY', 'ME', 'DO', 'IF',
    'IN', 'ON', 'AT', 'TO', 'OF', 'FOR', 'BY', 'UP', 'SO', 'NO', 'AN', 'AM',
    'BE', 'WE', 'HE', 'AS', 'ALL', 'CAN', 'HOW', 'BUT', 'OUT', 'ARE', 'HAS',
    'HAD', 'WAS', 'GET', 'SET', 'PUT', 'RUN', 'USE', 'SAY', 'NOW', 'NEW',
    'BUY', 'SELL', 'LONG', 'SHORT', 'STOP', 'EXIT', 'HOLD', 'OPEN', 'CLOSE',
    'YES', 'OK', 'WHAT', 'WHEN', 'WHERE', 'WHO', 'WHY', 'SHOW', 'GIVE',
    'PLEASE', 'THINK', 'SHOULD', 'WOULD', 'COULD', 'WILL', 'HAVE', 'WITH',
    'FROM', 'ABOUT', 'ALSO', 'JUST', 'MORE', 'SOME', 'THAN', 'THEM', 'THEN',
    'THIS', 'THAT', 'VERY', 'WELL', 'GOOD', 'BAD', 'HIGH', 'LOW', 'TODAY',
    'STOCK', 'STOCKS', 'MARKET', 'SHARE', 'SHARES', 'PRICE', 'TRADE', 'ENTRY',
    'TARGET', 'LOSS', 'PROFIT', 'CHECK', 'LOOK', 'TELL', 'HELP', 'RISK',
    'IPO', 'PE', 'PB', 'EPS', 'CEO', 'CFO', 'AGM', 'FII', 'DII', 'ETF',
    'SIP', 'NAV', 'AUM', 'ROE', 'ROI', 'EMI', 'GDP', 'CPI', 'RBI', 'SEBI',
    'NSE', 'BSE', 'API', 'URL', 'PDF', 'CSV',
  ]);
  const symbolPattern = /\b([A-Z][A-Z0-9&]{1,14})\b/g;
  let match;
  while ((match = symbolPattern.exec(message)) !== null) {
    const potential = match[1];
    if (!COMMON_WORDS.has(potential) && !symbols.includes(potential)) {
      symbols.push(potential);
    }
  }

  // Also detect common company names typed in lowercase → map to NSE symbol
  const COMPANY_TO_SYMBOL: Record<string, string> = {
    'reliance': 'RELIANCE', 'tcs': 'TCS', 'infosys': 'INFY', 'infy': 'INFY',
    'hdfc bank': 'HDFCBANK', 'hdfc': 'HDFCBANK', 'icici bank': 'ICICIBANK', 'icici': 'ICICIBANK',
    'sbi': 'SBIN', 'state bank': 'SBIN', 'kotak': 'KOTAKBANK', 'kotak bank': 'KOTAKBANK',
    'wipro': 'WIPRO', 'hcl tech': 'HCLTECH', 'hcl': 'HCLTECH', 'tech mahindra': 'TECHM',
    'bajaj finance': 'BAJFINANCE', 'bajaj finserv': 'BAJAJFINSV', 'bajaj auto': 'BAJAJ-AUTO',
    'tata motors': 'TATAMOTORS', 'tata steel': 'TATASTEEL', 'tata power': 'TATAPOWER',
    'tata consumer': 'TATACONSUM', 'titan': 'TITAN', 'asian paints': 'ASIANPAINT',
    'maruti': 'MARUTI', 'maruti suzuki': 'MARUTI', 'mahindra': 'M&M', 'm&m': 'M&M',
    'sun pharma': 'SUNPHARMA', 'dr reddy': 'DRREDDY', 'cipla': 'CIPLA', 'divis lab': 'DIVISLAB',
    'larsen': 'LT', 'l&t': 'LT', 'adani ports': 'ADANIPORTS', 'adani enterprises': 'ADANIENT',
    'adani green': 'ADANIGREEN', 'adani power': 'ADANIPOWER',
    'ultratech': 'ULTRACEMCO', 'ultratech cement': 'ULTRACEMCO',
    'power grid': 'POWERGRID', 'ntpc': 'NTPC', 'coal india': 'COALINDIA', 'ongc': 'ONGC',
    'bharti airtel': 'BHARTIARTL', 'airtel': 'BHARTIARTL', 'jio': 'RELIANCE',
    'axis bank': 'AXISBANK', 'indusind': 'INDUSINDBK', 'indusind bank': 'INDUSINDBK',
    'nestle': 'NESTLEIND', 'hindustan unilever': 'HINDUNILVR', 'hul': 'HINDUNILVR',
    'itc': 'ITC', 'britannia': 'BRITANNIA', 'dabur': 'DABUR', 'godrej': 'GODREJCP',
    'zomato': 'ZOMATO', 'paytm': 'PAYTM', 'nykaa': 'NYKAA', 'delhivery': 'DELHIVERY',
    'gmr airport': 'GMRAIRPORT', 'gmr airports': 'GMRAIRPORT', 'gmr infra': 'GMRINFRA', 'gmr': 'GMRAIRPORT',
    'irctc': 'IRCTC', 'rvnl': 'RVNL', 'irfc': 'IRFC', 'hal': 'HAL', 'bhel': 'BHEL',
    'vedanta': 'VEDL', 'hindalco': 'HINDALCO', 'jsw steel': 'JSWSTEEL',
    'bandhan bank': 'BANDHANBNK', 'yes bank': 'YESBANK', 'pnb': 'PNB', 'bank of baroda': 'BANKBARODA',
    'coforge': 'COFORGE', 'persistent': 'PERSISTENT', 'ltimindtree': 'LTIM', 'mphasis': 'MPHASIS',
    'dixon': 'DIXON', 'polycab': 'POLYCAB', 'havells': 'HAVELLS', 'voltas': 'VOLTAS',
    'pidilite': 'PIDILITIND', 'berger paints': 'BERGEPAINT', 'grasim': 'GRASIM',
  };
  for (const [name, sym] of Object.entries(COMPANY_TO_SYMBOL)) {
    if (lowerMessage.includes(name) && !symbols.includes(sym)) {
      symbols.push(sym);
    }
  }

  // Determine intent
  let intent = 'general';
  const params: Record<string, any> = {};

  if (lowerMessage.includes('analyze') || lowerMessage.includes('analysis') || lowerMessage.includes('what do you think')) {
    intent = 'analyze_stock';
  } else if (symbols.length > 0 && (
    lowerMessage.includes('tell me about') || lowerMessage.includes('tell me more') ||
    lowerMessage.includes('more about') || lowerMessage.includes('details on') ||
    lowerMessage.includes('info on') || lowerMessage.includes('how is') ||
    lowerMessage.includes('what about') || lowerMessage.includes('look at') ||
    lowerMessage.includes('check ') || lowerMessage.includes('thoughts on') ||
    lowerMessage.includes('opinion on') || lowerMessage.includes('view on')
  )) {
    intent = 'analyze_stock';
  } else if ((lowerMessage.includes('buy') || lowerMessage.includes('long')) && symbols.length > 0 && !lowerMessage.includes('should')) {
    // Direct buy command with symbol - execute trade
    intent = 'execute_trade';
    params.direction = 'BUY';
    params.segment = (lowerMessage.includes('cash') || lowerMessage.includes('equity') || lowerMessage.includes('delivery')) ? 'CASH' : 'FUTURES';
  } else if ((lowerMessage.includes('sell') || lowerMessage.includes('short')) && symbols.length > 0 && !lowerMessage.includes('should')) {
    // Direct sell command with symbol - execute trade
    intent = 'execute_trade';
    params.direction = 'SELL';
    params.segment = (lowerMessage.includes('cash') || lowerMessage.includes('equity') || lowerMessage.includes('delivery')) ? 'CASH' : 'FUTURES';
  } else if (lowerMessage.includes('should i buy') || lowerMessage.includes('should i enter')) {
    intent = 'analyze_stock'; // Redirect to analysis for "should I" questions
  } else if (lowerMessage.includes('should i sell') || lowerMessage.includes('should i exit')) {
    intent = 'analyze_stock';
  } else if (symbols.length >= 2 && (
    lowerMessage.includes('compare') || lowerMessage.includes('vs') || lowerMessage.includes('versus') ||
    lowerMessage.includes('better') || lowerMessage.includes('which one') || lowerMessage.includes('between')
  )) {
    intent = 'compare_stocks';
  } else if (lowerMessage.includes('risk') || lowerMessage.includes('exposure')) {
    intent = 'risk_assessment';
  } else if (lowerMessage.includes('portfolio') || lowerMessage.includes('positions') || lowerMessage.includes('trades')) {
    intent = 'portfolio_status';
  } else if (lowerMessage.includes('news') || lowerMessage.includes('headlines')) {
    intent = 'news_update';
  } else if (lowerMessage.includes('summary') || lowerMessage.includes('today') || lowerMessage.includes('activity')) {
    intent = 'daily_summary';
  } else if (lowerMessage.includes('watchlist') || lowerMessage.includes('watch')) {
    intent = 'watchlist';
  } else if (lowerMessage.includes('help') || lowerMessage.includes('can you') || lowerMessage.includes('what can')) {
    intent = 'help';
  } else if (lowerMessage.includes('preference') || lowerMessage.includes('style') || lowerMessage.includes('conservative') || lowerMessage.includes('aggressive')) {
    intent = 'preferences';
  } else if (
    lowerMessage.includes('show rules') ||
    lowerMessage.includes('trading rules') ||
    lowerMessage.includes('my rules') ||
    lowerMessage.includes('current rules') ||
    lowerMessage.includes('what are the rules') ||
    lowerMessage.includes('entry rules') ||
    lowerMessage.includes('exit rules') ||
    lowerMessage.includes('risk rules')
  ) {
    intent = 'show_rules';
  } else if (
    lowerMessage.includes('change rule') ||
    lowerMessage.includes('update rule') ||
    lowerMessage.includes('edit rule') ||
    lowerMessage.includes('modify rule') ||
    lowerMessage.includes('add rule') ||
    lowerMessage.includes('remove rule') ||
    lowerMessage.includes('delete rule') ||
    lowerMessage.includes('set rule') ||
    lowerMessage.includes('new rule')
  ) {
    intent = 'edit_rules';
    // Determine which type of rule
    if (lowerMessage.includes('entry')) params.ruleType = 'entry';
    else if (lowerMessage.includes('exit')) params.ruleType = 'exit';
    else if (lowerMessage.includes('risk')) params.ruleType = 'risk';
  } else if (
    lowerMessage.includes('buy call') ||
    lowerMessage.includes('buy signal') ||
    lowerMessage.includes('opportunities') ||
    lowerMessage.includes('what looks good') ||
    lowerMessage.includes('scan') ||
    lowerMessage.includes('find stocks') ||
    lowerMessage.includes('technical call') ||
    lowerMessage.includes('momentum') ||
    lowerMessage.includes('strong stocks') ||
    lowerMessage.includes('bullish') ||
    lowerMessage.includes('what should i buy') ||
    lowerMessage.includes('what to buy') ||
    lowerMessage.includes('give me calls') ||
    lowerMessage.includes('recommend') ||
    lowerMessage.includes('suggestion') ||
    lowerMessage.includes('trade idea') ||
    lowerMessage.includes('good setup') ||
    lowerMessage.includes('entry') ||
    lowerMessage.includes('pick') ||
    (lowerMessage.includes('long') && !lowerMessage.includes('how long'))
  ) {
    intent = 'scan_opportunities';
    params.direction = 'BUY';
  } else if (
    lowerMessage.includes('sell call') ||
    lowerMessage.includes('sell signal') ||
    lowerMessage.includes('bearish') ||
    lowerMessage.includes('short opportunities')
  ) {
    intent = 'scan_opportunities';
    params.direction = 'SELL';
  } else if (
    lowerMessage.includes('execute') ||
    lowerMessage.includes('place trade') ||
    lowerMessage.includes('place order') ||
    lowerMessage.includes('enter now') ||
    lowerMessage.includes('take the trade') ||
    lowerMessage.includes('take trade') ||
    lowerMessage.includes('take position') ||
    lowerMessage.includes('open position') ||
    lowerMessage.includes('do it') ||
    lowerMessage.includes('go ahead') ||
    lowerMessage.includes('confirm') ||
    lowerMessage.includes('yes buy') ||
    lowerMessage.includes('yes sell') ||
    lowerMessage.includes('paper trade') ||
    lowerMessage.includes('start trade') ||
    lowerMessage.includes('initiate') ||
    (lowerMessage.includes('buy') && (lowerMessage.includes('now') || lowerMessage.includes('it'))) ||
    (lowerMessage.includes('enter') && symbols.length > 0)
  ) {
    intent = 'execute_trade';
    // Determine direction from context
    if (lowerMessage.includes('sell') || lowerMessage.includes('short')) {
      params.direction = 'SELL';
    } else {
      params.direction = 'BUY';
    }
  }

  return { intent, symbols, params };
}

// Agent activity for broadcasting to frontend
interface AgentActivity {
  id: string;
  agentId: string;
  agentName: string;
  agentGreek: string;
  agentColor: string;
  type: 'info' | 'alert' | 'success' | 'warning';
  content: string;
  tags: string[];
  timestamp: number;
}

const AGENT_CONFIG: Record<string, { name: string; greek: string; color: string }> = {
  alpha: { name: 'Professor', greek: 'α', color: '#ff6b6b' },
  beta: { name: 'Techno-Kid', greek: 'β', color: '#4ecdc4' },
  gamma: { name: 'Risko', greek: 'γ', color: '#a855f7' },
  theta: { name: 'Macro', greek: 'θ', color: '#f97316' },
  delta: { name: 'Booky', greek: 'δ', color: '#3b82f6' },
};

/**
 * Handle user message and generate Prime's response
 */
export async function handleUserMessage(
  message: string,
  userId: string,
  context?: any
): Promise<{ message: string; intent: string; data?: any; agentActivities?: AgentActivity[] }> {
  const timestamp = Date.now();
  const messageId = crypto.randomUUID();

  // Track agent activities for broadcasting to frontend
  const agentActivities: AgentActivity[] = [];

  // Store user message
  await storeChatMessage({
    id: messageId,
    userId,
    role: 'user',
    content: message,
    timestamp,
  });

  // Parse intent
  const { intent, symbols, params } = parseIntent(message);

  // Get user preferences for personalized response
  const userPrefs = await getUserPreferences(userId);

  // Get recent chat for context
  const recentChat = await getChatHistory(userId, 5);
  const chatContext = recentChat.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');

  // Build response based on intent
  let responseData: any = null;
  let primeResponse = '';

  try {
    switch (intent) {
      case 'analyze_stock':
        if (symbols.length > 0) {
          const symbol = symbols[0];

          // Step 1: Fetch technical data FIRST (we need the real price for agents)
          let techBody: any = {};
          try {
            const techController = new AbortController();
            const techTimeout = setTimeout(() => techController.abort(), 8000);
            const techResponse = await lambdaClient.send(new InvokeCommand({
              FunctionName: 'zerodha-technical-indicators',
              Payload: Buffer.from(JSON.stringify({ symbol, days: 365 })),
            }), { abortSignal: techController.signal });
            clearTimeout(techTimeout);
            if (techResponse?.Payload) {
              const techData = JSON.parse(new TextDecoder().decode(techResponse.Payload));
              techBody = typeof techData.body === 'string' ? JSON.parse(techData.body) : techData;
            }
          } catch (err: any) {
            console.warn(`[Prime] Technical indicators failed for ${symbol}:`, err.message);
          }

          let realPrice = techBody.current_price || 0;

          // Fallback: Lambda failed to return price — try Yahoo Finance directly
          if (!realPrice) {
            try {
              const scan = await scanStockYahoo(symbol);
              if (scan?.price) realPrice = scan.price;
            } catch { /* ignore */ }
          }

          // Step 2: Consult agents in parallel WITH real price
          const [professorConsult, riskoConsult] = await Promise.all([
            consultProfessor(symbol, userId, realPrice, techBody),
            consultRiskoFrisco(symbol, 'BUY', realPrice, userId),
          ]);

          const techAvailable = !techBody.error && techBody.current_price !== undefined;
          responseData = { symbol, technical: techBody };

          // Add Techno-Kid activity
          const technoConfig = AGENT_CONFIG['beta'];
          agentActivities.push({
            id: `activity-beta-${Date.now()}`,
            agentId: 'beta',
            agentName: technoConfig.name,
            agentGreek: technoConfig.greek,
            agentColor: technoConfig.color,
            type: !techAvailable ? 'warning' : techBody.overall_signal?.includes('BUY') ? 'success' : techBody.overall_signal?.includes('SELL') ? 'warning' : 'info',
            content: techAvailable
              ? `${symbol} @ ₹${techBody.current_price} | RSI: ${techBody.rsi?.value} (${techBody.rsi?.signal}) | ${techBody.trend?.trend} | Signal: ${techBody.overall_signal}`
              : `${symbol}: Technical data temporarily unavailable`,
            tags: ['Technical', symbol],
            timestamp: Date.now(),
          });

          // Add Professor activity
          const professorConfig = AGENT_CONFIG['alpha'];
          agentActivities.push({
            id: `activity-alpha-${Date.now()}`,
            agentId: 'alpha',
            agentName: professorConfig.name,
            agentGreek: professorConfig.greek,
            agentColor: professorConfig.color,
            type: professorConsult.sentiment === 'negative' ? 'warning' : professorConsult.sentiment === 'positive' ? 'success' : 'info',
            content: `${symbol}: ${professorConsult.response.slice(0, 180)}...`,
            tags: ['Research', symbol, professorConsult.sentiment || 'neutral'],
            timestamp: Date.now() + 50,
          });

          // Add Risko activity
          const riskoConfig = AGENT_CONFIG['gamma'];
          agentActivities.push({
            id: `activity-gamma-${Date.now()}`,
            agentId: 'gamma',
            agentName: riskoConfig.name,
            agentGreek: riskoConfig.greek,
            agentColor: riskoConfig.color,
            type: riskoConsult.riskLevel === 'high' ? 'alert' : riskoConsult.riskLevel === 'low' ? 'success' : 'warning',
            content: `${symbol} Risk: ${riskoConsult.response.slice(0, 180)}...`,
            tags: ['Risk', symbol, riskoConsult.riskLevel || 'medium'],
            timestamp: Date.now() + 100,
          });

          // Determine overall verdict
          const bullishSignals = [
            techBody.overall_signal?.includes('BUY'),
            techBody.rsi?.signal === 'oversold',
            techBody.macd?.signal_interpretation?.includes('bullish'),
            techBody.trend?.trend === 'uptrend',
            professorConsult.sentiment === 'positive',
            riskoConsult.riskLevel === 'low',
          ].filter(Boolean).length;

          const bearishSignals = [
            techBody.overall_signal?.includes('SELL'),
            techBody.rsi?.signal === 'overbought',
            techBody.macd?.signal_interpretation?.includes('bearish'),
            techBody.trend?.trend === 'downtrend',
            professorConsult.sentiment === 'negative',
            riskoConsult.riskLevel === 'high',
          ].filter(Boolean).length;

          const verdict = bullishSignals >= 4 ? '✅ **BULLISH** - Good setup for entry' :
                         bearishSignals >= 4 ? '🔴 **BEARISH** - Avoid or consider shorting' :
                         bullishSignals > bearishSignals ? '🟡 **CAUTIOUSLY BULLISH** - Wait for confirmation' :
                         bearishSignals > bullishSignals ? '🟠 **CAUTIOUSLY BEARISH** - Don\'t chase' :
                         '⚪ **NEUTRAL** - No clear edge, wait for better setup';

          const techSection = techAvailable
            ? `📊 **Technical (Techno-Kid):**
RSI: ${techBody.rsi?.value} (${techBody.rsi?.signal}) | MACD: ${techBody.macd?.signal_interpretation} | Trend: ${techBody.trend?.trend} (${techBody.trend?.strength})
Support: ₹${techBody.support_resistance?.support?.toLocaleString()} | Resistance: ₹${techBody.support_resistance?.resistance?.toLocaleString()}`
            : `📊 **Technical (Techno-Kid):** Data temporarily unavailable`;

          const priceHeader = techAvailable
            ? `## ${symbol} Analysis @ ₹${techBody.current_price?.toLocaleString()}`
            : `## ${symbol} Analysis`;

          primeResponse = `${priceHeader}

**${verdict}**

${techSection}

📰 **News (Professor):** ${professorConsult.response}

⚖️ **Risk (Risko):** ${riskoConsult.response}

${techAvailable && bullishSignals >= 4 ? `
---
💡 **Ready to Trade:**
• Entry: ₹${techBody.current_price?.toLocaleString()}
• Stop Loss: ₹${(techBody.support_resistance?.support * 0.97)?.toLocaleString()}
• Target: ₹${techBody.support_resistance?.resistance?.toLocaleString()}

👉 **Say "Buy ${symbol}" or "Execute" to open a paper trade!**` :
techAvailable && bullishSignals >= 3 ? `
💡 **Suggested Entry:** ₹${techBody.support_resistance?.support?.toLocaleString()} with SL at ₹${(techBody.support_resistance?.support * 0.97)?.toLocaleString()}. Say "Buy ${symbol}" when ready.` : ''}`;
        } else {
          primeResponse = "Which stock should I analyze? Just name it - like RELIANCE, TCS, or HDFCBANK - and I'll get the squad's full assessment.";
        }
        break;

      case 'compare_stocks': {
        // Compare 2+ stocks side by side with real technical data
        const compareSymbols = symbols.slice(0, 3); // Max 3 for readability
        const compareResults = await Promise.all(
          compareSymbols.map(async (sym) => {
            try {
              const ctrl = new AbortController();
              const t = setTimeout(() => ctrl.abort(), 8000);
              const res = await lambdaClient.send(new InvokeCommand({
                FunctionName: 'zerodha-technical-indicators',
                Payload: Buffer.from(JSON.stringify({ symbol: sym, days: 365 })),
              }), { abortSignal: ctrl.signal }).finally(() => clearTimeout(t));
              const raw = JSON.parse(new TextDecoder().decode(res.Payload));
              const body = typeof raw.body === 'string' ? JSON.parse(raw.body) : raw;
              return { symbol: sym, data: body, ok: !body.error && body.current_price !== undefined };
            } catch {
              return { symbol: sym, data: {}, ok: false };
            }
          })
        );

        let comparisonTable = `## Stock Comparison\n\n| Metric | ${compareResults.map(r => `**${r.symbol}**`).join(' | ')} |\n|--------|${compareResults.map(() => '--------').join('|')}|\n`;

        const metrics = [
          { label: 'Price', fn: (d: any) => d.current_price ? `₹${d.current_price.toLocaleString()}` : 'N/A' },
          { label: 'RSI', fn: (d: any) => d.rsi ? `${d.rsi.value} (${d.rsi.signal})` : 'N/A' },
          { label: 'MACD', fn: (d: any) => d.macd?.signal_interpretation || 'N/A' },
          { label: 'Trend', fn: (d: any) => d.trend ? `${d.trend.trend} (${d.trend.strength})` : 'N/A' },
          { label: 'Signal', fn: (d: any) => d.overall_signal || 'N/A' },
          { label: 'Support', fn: (d: any) => d.support_resistance?.support ? `₹${d.support_resistance.support.toLocaleString()}` : 'N/A' },
          { label: 'Resistance', fn: (d: any) => d.support_resistance?.resistance ? `₹${d.support_resistance.resistance.toLocaleString()}` : 'N/A' },
          { label: '5D Change', fn: (d: any) => d.momentum?.five_day_change ? `${d.momentum.five_day_change > 0 ? '+' : ''}${d.momentum.five_day_change.toFixed(1)}%` : 'N/A' },
        ];

        for (const m of metrics) {
          comparisonTable += `| ${m.label} | ${compareResults.map(r => r.ok ? m.fn(r.data) : 'N/A').join(' | ')} |\n`;
        }

        // Add verdict
        const verdicts = compareResults.map(r => {
          if (!r.ok) return { sym: r.symbol, score: 0 };
          let score = 0;
          if (r.data.overall_signal?.includes('BUY')) score += 2;
          if (r.data.overall_signal?.includes('SELL')) score -= 2;
          if (r.data.rsi?.signal === 'oversold') score += 1;
          if (r.data.rsi?.signal === 'overbought') score -= 1;
          if (r.data.trend?.trend === 'uptrend') score += 1;
          if (r.data.trend?.trend === 'downtrend') score -= 1;
          return { sym: r.symbol, score };
        });

        const best = verdicts.reduce((a, b) => a.score >= b.score ? a : b);
        comparisonTable += `\n**Verdict:** ${best.score > 0 ? `**${best.sym}** looks stronger technically right now.` : best.score === 0 ? 'Both are in a neutral zone — no clear edge either way.' : `Both showing weakness — wait for a better setup.`}`;
        comparisonTable += `\n\nWant a deep-dive analysis on any of these? Just say "analyze ${best.sym}".`;

        primeResponse = comparisonTable;
        break;
      }

      case 'portfolio_status':
        const { getPortfolioState, getOpenTrades } = await import('./momentum-trader/paper-trading.js');
        const [portfolio, openTrades] = await Promise.all([
          getPortfolioState(userId),
          getOpenTrades(userId),
        ]);

        responseData = { portfolio, openTrades };

        if (openTrades.length === 0) {
          primeResponse = `Your portfolio is clear - no open positions. Capital: ₹${portfolio.capital.toLocaleString()}, Total P&L: ₹${portfolio.totalPnl.toLocaleString()}, Win Rate: ${portfolio.winRate}%. Ready to hunt for opportunities when you are!`;
        } else {
          const posLines = openTrades.map(t => {
            const pnl = t.netPnL || 0;
            const pnlStr = pnl >= 0 ? `+₹${pnl.toLocaleString()}` : `-₹${Math.abs(pnl).toLocaleString()}`;
            return `• **${t.symbol}** ${t.signal} @ ₹${t.entryPrice} → ${pnlStr}`;
          });
          const marginPct = portfolio.capital > 0 ? ((portfolio.marginUsed / portfolio.capital) * 100).toFixed(1) : '0';
          primeResponse = `## Portfolio Overview

**Capital:** ₹${portfolio.capital.toLocaleString()} | **Margin Used:** ₹${portfolio.marginUsed.toLocaleString()} (${marginPct}%)
**Unrealized P&L:** ₹${portfolio.unrealizedPnl.toLocaleString()} | **Win Rate:** ${portfolio.winRate}%

**${openTrades.length} Open Position(s):**
${posLines.join('\n')}`;
        }
        break;

      case 'daily_summary':
        const summary = await generateHumanSummary(userId);
        primeResponse = summary;
        break;

      case 'risk_assessment': {
        const { getPortfolioState: getPort, getOpenTrades: getTrades } = await import('./momentum-trader/paper-trading.js');
        const [port, rTrades] = await Promise.all([getPort(userId), getTrades(userId)]);

        const marginPctR = port.capital > 0 ? ((port.marginUsed / port.capital) * 100).toFixed(1) : '0';
        const dailyLossPct = port.dailyLossLimit > 0 ? ((port.dailyLossUsed / port.dailyLossLimit) * 100).toFixed(0) : '0';
        const riskCapitalPct = port.capital > 0 ? ((port.currentRisk / port.capital) * 100).toFixed(1) : '0';

        // Determine risk level
        const marginUsedPctNum = port.capital > 0 ? (port.marginUsed / port.capital) * 100 : 0;
        const dailyLossUsedPctNum = port.dailyLossLimit > 0 ? (port.dailyLossUsed / port.dailyLossLimit) * 100 : 0;
        const riskLevel = marginUsedPctNum > 80 || dailyLossUsedPctNum > 80 ? '🔴 HIGH'
          : marginUsedPctNum > 50 || dailyLossUsedPctNum > 50 ? '🟡 MODERATE' : '🟢 LOW';

        // Sector concentration
        const sectorCount: Record<string, number> = {};
        for (const t of rTrades) { sectorCount[t.symbol] = (sectorCount[t.symbol] || 0) + 1; }
        const concentration = rTrades.length > 0
          ? Object.entries(sectorCount).map(([s, c]) => `${s} (${c})`).join(', ')
          : 'None';

        primeResponse = `## Risk Assessment — ${riskLevel}

| Metric | Value | Limit |
|--------|-------|-------|
| Capital | ₹${port.capital.toLocaleString()} | — |
| Margin Used | ₹${port.marginUsed.toLocaleString()} (${marginPctR}%) | — |
| Capital at Risk | ₹${port.currentRisk.toLocaleString()} (${riskCapitalPct}%) | — |
| Daily Loss | ₹${port.dailyLossUsed.toLocaleString()} (${dailyLossPct}%) | ₹${port.dailyLossLimit.toLocaleString()} |
| Max Drawdown | ${port.maxDrawdown}% | — |
| Open Positions | ${rTrades.length} | — |

**Positions:** ${concentration}

${dailyLossUsedPctNum > 80 ? '⚠️ **Approaching daily loss limit — new trades may be blocked.**' :
  marginUsedPctNum > 70 ? '⚠️ **High margin utilization — consider reducing exposure.**' :
  rTrades.length === 0 ? '✅ No open risk. Portfolio is clear.' :
  '✅ Risk within acceptable limits.'}`;
        break;
      }

      case 'help':
        primeResponse = `I'm Prime, your trading intelligence assistant. Here's what I can help with:

• **Analyze stocks** - "Analyze RELIANCE" or "Tell me about Tata Motors"
• **Compare stocks** - "Compare INFY and TCS" or "RELIANCE vs HDFCBANK"
• **Scan opportunities** - "Scan for opportunities" or "What looks good?"
• **Portfolio status** - "Show my positions" or "How's my portfolio?"
• **Risk check** - "What's my risk exposure?" or "Portfolio risk?"
• **Daily summary** - "Give me today's summary"
• **Execute trades** - "Buy RELIANCE" or "Sell TCS"
• **Trading rules** - "Show my rules" or "Change entry rules"

Just ask naturally - I understand stock names, tickers, and context!`;
        break;

      case 'preferences':
        if (message.toLowerCase().includes('aggressive')) {
          await storeUserPreferences({ userId, tradingStyle: 'aggressive', lastUpdated: timestamp });
          primeResponse = "Got it! I've updated your style to aggressive. I'll focus on higher-conviction opportunities with wider stops and bigger targets. Let's hunt some momentum!";
        } else if (message.toLowerCase().includes('conservative')) {
          await storeUserPreferences({ userId, tradingStyle: 'conservative', lastUpdated: timestamp });
          primeResponse = "Understood. I've set your style to conservative. I'll prioritize capital preservation with tighter stops and more selective entries.";
        } else {
          primeResponse = `Your current trading style is ${userPrefs?.tradingStyle || 'moderate'}. You can tell me "I want to trade more aggressively" or "I prefer conservative trading" to adjust how I analyze opportunities for you.`;
        }
        break;

      case 'show_rules':
        // Display current trading rules
        const currentRules = await getTradingRules(userId);
        responseData = { rules: currentRules };

        primeResponse = `## 📋 Current Trading Rules

### 🟢 ENTRY Rules
${currentRules.entryRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

### 🔴 EXIT Rules
${currentRules.exitRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

### ⚖️ RISK Rules
${currentRules.riskRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---
*Last updated: ${new Date(currentRules.lastUpdated).toLocaleString()} by ${currentRules.updatedBy}*

💡 To modify rules, say things like:
- "Add entry rule: Only trade in first 2 hours"
- "Remove exit rule 3"
- "Update risk rule: Max 3% per trade"`;
        break;

      case 'edit_rules':
        // Let Prime intelligently edit rules based on user request
        const existingRules = await getTradingRules(userId);
        const ruleType = params.ruleType || 'entry';

        // Use Claude to understand and apply the rule change
        const editPrompt = `You are Prime (Σ), managing trading rules. The user wants to modify their trading rules.

Current ${ruleType.toUpperCase()} Rules:
${ruleType === 'entry' ? existingRules.entryRules.map((r, i) => `${i + 1}. ${r}`).join('\n') :
  ruleType === 'exit' ? existingRules.exitRules.map((r, i) => `${i + 1}. ${r}`).join('\n') :
  existingRules.riskRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

User's request: "${message}"

Analyze the request and respond in this EXACT JSON format:
{
  "action": "add" | "remove" | "update",
  "ruleIndex": <number if removing/updating, null if adding>,
  "newRule": "<the new or updated rule text, null if removing>",
  "explanation": "<brief explanation of what you're doing>"
}

Only respond with valid JSON, nothing else.`;

        const editResponse = await callClaude(editPrompt, 500);

        try {
          // Parse Claude's response
          const jsonMatch = editResponse.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON in response');

          const editAction = JSON.parse(jsonMatch[0]);
          let updatedRuleList: string[];

          if (ruleType === 'entry') {
            updatedRuleList = [...existingRules.entryRules];
          } else if (ruleType === 'exit') {
            updatedRuleList = [...existingRules.exitRules];
          } else {
            updatedRuleList = [...existingRules.riskRules];
          }

          // Apply the change
          if (editAction.action === 'add' && editAction.newRule) {
            updatedRuleList.push(editAction.newRule);
          } else if (editAction.action === 'remove' && editAction.ruleIndex !== null) {
            const idx = editAction.ruleIndex - 1; // Convert to 0-indexed
            if (idx >= 0 && idx < updatedRuleList.length) {
              updatedRuleList.splice(idx, 1);
            }
          } else if (editAction.action === 'update' && editAction.ruleIndex !== null && editAction.newRule) {
            const idx = editAction.ruleIndex - 1;
            if (idx >= 0 && idx < updatedRuleList.length) {
              updatedRuleList[idx] = editAction.newRule;
            }
          }

          // Save updated rules
          const updatePayload: Partial<Pick<TradingRules, 'entryRules' | 'exitRules' | 'riskRules'>> = {};
          if (ruleType === 'entry') updatePayload.entryRules = updatedRuleList;
          else if (ruleType === 'exit') updatePayload.exitRules = updatedRuleList;
          else updatePayload.riskRules = updatedRuleList;

          const newRules = await updateTradingRules(userId, updatePayload, 'prime');
          responseData = { rules: newRules, action: editAction };

          // Add activity
          const deltaConfig = AGENT_CONFIG['delta'];
          agentActivities.push({
            id: `activity-delta-${Date.now()}`,
            agentId: 'delta',
            agentName: deltaConfig.name,
            agentGreek: deltaConfig.greek,
            agentColor: deltaConfig.color,
            type: 'success',
            content: `📝 Trading rules updated: ${editAction.explanation}`,
            tags: ['Rules', ruleType, editAction.action],
            timestamp: Date.now(),
          });

          primeResponse = `## ✅ Rules Updated!

**Action:** ${editAction.action.toUpperCase()} ${ruleType} rule
**Change:** ${editAction.explanation}

### Updated ${ruleType.toUpperCase()} Rules:
${updatedRuleList.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---
Say "show rules" to see all your trading rules.`;

        } catch (parseErr) {
          console.error('Error parsing rule edit:', parseErr, editResponse);
          primeResponse = `I understood you want to modify ${ruleType} rules, but I need clearer instructions. Try:
- "Add entry rule: [your rule]"
- "Remove exit rule 2"
- "Update risk rule 1 to: [new rule text]"`;
        }
        break;

      case 'scan_opportunities': {
        // Techno-Kid scans ALL F&O stocks, then Prime consults squad on top picks
        const scanDirection = params.direction || 'BUY';

        // Phase 1: Techno-Kid scans all F&O stocks via Yahoo Finance
        const technoConfig = AGENT_CONFIG['beta'];
        agentActivities.push({
          id: `activity-beta-scan-${Date.now()}`,
          agentId: 'beta',
          agentName: technoConfig.name,
          agentGreek: technoConfig.greek,
          agentColor: technoConfig.color,
          type: 'info',
          content: `Scanning all ${fnoStocks.length} F&O stocks for ${scanDirection} signals...`,
          tags: ['Scan', 'F&O', scanDirection],
          timestamp: Date.now(),
        });

        const allResults = await batchScanStocks(fnoStocks, 25);
        const scannedCount = allResults.length;

        // Filter for direction-matched signals
        const directionResults = scanDirection === 'BUY'
          ? allResults.filter(r => r.overallSignal === 'BUY')
          : allResults.filter(r => r.overallSignal === 'SELL');

        // Top 5 picks by score
        const topOpportunities = directionResults.slice(0, 5);

        // Techno-Kid posts scan summary
        const scanSummary = `Scanned ${scannedCount}/${fnoStocks.length} F&O stocks. Found ${directionResults.length} ${scanDirection} signals. Top picks: ${topOpportunities.slice(0, 3).map(r => `${r.symbol} (score ${r.score})`).join(', ') || 'none'}`;
        agentActivities.push({
          id: `activity-beta-result-${Date.now()}`,
          agentId: 'beta',
          agentName: technoConfig.name,
          agentGreek: technoConfig.greek,
          agentColor: technoConfig.color,
          type: directionResults.length > 0 ? 'success' : 'info',
          content: scanSummary,
          tags: ['Scan', 'Results', scanDirection, `${directionResults.length} signals`],
          timestamp: Date.now() + 100,
        });

        responseData = { direction: scanDirection, scanned: scannedCount, totalSignals: directionResults.length, opportunities: topOpportunities };

        if (topOpportunities.length === 0) {
          primeResponse = `Techno-Kid scanned all ${scannedCount} F&O stocks but found no strong ${scanDirection} signals right now. The market might be consolidating. I'll keep monitoring and alert you when opportunities emerge. Want me to analyze a specific stock instead?`;
        } else {
          // Phase 2: Consult Professor and Risko on the top pick
          const topPick = topOpportunities[0];

          const [professorConsultation, riskoConsultation] = await Promise.all([
            consultProfessor(topPick.symbol, userId),
            consultRiskoFrisco(topPick.symbol, scanDirection, topPick.price, userId),
          ]);

          // Add Professor's activity
          const professorConfig = AGENT_CONFIG['alpha'];
          agentActivities.push({
            id: `activity-alpha-${Date.now()}`,
            agentId: 'alpha',
            agentName: professorConfig.name,
            agentGreek: professorConfig.greek,
            agentColor: professorConfig.color,
            type: professorConsultation.sentiment === 'negative' ? 'warning' : 'info',
            content: `${topPick.symbol}: ${professorConsultation.response.slice(0, 200)}${professorConsultation.response.length > 200 ? '...' : ''}`,
            tags: ['Research', topPick.symbol, professorConsultation.sentiment || 'neutral'],
            timestamp: Date.now() + 200,
          });

          // Add Risko's activity
          const riskoConfig = AGENT_CONFIG['gamma'];
          const riskType = riskoConsultation.riskLevel === 'high' ? 'alert' :
                          riskoConsultation.riskLevel === 'medium' ? 'warning' : 'success';
          agentActivities.push({
            id: `activity-gamma-${Date.now()}`,
            agentId: 'gamma',
            agentName: riskoConfig.name,
            agentGreek: riskoConfig.greek,
            agentColor: riskoConfig.color,
            type: riskType,
            content: `${topPick.symbol} Risk: ${riskoConsultation.response.slice(0, 200)}${riskoConsultation.response.length > 200 ? '...' : ''}`,
            tags: ['Risk', topPick.symbol, riskoConsultation.riskLevel || 'moderate'],
            timestamp: Date.now() + 300,
          });

          // Calculate conviction
          const techScore = topPick.score;
          const riskApproved = riskoConsultation.riskLevel !== 'high';
          const conviction = techScore >= 70 && riskApproved ? 'HIGH' :
                            techScore >= 50 && riskApproved ? 'MEDIUM' : 'LOW';
          const positionSize = conviction === 'HIGH' ? '2-3%' : conviction === 'MEDIUM' ? '1-2%' : '0.5-1%';

          // Determine which hedging strategy Prime would use
          const { selectHedgeStrategy } = await import('./momentum-trader/hedging.js');
          const suggestedStrategy = selectHedgeStrategy({
            signal: scanDirection as 'BUY' | 'SELL',
            conviction,
            volatility: Math.abs(topPick.momentum5d) > 3 ? 0.35 : 0.25,
            trendStrength: topPick.trend === 'bullish' || topPick.trend === 'bearish' ? 'moderate' : 'weak',
            rsi: topPick.rsi,
          });
          const strategyLabel = suggestedStrategy.replace(/_/g, ' ').toUpperCase();

          // Build other picks list
          const otherPicks = topOpportunities.slice(1).map(r =>
            `${r.symbol} ₹${r.price.toLocaleString()} (RSI ${r.rsi}, ${r.trend}, score ${r.score})`
          ).join('\n• ');

          primeResponse = `## Techno-Kid scanned ${scannedCount} F&O stocks — found ${directionResults.length} ${scanDirection} signals

### Top ${scanDirection} Pick: **${topPick.symbol}**

**Price:** ₹${topPick.price.toLocaleString()} | **Signal Strength:** ${techScore}/100 | **Conviction:** ${conviction}

**Technical Setup (Techno-Kid):**
• RSI: ${topPick.rsi} (${topPick.rsiSignal})
• Trend: ${topPick.trend} | 5d Momentum: ${topPick.momentum5d > 0 ? '+' : ''}${topPick.momentum5d}%
• Support: ₹${topPick.support.toLocaleString()} | Resistance: ₹${topPick.resistance.toLocaleString()}
• SMA20: ₹${topPick.sma20.toLocaleString()} | SMA50: ₹${topPick.sma50.toLocaleString()}
${topPick.volumeSurge ? '• Volume Surge detected!' : ''}

**News (Professor):** ${professorConsultation.sentiment?.toUpperCase() || 'NEUTRAL'}
${professorConsultation.response}

**Risk (Risko):** ${riskoConsultation.riskLevel?.toUpperCase() || 'MEDIUM'} RISK
${riskoConsultation.response}

---
**Recommendation:**
${conviction === 'HIGH' ? `ENTER NOW - Strong signals aligned!
• Entry: ₹${topPick.price.toLocaleString()}
• Stop Loss: ₹${(topPick.support * 0.97).toLocaleString()}
• Target: ₹${topPick.resistance.toLocaleString()}
• Position: ${positionSize} of capital
• Hedge: **${strategyLabel}** (auto-selected based on conviction + market conditions)

Say "Execute" or "Take the trade" to open a hedged paper position!` :
  conviction === 'MEDIUM' ? `WAIT for pullback to ₹${topPick.support.toLocaleString()} before entering. Position: ${positionSize} of capital.
• Suggested Hedge: **${strategyLabel}**

Say "Execute ${topPick.symbol}" if you want to enter now with hedging.` :
  `SKIP - Signals not convincing enough for entry.`}

${otherPicks ? `\n**Other ${scanDirection} candidates:**\n• ${otherPicks}` : ''}`;
        }
        break;
      }

      case 'execute_trade': {
        // Execute a hedged F&O paper trade
        const tradeDirection = params.direction || 'BUY';
        let tradeSymbol = symbols.length > 0 ? symbols[0] : null;

        // If no symbol specified, check recent chat for context
        if (!tradeSymbol) {
          const recentMessages = await getChatHistory(userId, 5);
          for (const msg of recentMessages.reverse()) {
            const fnoPattern = new RegExp(`\\b(${fnoStocks.join('|')})\\b`, 'i');
            const symbolMatch = msg.content.match(fnoPattern);
            if (symbolMatch) {
              tradeSymbol = symbolMatch[1].toUpperCase();
              break;
            }
          }
        }

        if (!tradeSymbol) {
          primeResponse = "Which stock should I trade? Tell me the symbol - like 'Execute trade on RELIANCE' or 'Buy TCS now'.";
          break;
        }

        try {
          // First try Zerodha tech indicators, fall back to Yahoo Finance scan
          let entryPrice = 0;
          let rsi = 50;
          let rsiSignal = 'neutral';
          let trend = 'neutral';
          let trendStrength = 'moderate';
          let momentum5d = 0;
          let support = 0;
          let resistance = 0;
          let volumeSurge = false;
          let score = 70;

          try {
            const techRes = await lambdaClient.send(new InvokeCommand({
              FunctionName: 'zerodha-technical-indicators',
              Payload: Buffer.from(JSON.stringify({ symbol: tradeSymbol, days: 365 })),
            }));
            const techData = JSON.parse(new TextDecoder().decode(techRes.Payload));
            const td = typeof techData.body === 'string' ? JSON.parse(techData.body) : techData;

            if (td.current_price) {
              entryPrice = td.current_price;
              rsi = td.rsi?.value || 50;
              rsiSignal = td.rsi?.signal || 'neutral';
              trend = td.trend?.trend || 'neutral';
              trendStrength = td.adx?.trend_strength || 'moderate';
              support = td.support_resistance?.support || entryPrice * 0.97;
              resistance = td.support_resistance?.resistance || entryPrice * 1.05;
              volumeSurge = td.volume?.surge || false;
              score = td.overall_score || 70;
              momentum5d = td.momentum?.momentum_5d || 0;
            }
          } catch {
            console.log(`Zerodha unavailable for ${tradeSymbol}, trying Yahoo scan`);
          }

          // Fallback: use Yahoo Finance scan
          if (!entryPrice) {
            const { scanStockYahoo } = await import('./agents/shared.js');
            const scanResult = await scanStockYahoo(tradeSymbol);
            if (scanResult) {
              entryPrice = scanResult.price;
              rsi = scanResult.rsi;
              rsiSignal = scanResult.rsiSignal;
              trend = scanResult.trend;
              trendStrength = scanResult.trend === 'bullish' || scanResult.trend === 'bearish' ? 'moderate' : 'weak';
              momentum5d = scanResult.momentum5d;
              support = scanResult.support;
              resistance = scanResult.resistance;
              volumeSurge = scanResult.volumeSurge;
              score = scanResult.score;
            }
          }

          if (!entryPrice) {
            primeResponse = `Unable to get market data for ${tradeSymbol}. The symbol may be invalid or markets are closed.`;
            break;
          }

          // Determine conviction based on score
          const conviction: 'HIGH' | 'MEDIUM' | 'LOW' = score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW';

          // Import and execute hedged paper trade
          const { enterTradeFromScan } = await import('./momentum-trader/paper-trading.js');

          const tradeResult = await enterTradeFromScan({
            symbol: tradeSymbol,
            signal: tradeDirection as 'BUY' | 'SELL',
            entryPrice,
            rsi,
            rsiSignal,
            trend,
            trendStrength,
            momentum5d,
            support,
            resistance,
            volumeSurge,
            score,
            conviction,
            triggerSource: 'prime_chat',
            rationale: `Prime decision via chat. RSI: ${rsi.toFixed(0)}, Trend: ${trend}, Score: ${score}/100, Conviction: ${conviction}`,
            userId,
            segment: ((params as any).segment as 'FUTURES' | 'CASH') || 'FUTURES',
            stopLoss: (params as any).stopLoss,
          });

          if (!tradeResult.success) {
            primeResponse = `Trade rejected: ${tradeResult.error}`;
            break;
          }

          const trade = tradeResult.trade!;
          const strategy = tradeResult.strategy!;

          // Add activity for the trade
          const riskoConfig = AGENT_CONFIG['gamma'];
          agentActivities.push({
            id: `activity-gamma-${Date.now()}`,
            agentId: 'gamma',
            agentName: riskoConfig.name,
            agentGreek: riskoConfig.greek,
            agentColor: riskoConfig.color,
            type: 'success',
            content: `Paper trade: ${tradeDirection} ${tradeSymbol} (${strategy.strategy.replace(/_/g, ' ')}) @ ₹${entryPrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            tags: ['Trade', tradeSymbol, strategy.strategy, 'Hedged'],
            timestamp: Date.now(),
          });

          responseData = { trade, strategy, symbol: tradeSymbol };

          const stopLoss = tradeDirection === 'BUY'
            ? Math.round(support * 0.99 * 100) / 100
            : Math.round(resistance * 1.01 * 100) / 100;
          const target = tradeDirection === 'BUY'
            ? Math.round(resistance * 100) / 100
            : Math.round(support * 100) / 100;

          primeResponse = `## Hedged Paper Trade Executed

**${tradeDirection} ${tradeSymbol}** @ ₹${entryPrice.toLocaleString('en-IN')}

**Hedging Strategy: ${strategy.strategy.replace(/_/g, ' ').toUpperCase()}**
${strategy.description}

**Position Details:**
• Lots: ${trade.futuresLots} x ${trade.lotSize} = ${trade.futuresLots * trade.lotSize} shares
• Margin: ₹${trade.marginUsed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
• Hedge Cost: ₹${trade.hedgeCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
• Max Loss: ₹${trade.maxLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
${strategy.maxProfit === Infinity ? '• Max Profit: Unlimited' : `• Max Profit: ₹${strategy.maxProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}

**Exit Levels:**
• Target: ₹${target.toLocaleString('en-IN')} (${((Math.abs(target - entryPrice) / entryPrice) * 100).toFixed(1)}%)
• Stop Loss: ₹${stopLoss.toLocaleString('en-IN')} (${((Math.abs(entryPrice - stopLoss) / entryPrice) * 100).toFixed(1)}%)
• Break-even: ₹${strategy.breakeven.map(b => b.toFixed(0)).join(' / ')}

**Technicals:** RSI ${rsi.toFixed(0)} | Trend: ${trend} | Score: ${score}/100 | Conviction: ${conviction}

Position is live. Auto-exit on: target hit, stop loss, momentum exhaustion, reversal, or 24hr expiry.`;

        } catch (err: any) {
          console.error('Error executing paper trade:', err);
          primeResponse = `Failed to execute trade: ${err.message || 'Unknown error'}. Please try again.`;
        }
        break;
      }

      default:
        // Smart default handler - actually help the user
        // First, check if this seems like a trading-related question that needs data
        const lowerMsg = message.toLowerCase();
        const needsMarketContext = lowerMsg.includes('market') || lowerMsg.includes('today') ||
          lowerMsg.includes('nifty') || lowerMsg.includes('sensex') || lowerMsg.includes('trend');
        // If any stock symbol was extracted from the message, redirect to analyze
        if (symbols.length > 0) {
            const sym = symbols[0];
            // Redirect to analysis
            try {
              const techRes = await lambdaClient.send(new InvokeCommand({
                FunctionName: 'zerodha-technical-indicators',
                Payload: Buffer.from(JSON.stringify({ symbol: sym, days: 365 })),
              }));
              const techData = JSON.parse(new TextDecoder().decode(techRes.Payload));
              const td = typeof techData.body === 'string' ? JSON.parse(techData.body) : techData;

              if (td.current_price) {
                // Add Techno-Kid activity
                const technoConfig = AGENT_CONFIG['beta'];
                agentActivities.push({
                  id: `activity-beta-${Date.now()}`,
                  agentId: 'beta',
                  agentName: technoConfig.name,
                  agentGreek: technoConfig.greek,
                  agentColor: technoConfig.color,
                  type: 'info',
                  content: `${sym} @ ₹${td.current_price} | RSI: ${td.rsi?.value || 'N/A'} (${td.rsi?.signal || '-'}) | Trend: ${td.trend?.trend || 'N/A'}`,
                  tags: ['Technical', sym],
                  timestamp: Date.now(),
                });

                const quickAnalysis = `**${sym}** @ ₹${td.current_price?.toLocaleString()}

📊 **Technical Snapshot:**
• RSI: ${td.rsi?.value || 'N/A'} (${td.rsi?.signal || 'neutral'})
• MACD: ${td.macd?.signal_interpretation || 'N/A'}
• Trend: ${td.trend?.trend || 'N/A'} (${td.trend?.strength || 'N/A'})
• Signal: **${td.overall_signal || 'HOLD'}**

${td.overall_signal?.includes('BUY') ? '✅ Looking bullish.' : td.overall_signal?.includes('SELL') ? '⚠️ Bearish signals present.' : '📊 Consolidating - wait for clearer direction.'}

Want a full squad analysis with news and risk assessment?`;
                primeResponse = quickAnalysis;
                break;
              }
            } catch (e) {
              // Fall through to general response
            }
        }

        // Get portfolio context for smarter responses
        let portfolioContext = '';
        try {
          const { getPortfolioState, getOpenTrades } = await import('./momentum-trader/paper-trading.js');
          const [port, trades] = await Promise.all([getPortfolioState(userId), getOpenTrades(userId)]);
          portfolioContext = `
Portfolio Status:
- Capital: ₹${port.capital.toLocaleString()}
- Open Positions: ${trades.length}
- Today's P&L: ₹${port.dayPnl?.toLocaleString() || '0'}
- Win Rate: ${port.winRate}%
${trades.length > 0 ? `- Positions: ${trades.map(t => `${t.symbol} ${t.signal}`).join(', ')}` : ''}`;
        } catch (e) {
          // Ignore portfolio errors
        }

        // If asking about Nifty/market levels, fetch real NIFTY data
        let niftyContext = '';
        if (needsMarketContext) {
          try {
            const nCtrl = new AbortController();
            const nT = setTimeout(() => nCtrl.abort(), 6000);
            const nRes = await lambdaClient.send(new InvokeCommand({
              FunctionName: 'zerodha-technical-indicators',
              Payload: Buffer.from(JSON.stringify({ symbol: 'NIFTY 50', days: 365 })),
            }), { abortSignal: nCtrl.signal }).finally(() => clearTimeout(nT));
            const nRaw = JSON.parse(new TextDecoder().decode(nRes.Payload));
            const nBody = typeof nRaw.body === 'string' ? JSON.parse(nRaw.body) : nRaw;
            if (nBody.current_price) {
              niftyContext = `
NIFTY 50 Live Data (use ONLY these numbers, do NOT make up levels):
- Current: ${nBody.current_price}
- RSI: ${nBody.rsi?.value} (${nBody.rsi?.signal})
- Trend: ${nBody.trend?.trend} (${nBody.trend?.strength})
- MACD: ${nBody.macd?.signal_interpretation}
- Support: ${nBody.support_resistance?.support}
- Resistance: ${nBody.support_resistance?.resistance}
- Signal: ${nBody.overall_signal}`;
            }
          } catch {
            niftyContext = '\nNote: NIFTY live data unavailable right now. Tell the user you cannot fetch live levels at the moment instead of making up numbers.';
          }
        }

        // Intelligent general response
        const smartPrompt = `You are Prime (Σ), the lead AI trading intelligence for an Indian F&O trading squad. You coordinate:
- Techno-Kid (β): Technical analysis expert - RSI, MACD, trends, patterns
- Professor (α): News & fundamentals researcher
- Risko-Frisco (γ): Risk manager - position sizing, hedging, stop losses

You are confident, direct, and data-driven. You give actionable advice, not vague suggestions.

${portfolioContext}
${niftyContext}

Recent conversation:
${chatContext}

User's trading style: ${userPrefs?.tradingStyle || 'moderate'}
User message: "${message}"

Instructions:
1. Be helpful and intelligent - give real value in your response
2. If they're asking about market conditions, trading strategy, or seeking advice - HELP THEM
3. If they mention a specific stock or company name, analyze it directly with whatever you know — do NOT redirect them to scan for opportunities
4. Only suggest "scan for opportunities" if the user is explicitly looking for new trade ideas without mentioning any specific stock
5. Be concise but insightful (2-4 sentences)
6. Sound like a smart trading desk colleague, not a customer service bot
7. CRITICAL: NEVER fabricate or hallucinate market data, prices, support/resistance levels, or Nifty values. Only use numbers from the data provided above. If no data is provided, say "Let me fetch that for you — try asking 'analyze NIFTY' for live levels."

Respond as Prime:`;

        primeResponse = await callClaude(smartPrompt);
    }
  } catch (err) {
    console.error('Error handling user message:', err);
    primeResponse = "I encountered an issue processing that. Could you try rephrasing? I'm here to help with stock analysis, portfolio updates, and trading insights.";
  }

  // Store Prime's response
  const responseId = crypto.randomUUID();
  await storeChatMessage({
    id: responseId,
    userId,
    role: 'prime',
    content: primeResponse,
    timestamp: Date.now(),
    context: { intent, symbols },
  });

  return {
    message: primeResponse,
    intent,
    data: responseData,
    agentActivities: agentActivities.length > 0 ? agentActivities : undefined,
  };
}
