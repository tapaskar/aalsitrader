/**
 * Shared Agent Utilities
 * Extracted from simulator.ts for use by individual agent Lambda handlers.
 */

import { PutCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TableNames, WebSocketEndpoint } from '../utils/db.js';
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

export const apiGateway = new ApiGatewayManagementApiClient({
  endpoint: WebSocketEndpoint,
});
export const lambdaClient = new LambdaClient({ region: AWS_REGION });
export const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });
export const bedrockAgentClient = new BedrockAgentRuntimeClient({ region: AWS_REGION });

/**
 * Bedrock Agent IDs/Aliases — populated via Lambda env vars after `terraform apply`.
 * When not set, callAgent() falls back to direct callClaude().
 */
export const BEDROCK_AGENTS = {
  alpha: { agentId: process.env.BEDROCK_AGENT_ALPHA_ID, aliasId: process.env.BEDROCK_AGENT_ALPHA_ALIAS_ID },
  beta:  { agentId: process.env.BEDROCK_AGENT_BETA_ID,  aliasId: process.env.BEDROCK_AGENT_BETA_ALIAS_ID  },
  gamma: { agentId: process.env.BEDROCK_AGENT_GAMMA_ID, aliasId: process.env.BEDROCK_AGENT_GAMMA_ALIAS_ID },
  theta: { agentId: process.env.BEDROCK_AGENT_THETA_ID, aliasId: process.env.BEDROCK_AGENT_THETA_ALIAS_ID },
  delta: { agentId: process.env.BEDROCK_AGENT_DELTA_ID, aliasId: process.env.BEDROCK_AGENT_DELTA_ALIAS_ID },
  sigma: { agentId: process.env.BEDROCK_AGENT_SIGMA_ID, aliasId: process.env.BEDROCK_AGENT_SIGMA_ALIAS_ID },
} as const;

/**
 * Invoke a Bedrock Agent and return the full text response.
 * Streams completion events and concatenates chunk bytes into a string.
 */
export async function invokeBedrockAgent(
  agentId: string,
  agentAliasId: string,
  sessionId: string,
  inputText: string,
): Promise<string> {
  const response = await bedrockAgentClient.send(
    new InvokeAgentCommand({
      agentId,
      agentAliasId,
      // Session IDs: alphanumeric + hyphens only, max 100 chars
      sessionId: sessionId.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 100),
      inputText,
    }),
  );

  let fullText = '';
  if (response.completion) {
    for await (const event of response.completion) {
      if (event.chunk?.bytes) {
        fullText += new TextDecoder().decode(event.chunk.bytes);
      }
    }
  }
  return fullText;
}

/**
 * Call a named Bedrock Agent with automatic fallback to direct callClaude().
 * - agentKey: agent identifier ('alpha' | 'beta' | 'gamma' | 'theta' | 'delta' | 'sigma')
 * - sessionId: unique session identifier (execution ID works well)
 * - userMessage: data context sent as the user turn (persona lives in agent instructions)
 * - fallbackPrompt: full prompt including persona used if Bedrock Agent env vars are unset
 */
export async function callAgent(
  agentKey: keyof typeof BEDROCK_AGENTS,
  sessionId: string,
  userMessage: string,
  fallbackPrompt: string,
): Promise<string> {
  const cfg = BEDROCK_AGENTS[agentKey];
  if (cfg.agentId && cfg.aliasId) {
    try {
      const result = await invokeBedrockAgent(cfg.agentId, cfg.aliasId, sessionId, userMessage);
      if (result.trim()) return result;
    } catch (err: any) {
      console.warn(`[Bedrock Agent ${agentKey}] failed, falling back to callClaude:`, err.message);
    }
  }
  return callClaude(fallbackPrompt);
}

// Agent definitions
export const agents = [
  {
    id: 'alpha',
    name: 'Professor',
    greek: 'α',
    role: 'Research Agent',
    color: '#ff6b6b',
  },
  {
    id: 'beta',
    name: 'Techno-Kid',
    greek: 'β',
    role: 'Technical Analyst',
    color: '#4ecdc4',
  },
  {
    id: 'gamma',
    name: 'Risko-Frisco',
    greek: 'γ',
    role: 'Risk Manager',
    color: '#a855f7',
  },
  {
    id: 'sigma',
    name: 'Prime',
    greek: 'Σ',
    role: 'Trade Hunter / Orchestrator',
    color: '#10b981',
  },
  {
    id: 'theta',
    name: 'Macro',
    greek: 'θ',
    role: 'Macro Watcher',
    color: '#f97316',
  },
  {
    id: 'delta',
    name: 'Booky',
    greek: 'δ',
    role: 'Trade Journal',
    color: '#3b82f6',
  },
];

export type AgentDef = (typeof agents)[0];

// Full NSE F&O stock list (~185 stocks)
export const fnoStocks = [
  // Nifty 50 heavyweights
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
  'BHARTIARTL', 'KOTAKBANK', 'LT', 'AXISBANK', 'BAJFINANCE', 'ASIANPAINT', 'MARUTI',
  'TITAN', 'SUNPHARMA', 'TMCV', 'HCLTECH', 'WIPRO', 'ULTRACEMCO', 'NESTLEIND',
  'BAJAJ-AUTO', 'TATASTEEL', 'NTPC', 'POWERGRID', 'ONGC', 'JSWSTEEL', 'M&M', 'ADANIENT',
  'ADANIPORTS', 'TECHM', 'INDUSINDBK', 'HINDALCO', 'DRREDDY', 'CIPLA', 'DIVISLAB',
  'BRITANNIA', 'APOLLOHOSP', 'EICHERMOT', 'HEROMOTOCO', 'COALINDIA', 'BPCL', 'GRASIM',
  'SBILIFE', 'TATACONSUM', 'BAJAJFINSV', 'HDFCLIFE', 'UPL', 'LTIM',
  // Nifty Next 50 & large-mid
  'HAL', 'BDL', 'BANKBARODA', 'PNB', 'CANBK', 'IDFCFIRSTB', 'FEDERALBNK', 'BANDHANBNK',
  'AUBANK', 'MANAPPURAM', 'MUTHOOTFIN', 'CHOLAFIN', 'BAJAJHLDNG', 'SBICARD', 'PEL',
  'RECLTD', 'PFC', 'IRCTC', 'IRFC', 'INDIANB', 'IOC', 'GAIL', 'PETRONET', 'IGL',
  'MGL', 'HINDPETRO', 'NMDC', 'VEDL', 'NATIONALUM', 'SAIL', 'JINDALSTEL',
  'TATAPOWER', 'NHPC', 'SJVN', 'TORNTPOWER', 'ADANIGREEN', 'ADANIPOWER', 'TATACOMM',
  'IDEA', 'INDUSTOWER', 'ZOMATO', 'NYKAA', 'PAYTM', 'POLICYBZR', 'DELHIVERY',
  // IT & Tech
  'MPHASIS', 'COFORGE', 'PERSISTENT', 'LTTS', 'LALPATHLAB', 'TATAELXSI',
  // Pharma & Healthcare
  'BIOCON', 'LUPIN', 'AUROPHARMA', 'TORNTPHARM', 'ALKEM', 'IPCALAB', 'ABBOTINDIA',
  'LAURUSLABS', 'GRANULES', 'NATCOPHARMA', 'GLENMARK', 'METROPOLIS',
  // Auto & Auto Ancillary
  'ASHOKLEY', 'TVSMOTOR', 'MRF', 'BALKRISIND', 'MOTHERSON', 'EXIDEIND', 'AMARAJABAT',
  'BHEL', 'BOSCHLTD', 'ESCORTS',
  // FMCG & Consumer
  'DABUR', 'MARICO', 'GODREJCP', 'COLPAL', 'TRENT', 'PAGEIND', 'VOLTAS', 'HAVELLS',
  'CROMPTON', 'WHIRLPOOL', 'PIDILITIND', 'BERGEPAINT', 'JUBLFOOD', 'MCDOWELL-N',
  // Cement & Construction
  'SHREECEM', 'AMBUJACEM', 'ACC', 'RAMCOCEM', 'DALBHARAT',
  // Infra & Capital Goods
  'ABB', 'SIEMENS', 'CUMMINSIND', 'CONCOR', 'IRCON', 'RVNL',
  // Chemicals
  'PIIND', 'ATUL', 'DEEPAKNTR', 'NAVINFLUOR', 'SRF', 'AARTIIND', 'CLEAN',
  // Financial Services
  'LICHSGFIN', 'CANFINHOME', 'ICICIGI', 'ICICIPRULI', 'MFSL', 'MCX',
  'CDSLTD', 'BSE', 'ANGELONE', 'JIOFIN',
  // Metals & Mining
  'APLAPOLLO', 'RATNAMANI', 'ASTRAL',
  // Media & Entertainment
  'PVRINOX', 'ZEEL',
  // Miscellaneous
  'OFSS', 'OBEROIRLTY', 'DLF', 'GODREJPROP', 'PRESTIGE', 'LODHA', 'PHOENIXLTD',
  'Dixon', 'KAYNES', 'POLYCAB', 'KEI', 'CAMS', 'CDSL',
  'INDHOTEL', 'LICI', 'MAXHEALTH', 'STARHEALTH',
  'NAUKRI', 'DMART',
];

// Watchlist - smaller subset for Sigma's automated per-cycle scanning
export const watchlist = fnoStocks.slice(0, 30);

// Agent event interface for Lambda handlers
export interface AgentEvent {
  executionId: string;
  timestamp: number;
  scheduledAgents?: string[];
  sharedContext?: {
    latestOutputs: Record<string, any>;
  };
  agentResults?: any[];
  aggregated?: any;
}

/**
 * Check if this agent is scheduled to run.
 * Returns true if scheduledAgents is not set (run all) or includes the agentId.
 */
export function isScheduled(event: AgentEvent, agentId: string): boolean {
  if (!event.scheduledAgents || event.scheduledAgents.length === 0) return true;
  return event.scheduledAgents.includes(agentId);
}

/**
 * Call Bedrock LLM (Nova Lite → Claude Haiku fallback)
 */
export async function callClaude(prompt: string): Promise<string> {
  const models = [
    { id: 'apac.amazon.nova-lite-v1:0', format: 'nova' as const },
    {
      id: 'apac.anthropic.claude-3-haiku-20240307-v1:0',
      format: 'claude' as const,
    },
  ];

  for (const model of models) {
    try {
      let requestBody: string;
      if (model.format === 'nova') {
        requestBody = JSON.stringify({
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 200, temperature: 0.3 },
        });
      } else {
        requestBody = JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        });
      }

      const response = await bedrockClient.send(
        new InvokeModelCommand({
          modelId: model.id,
          contentType: 'application/json',
          accept: 'application/json',
          body: requestBody,
        })
      );

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

/**
 * Post activity to DynamoDB + broadcast via WebSocket
 */
export async function postActivity(
  agent: AgentDef,
  type: string,
  content: string,
  tags: string[],
  timestamp: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const activity = {
    id: crypto.randomUUID(),
    agentId: agent.id,
    agentName: agent.name,
    agentGreek: agent.greek,
    agentColor: agent.color,
    type,
    content,
    tags,
    timestamp,
    ...(metadata && { metadata }),
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.activities,
      Item: { ...activity, ttl: Math.floor(timestamp / 1000) + 604800 },
    })
  );

  await updateAgentState(
    agent.id,
    'active',
    content.slice(0, 60) + '...',
    timestamp
  );

  await broadcastToAll({ type: 'agentActivity', activity, timestamp });
}

/**
 * Post inter-agent communication
 */
export async function postComm(
  from: AgentDef,
  to: AgentDef,
  content: string,
  timestamp: number
): Promise<void> {
  const comm = {
    id: crypto.randomUUID(),
    from: from.name,
    fromGreek: from.greek,
    fromColor: from.color,
    to: to.name,
    toGreek: to.greek,
    toColor: to.color,
    content,
    timestamp,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableNames.communications,
      Item: { ...comm, ttl: Math.floor(timestamp / 1000) + 86400 },
    })
  );

  await broadcastToAll({ type: 'commMessage', comm, timestamp });
}

/**
 * Update agent state in DynamoDB + broadcast
 */
export async function updateAgentState(
  agentId: string,
  status: string,
  currentTask: string,
  timestamp: number
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TableNames.agentState,
      Item: { agentId, status, currentTask, lastActivity: timestamp },
    })
  );

  await broadcastToAll({
    type: 'agentStatusChange',
    agentId,
    status,
    currentTask,
    timestamp,
  });
}

/**
 * Wake an agent (set status to active)
 */
export async function wakeAgent(
  agent: AgentDef,
  timestamp: number
): Promise<void> {
  await updateAgentState(agent.id, 'active', 'Initializing...', timestamp);
}

/**
 * Sleep an agent (set status to sleeping)
 */
export async function sleepAgent(
  agent: AgentDef,
  timestamp: number
): Promise<void> {
  const nextWake = new Date(timestamp + 15 * 60 * 1000).toLocaleTimeString(
    'en-US',
    { hour: 'numeric', minute: '2-digit', hour12: true }
  );

  await docClient.send(
    new PutCommand({
      TableName: TableNames.agentState,
      Item: {
        agentId: agent.id,
        status: 'sleeping',
        nextWake,
        lastActivity: timestamp,
      },
    })
  );

  await broadcastToAll({
    type: 'agentStatusChange',
    agentId: agent.id,
    status: 'sleeping',
    nextWake,
    timestamp,
  });
}

/**
 * Broadcast data to all connected WebSocket clients
 */
export async function broadcastToAll(data: unknown): Promise<void> {
  const result = await docClient.send(
    new ScanCommand({ TableName: TableNames.connections })
  );
  const connections = result.Items || [];

  await Promise.all(
    connections.map(async (conn) => {
      try {
        await apiGateway.send(
          new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: Buffer.from(JSON.stringify(data)),
          })
        );
      } catch {
        // Remove stale connection from DynamoDB
        try {
          await docClient.send(new DeleteCommand({
            TableName: TableNames.connections,
            Key: { connectionId: conn.connectionId },
          }));
        } catch { /* ignore cleanup errors */ }
      }
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Yahoo Finance Scanner — used by Techno-Kid to scan F&O stocks
// ─────────────────────────────────────────────────────────────────────────────

export interface StockScanResult {
  symbol: string;
  price: number;
  rsi: number;
  rsiSignal: string;
  trend: string;
  sma20: number;
  sma50: number;
  momentum5d: number;
  support: number;
  resistance: number;
  volumeSurge: boolean;
  superTrend: number;        // SuperTrend(10,3) indicator value
  superTrendSignal: string;  // 'BUY' or 'SELL'
  overallSignal: string;
  score: number; // 0-100 signal strength
}

/**
 * Calculate SuperTrend indicator (period=10, multiplier=3 by default).
 * Returns the current SuperTrend value and signal (BUY when price > ST, SELL when price < ST).
 */
function calculateSuperTrend(
  highs: number[], lows: number[], closes: number[],
  period: number = 10, multiplier: number = 3,
): { value: number; signal: 'BUY' | 'SELL' } | null {
  const len = closes.length;
  if (len < period + 1) return null;

  // True Range
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < len; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    ));
  }

  // ATR using Wilder's smoothing (RMA) — seed with SMA
  const atr: number[] = new Array(len).fill(0);
  let atrSum = 0;
  for (let i = 0; i < period; i++) atrSum += tr[i];
  atr[period - 1] = atrSum / period;
  for (let i = period; i < len; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }

  // SuperTrend calculation
  let finalUpperBand = 0;
  let finalLowerBand = 0;
  let superTrendVal = 0;
  let prevFinalUpper = 0;
  let prevFinalLower = 0;
  let prevST = 0;

  for (let i = period - 1; i < len; i++) {
    const hl2 = (highs[i] + lows[i]) / 2;
    const basicUpper = hl2 + multiplier * atr[i];
    const basicLower = hl2 - multiplier * atr[i];

    if (i === period - 1) {
      finalUpperBand = basicUpper;
      finalLowerBand = basicLower;
      superTrendVal = closes[i] > basicUpper ? basicLower : basicUpper;
      prevFinalUpper = finalUpperBand;
      prevFinalLower = finalLowerBand;
      prevST = superTrendVal;
      continue;
    }

    // Final upper band: tighten if possible
    finalUpperBand = (basicUpper < prevFinalUpper || closes[i - 1] > prevFinalUpper)
      ? basicUpper : prevFinalUpper;
    // Final lower band: raise if possible
    finalLowerBand = (basicLower > prevFinalLower || closes[i - 1] < prevFinalLower)
      ? basicLower : prevFinalLower;

    // Flip logic
    if (prevST === prevFinalUpper) {
      superTrendVal = closes[i] <= finalUpperBand ? finalUpperBand : finalLowerBand;
    } else {
      superTrendVal = closes[i] >= finalLowerBand ? finalLowerBand : finalUpperBand;
    }

    prevFinalUpper = finalUpperBand;
    prevFinalLower = finalLowerBand;
    prevST = superTrendVal;
  }

  return {
    value: Math.round(superTrendVal * 100) / 100,
    signal: closes[len - 1] > superTrendVal ? 'BUY' : 'SELL',
  };
}

/**
 * Scan a single stock via Yahoo Finance. Returns null if data unavailable.
 */
export async function scanStockYahoo(symbol: string): Promise<StockScanResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?interval=1d&range=3mo`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const chartResult = data?.chart?.result?.[0];
    const meta = chartResult?.meta;
    const quotes = chartResult?.indicators?.quote?.[0];
    const rawCloses = quotes?.close || [];
    const rawHighs = quotes?.high || [];
    const rawLows = quotes?.low || [];
    const rawVolumes = quotes?.volume || [];

    // Filter to only complete bars (all HLC present)
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];
    for (let i = 0; i < rawCloses.length; i++) {
      if (rawCloses[i] != null && rawHighs[i] != null && rawLows[i] != null) {
        closes.push(rawCloses[i]);
        highs.push(rawHighs[i]);
        lows.push(rawLows[i]);
        volumes.push(rawVolumes[i] || 0);
      }
    }

    if (!meta?.regularMarketPrice || closes.length < 20) return null;

    const price = meta.regularMarketPrice;

    // RSI(14)
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = closes.length - 14; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains.push(change);
      else losses.push(Math.abs(change));
    }
    const avgGain = gains.reduce((s, g) => s + g, 0) / 14;
    const avgLoss = losses.reduce((s, l) => s + l, 0) / 14 || 0.001;
    const rsi = Math.round((100 - (100 / (1 + avgGain / avgLoss))) * 10) / 10;

    // SMA(20) and SMA(50)
    const sma20 = closes.slice(-20).reduce((s, c) => s + c, 0) / 20;
    const sma50 = closes.length >= 50
      ? closes.slice(-50).reduce((s, c) => s + c, 0) / 50
      : sma20;

    // Trend
    const priceAboveSma20 = price > sma20;
    const sma20AboveSma50 = sma20 > sma50;
    const trend = priceAboveSma20 && sma20AboveSma50 ? 'uptrend'
      : !priceAboveSma20 && !sma20AboveSma50 ? 'downtrend' : 'sideways';

    // 5-day momentum
    const momentum5d = closes.length >= 6
      ? ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100
      : 0;

    // Support/Resistance
    const recent20 = closes.slice(-20);
    const support = Math.min(...recent20);
    const resistance = Math.max(...recent20);

    // Volume surge
    const recentVolAvg = volumes.length >= 20
      ? volumes.slice(-20).reduce((s, v) => s + v, 0) / 20
      : 0;
    const latestVol = volumes[volumes.length - 1] || 0;
    const volumeSurge = recentVolAvg > 0 && latestVol > recentVolAvg * 1.5;

    // SuperTrend(10, 3) — primary deciding factor
    const st = calculateSuperTrend(highs, lows, closes);
    const superTrend = st?.value || price;
    const superTrendSignal = st?.signal || 'SELL';
    const stBullish = superTrendSignal === 'BUY';
    const stBearish = superTrendSignal === 'SELL';

    // Signal scoring — SuperTrend is double-weighted as the deciding factor
    const bullishCount = [
      stBullish, stBullish, // SuperTrend double-weighted
      rsi < 40, trend === 'uptrend', momentum5d > 1, priceAboveSma20,
      volumeSurge && momentum5d > 0,
    ].filter(Boolean).length;
    const bearishCount = [
      stBearish, stBearish, // SuperTrend double-weighted
      rsi > 65, trend === 'downtrend', momentum5d < -1, !priceAboveSma20,
      volumeSurge && momentum5d < 0,
    ].filter(Boolean).length;

    let overallSignal = 'NEUTRAL';
    let score = 50;
    if (bullishCount >= 3) {
      overallSignal = 'BUY';
      score = Math.min(50 + bullishCount * 8, 100);
    } else if (bearishCount >= 3) {
      overallSignal = 'SELL';
      score = Math.min(50 + bearishCount * 8, 100);
    } else {
      score = 30 + Math.max(bullishCount, bearishCount) * 10;
    }

    const rsiSignal = rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought'
      : rsi < 40 ? 'bullish' : rsi > 60 ? 'bearish' : 'neutral';

    return {
      symbol, price,
      rsi, rsiSignal, trend,
      sma20: Math.round(sma20 * 100) / 100,
      sma50: Math.round(sma50 * 100) / 100,
      momentum5d: Math.round(momentum5d * 100) / 100,
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
      volumeSurge, superTrend, superTrendSignal,
      overallSignal, score,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dhan Historical API Scanner — fallback when Yahoo Finance fails
// ─────────────────────────────────────────────────────────────────────────────

const DHAN_SECURITY_IDS: Record<string, number> = {
  RELIANCE: 2885, TCS: 11536, HDFCBANK: 1333, INFY: 1594, ICICIBANK: 4963,
  HINDUNILVR: 1394, ITC: 1660, SBIN: 3045, BHARTIARTL: 10604, KOTAKBANK: 1922,
  LT: 11483, AXISBANK: 5900, BAJFINANCE: 317, ASIANPAINT: 236, MARUTI: 10999,
  TITAN: 3506, SUNPHARMA: 3351, TMCV: 759782, HCLTECH: 7229, WIPRO: 3787,
  ULTRACEMCO: 11532, NESTLEIND: 17963, 'BAJAJ-AUTO': 16669, TATASTEEL: 3499,
  NTPC: 11630, POWERGRID: 14977, ONGC: 2475, JSWSTEEL: 11723, 'M&M': 2031,
  ADANIENT: 25, ADANIPORTS: 15083, TECHM: 13538, INDUSINDBK: 5258, HINDALCO: 1363,
  DRREDDY: 881, CIPLA: 694, DIVISLAB: 10940, BRITANNIA: 547, APOLLOHOSP: 157,
  EICHERMOT: 910, HEROMOTOCO: 1348, COALINDIA: 20374, BPCL: 526, GRASIM: 1232,
  SBILIFE: 21808, TATACONSUM: 3432, BAJAJFINSV: 16675, HDFCLIFE: 467, UPL: 11287,
  LTIM: 17818, HAL: 2303, BDL: 2144, BANKBARODA: 4668, PNB: 10666, CANBK: 10794,
  IDFCFIRSTB: 11184, FEDERALBNK: 1023, BANDHANBNK: 2263, AUBANK: 21238,
  MANAPPURAM: 19061, MUTHOOTFIN: 23650, CHOLAFIN: 685, BAJAJHLDNG: 305,
  SBICARD: 17971, PEL: 11403, RECLTD: 15355, PFC: 14299, IRCTC: 13611, IRFC: 2029,
  INDIANB: 14309, IOC: 1624, GAIL: 4717, PETRONET: 11351, IGL: 11262, MGL: 17534,
  HINDPETRO: 1406, NMDC: 15332, VEDL: 3063, NATIONALUM: 6364, SAIL: 2963,
  JINDALSTEL: 6733, TATAPOWER: 3426, NHPC: 17400, SJVN: 18883, TORNTPOWER: 13786,
  ADANIGREEN: 3563, ADANIPOWER: 17388, TATACOMM: 3721, IDEA: 14366,
  INDUSTOWER: 29135, ZOMATO: 5097, NYKAA: 6545, PAYTM: 6705, POLICYBZR: 6656,
  DELHIVERY: 9599, MPHASIS: 4503, COFORGE: 11543, PERSISTENT: 18365, LTTS: 18564,
  LALPATHLAB: 11654, TATAELXSI: 3411, BIOCON: 11373, LUPIN: 10440, AUROPHARMA: 275,
  TORNTPHARM: 3518, ALKEM: 11703, IPCALAB: 1633, ABBOTINDIA: 17903,
  LAURUSLABS: 19234, GRANULES: 11872, NATCOPHARMA: 3918, GLENMARK: 7406,
  METROPOLIS: 9581, ASHOKLEY: 212, TVSMOTOR: 8479, MRF: 2277, BALKRISIND: 335,
  MOTHERSON: 4204, EXIDEIND: 676, AMARAJABAT: 100, BHEL: 438, BOSCHLTD: 2181,
  ESCORTS: 958, DABUR: 772, MARICO: 4067, GODREJCP: 10099, COLPAL: 15141,
  TRENT: 1964, PAGEIND: 14413, VOLTAS: 3718, HAVELLS: 9819, CROMPTON: 17094,
  WHIRLPOOL: 18011, PIDILITIND: 2664, BERGEPAINT: 404, JUBLFOOD: 18096,
  'MCDOWELL-N': 10447, SHREECEM: 3103, AMBUJACEM: 1270, ACC: 22, RAMCOCEM: 2043,
  DALBHARAT: 8075, ABB: 13, SIEMENS: 3150, CUMMINSIND: 1901, CONCOR: 4749,
  IRCON: 4986, RVNL: 9552, PIIND: 24184, ATUL: 263, DEEPAKNTR: 19943,
  NAVINFLUOR: 14672, SRF: 3273, AARTIIND: 7, CLEAN: 5049, LICHSGFIN: 1997,
  CANFINHOME: 583, ICICIGI: 21770, ICICIPRULI: 18652, MFSL: 2142, MCX: 31181,
  BSE: 19585, ANGELONE: 324, JIOFIN: 18143, APLAPOLLO: 25780, RATNAMANI: 13451,
  ASTRAL: 14418, PVRINOX: 13147, ZEEL: 3812, OFSS: 10738, DLF: 14732,
  GODREJPROP: 17875, PRESTIGE: 20302, LODHA: 3220, PHOENIXLTD: 14552, DIXON: 21690,
  KAYNES: 12092, POLYCAB: 9590, KEI: 13310, CAMS: 342, CDSL: 21174, INDHOTEL: 1512,
  LICI: 9480, MAXHEALTH: 22377, STARHEALTH: 7083, NAUKRI: 13751, DMART: 19913,
  OBEROIRLTY: 20242,
};

/**
 * Scan a single stock via DhanHQ Historical API. Returns null if data unavailable.
 * Uses system-level DHAN_ACCESS_TOKEN env var for authentication.
 */
export async function scanStockDhan(symbol: string, accessToken?: string): Promise<StockScanResult | null> {
  const securityId = DHAN_SECURITY_IDS[symbol];
  if (!securityId) return null;

  const token = accessToken || process.env.DHAN_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

    const res = await fetch('https://api.dhan.co/v2/charts/historical', {
      method: 'POST',
      headers: {
        'access-token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        securityId: String(securityId),
        exchangeSegment: 'NSE_EQ',
        instrument: 'EQUITY',
        fromDate,
        toDate,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as any;

    const closes: number[] = data.close;
    const highs: number[] = data.high;
    const lows: number[] = data.low;
    const volumes: number[] = data.volume;
    if (!closes || !highs || !lows || closes.length < 20) return null;

    const price = closes[closes.length - 1];

    // RSI(14)
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = closes.length - 14; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains.push(change);
      else losses.push(Math.abs(change));
    }
    const avgGain = gains.reduce((s, g) => s + g, 0) / 14;
    const avgLoss = losses.reduce((s, l) => s + l, 0) / 14 || 0.001;
    const rsi = Math.round((100 - (100 / (1 + avgGain / avgLoss))) * 10) / 10;

    // SMA(20) and SMA(50)
    const sma20 = closes.slice(-20).reduce((s, c) => s + c, 0) / 20;
    const sma50 = closes.length >= 50
      ? closes.slice(-50).reduce((s, c) => s + c, 0) / 50
      : sma20;

    // Trend
    const priceAboveSma20 = price > sma20;
    const sma20AboveSma50 = sma20 > sma50;
    const trend = priceAboveSma20 && sma20AboveSma50 ? 'uptrend'
      : !priceAboveSma20 && !sma20AboveSma50 ? 'downtrend' : 'sideways';

    // 5-day momentum
    const momentum5d = closes.length >= 6
      ? ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100
      : 0;

    // Support/Resistance
    const recent20 = closes.slice(-20);
    const support = Math.min(...recent20);
    const resistance = Math.max(...recent20);

    // Volume surge
    const recentVolAvg = volumes && volumes.length >= 20
      ? volumes.slice(-20).reduce((s, v) => s + v, 0) / 20
      : 0;
    const latestVol = volumes?.[volumes.length - 1] || 0;
    const volumeSurge = recentVolAvg > 0 && latestVol > recentVolAvg * 1.5;

    // SuperTrend(10, 3) — primary deciding factor
    const st = calculateSuperTrend(highs, lows, closes);
    const superTrend = st?.value || price;
    const superTrendSignal = st?.signal || 'SELL';
    const stBullish = superTrendSignal === 'BUY';
    const stBearish = superTrendSignal === 'SELL';

    // Signal scoring — SuperTrend is double-weighted as the deciding factor
    const bullishCount = [
      stBullish, stBullish, // SuperTrend double-weighted
      rsi < 40, trend === 'uptrend', momentum5d > 1, priceAboveSma20,
      volumeSurge && momentum5d > 0,
    ].filter(Boolean).length;
    const bearishCount = [
      stBearish, stBearish, // SuperTrend double-weighted
      rsi > 65, trend === 'downtrend', momentum5d < -1, !priceAboveSma20,
      volumeSurge && momentum5d < 0,
    ].filter(Boolean).length;

    let overallSignal = 'NEUTRAL';
    let score = 50;
    if (bullishCount >= 3) {
      overallSignal = 'BUY';
      score = Math.min(50 + bullishCount * 8, 100);
    } else if (bearishCount >= 3) {
      overallSignal = 'SELL';
      score = Math.min(50 + bearishCount * 8, 100);
    } else {
      score = 30 + Math.max(bullishCount, bearishCount) * 10;
    }

    const rsiSignal = rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought'
      : rsi < 40 ? 'bullish' : rsi > 60 ? 'bearish' : 'neutral';

    return {
      symbol, price,
      rsi, rsiSignal, trend,
      sma20: Math.round(sma20 * 100) / 100,
      sma50: Math.round(sma50 * 100) / 100,
      momentum5d: Math.round(momentum5d * 100) / 100,
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
      volumeSurge, superTrend, superTrendSignal,
      overallSignal, score,
    };
  } catch {
    return null;
  }
}

/**
 * Batch scan multiple stocks in parallel with concurrency limit.
 * Returns results sorted by score descending.
 */
export async function batchScanStocks(
  symbols: string[],
  concurrency: number = 25,
): Promise<StockScanResult[]> {
  const results: StockScanResult[] = [];

  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(scanStockYahoo));
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
