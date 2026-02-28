/**
 * DynamoDB CRUD for Nifty Straddle paper trades and engine state.
 * Single-table design: nifty-straddle-{env}
 * All data is scoped per-user via USER#{userId} key prefix.
 */

import { GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../utils/db.js';
import type { BrokerName } from './broker-adapter.js';
import type { IndexName } from './index-config.js';
import type { StrategyType, TradeLeg } from './strategy-types.js';

const STAGE = process.env.STAGE || 'prod';
const TABLE = process.env.NIFTY_STRADDLE_TABLE || `nifty-straddle-${STAGE}`;

const DEFAULT_USER = 'GLOBAL';
function userPk(userId?: string): string {
  return `USER#${userId || DEFAULT_USER}`;
}

// ── Engine State ─────────────────────────────────────────────

export interface EngineState {
  running: boolean;
  mode: 'paper' | 'live';
  broker: BrokerName;
  indexName: IndexName;
  strategyType: StrategyType;
  lastSpot: number | null;
  prevSpot: number | null;
  lastUpdate: string | null;
  todayTraded: boolean;        // deprecated — kept for backward compat
  dailyTradeCount: number;
  lastExitTime: string | null;
  todayDate: string | null;
  // Live premium state per leg (persisted across ticks — JSON array in DynamoDB)
  legPremiums?: number[];
  legDeltas?: number[];
  // Legacy 2-leg fields (backward compat for existing DynamoDB records)
  lastNiftySpot?: number | null;
  prevNiftySpot?: number | null;
  ceCurPremium?: number;
  peCurPremium?: number;
  ceDelta?: number;
  peDelta?: number;
}

const DEFAULT_STATE: EngineState = {
  running: false,
  mode: 'paper',
  broker: null as any,
  indexName: 'NIFTY',
  strategyType: 'short_straddle',
  lastSpot: null,
  prevSpot: null,
  lastUpdate: null,
  todayTraded: false,
  dailyTradeCount: 0,
  lastExitTime: null,
  todayDate: null,
};

export async function getEngineState(userId?: string): Promise<EngineState> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { pk: userPk(userId), sk: 'ENGINE' },
    ConsistentRead: true,
  }));
  if (!result.Item) return { ...DEFAULT_STATE };
  const item = result.Item;
  return {
    running: item.running ?? false,
    mode: item.mode ?? 'paper',
    broker: item.broker ?? null,
    indexName: item.indexName ?? 'NIFTY',
    strategyType: item.strategyType ?? 'short_straddle',
    lastSpot: item.lastSpot ?? item.lastNiftySpot ?? null,
    prevSpot: item.prevSpot ?? item.prevNiftySpot ?? null,
    lastUpdate: item.lastUpdate ?? null,
    todayTraded: item.todayTraded ?? false,
    todayDate: item.todayDate ?? null,
    dailyTradeCount: item.dailyTradeCount ?? 0,
    lastExitTime: item.lastExitTime ?? null,
    legPremiums: item.legPremiums,
    legDeltas: item.legDeltas,
    // Legacy 2-leg compat
    lastNiftySpot: item.lastNiftySpot ?? item.lastSpot ?? null,
    prevNiftySpot: item.prevNiftySpot ?? item.prevSpot ?? null,
    ceCurPremium: item.ceCurPremium,
    peCurPremium: item.peCurPremium,
    ceDelta: item.ceDelta,
    peDelta: item.peDelta,
  };
}

export async function setEngineState(state: Partial<EngineState>, userId?: string): Promise<void> {
  const updates: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, any> = {};

  for (const [key, val] of Object.entries(state)) {
    if (val === undefined) continue;
    const attr = `#${key}`;
    const valKey = `:${key}`;
    updates.push(`${attr} = ${valKey}`);
    names[attr] = key;
    values[valKey] = val;
  }

  if (updates.length === 0) return;

  await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: userPk(userId), sk: 'ENGINE' },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

// ── Capital Config ───────────────────────────────────────────

export async function getCapitalConfig(userId?: string): Promise<{ initialCapital: number }> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { pk: userPk(userId), sk: 'CAPITAL' },
  }));
  return { initialCapital: result.Item?.initialCapital ?? 200000 };
}

export async function initCapitalConfig(initialCapital = 200000, userId?: string): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: { pk: userPk(userId), sk: 'CAPITAL', initialCapital },
    ConditionExpression: 'attribute_not_exists(pk)',
  })).catch(() => { /* Already exists, ignore */ });
}

// ── Trade CRUD ───────────────────────────────────────────────

export interface StraddleTrade {
  id: string;
  tradeDate: string;
  strategyType: string;
  indexName?: IndexName;
  mode: 'paper' | 'live';
  entryTime: string;
  niftyEntry: number;     // Kept as "niftyEntry" for backward compat (actually = spotEntry)
  // N-leg support: new trades use legs[] array
  legs?: TradeLeg[];
  totalCollected: number;  // Net premium collected (sells) or paid (buys)
  lotSize: number;
  lots: number;
  status: 'open' | 'closed';
  // Exit fields (set on close)
  exitTime?: string;
  niftyExit?: number;
  totalAtExit?: number;
  grossPnl?: number;
  netPnl?: number;
  exitReason?: string;
  // Legacy 2-leg fields (backward compat for existing DynamoDB data)
  ceStrike?: number;
  ceEntryPremium?: number;
  peStrike?: number;
  peEntryPremium?: number;
  ceExitPremium?: number;
  peExitPremium?: number;
  ceOrderId?: string;
  peOrderId?: string;
  ceExitOrderId?: string;
  peExitOrderId?: string;
  ceInstrumentId?: string;
  peInstrumentId?: string;
  ceSecurityId?: number;
  peSecurityId?: number;
  // Broker name (for multi-broker support)
  broker?: BrokerName;
  // Margin estimation at entry
  marginRequired?: number;
  premiumOffset?: number;
  netMarginRequired?: number;
}

/** Convert a legacy 2-leg trade to use legs[] array */
export function normalizeTrade(trade: StraddleTrade): StraddleTrade {
  if (trade.legs && trade.legs.length > 0) return trade;
  // Build legs from legacy ce/pe fields
  const legs: TradeLeg[] = [];
  if (trade.ceStrike != null && trade.ceEntryPremium != null) {
    legs.push({
      side: 'CE',
      action: 'SELL',
      strikePrice: trade.ceStrike,
      instrumentId: trade.ceInstrumentId,
      orderId: trade.ceOrderId,
      entryPremium: trade.ceEntryPremium,
      exitPremium: trade.ceExitPremium,
      exitOrderId: trade.ceExitOrderId,
    });
  }
  if (trade.peStrike != null && trade.peEntryPremium != null) {
    legs.push({
      side: 'PE',
      action: 'SELL',
      strikePrice: trade.peStrike,
      instrumentId: trade.peInstrumentId,
      orderId: trade.peOrderId,
      entryPremium: trade.peEntryPremium,
      exitPremium: trade.peExitPremium,
      exitOrderId: trade.peExitOrderId,
    });
  }
  return { ...trade, legs, indexName: trade.indexName ?? 'NIFTY' };
}

export async function insertOpenTrade(trade: Omit<StraddleTrade, 'id' | 'status'>, userId?: string): Promise<string> {
  const id = crypto.randomUUID();
  const user = userId || DEFAULT_USER;
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: {
      pk: `USER#${user}#TRADE#${id}`,
      sk: 'METADATA',
      gsi1pk: `USER#${user}#STATUS#open`,
      gsi1sk: trade.tradeDate,
      id,
      status: 'open',
      ...trade,
    },
  }));
  return id;
}

export async function closeTrade(id: string, exitData: {
  exitTime: string;
  niftyExit: number;
  totalAtExit: number;
  grossPnl: number;
  netPnl: number;
  exitReason: string;
  legs?: TradeLeg[];
  // Legacy 2-leg fields (optional)
  ceExitPremium?: number;
  peExitPremium?: number;
  ceExitOrderId?: string;
  peExitOrderId?: string;
}, userId?: string): Promise<void> {
  const user = userId || DEFAULT_USER;

  // Build dynamic update expression
  const updates: string[] = [
    '#status = :closed',
    'gsi1pk = :closedStatus',
    'exitTime = :exitTime',
    'niftyExit = :niftyExit',
    'totalAtExit = :totalAtExit',
    'grossPnl = :grossPnl',
    'netPnl = :netPnl',
    'exitReason = :exitReason',
  ];
  const names: Record<string, string> = { '#status': 'status' };
  const values: Record<string, any> = {
    ':closed': 'closed',
    ':closedStatus': `USER#${user}#STATUS#closed`,
    ':exitTime': exitData.exitTime,
    ':niftyExit': exitData.niftyExit,
    ':totalAtExit': exitData.totalAtExit,
    ':grossPnl': exitData.grossPnl,
    ':netPnl': exitData.netPnl,
    ':exitReason': exitData.exitReason,
  };

  // Store legs array if provided
  if (exitData.legs) {
    updates.push('legs = :legs');
    values[':legs'] = exitData.legs;
  }

  // Legacy 2-leg fields
  if (exitData.ceExitPremium != null) {
    updates.push('ceExitPremium = :ceExitPremium');
    values[':ceExitPremium'] = exitData.ceExitPremium;
  }
  if (exitData.peExitPremium != null) {
    updates.push('peExitPremium = :peExitPremium');
    values[':peExitPremium'] = exitData.peExitPremium;
  }
  if (exitData.ceExitOrderId) {
    updates.push('ceExitOrderId = :ceExitOrderId');
    values[':ceExitOrderId'] = exitData.ceExitOrderId;
  }
  if (exitData.peExitOrderId) {
    updates.push('peExitOrderId = :peExitOrderId');
    values[':peExitOrderId'] = exitData.peExitOrderId;
  }

  await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk: `USER#${user}#TRADE#${id}`, sk: 'METADATA' },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export async function getOpenTrade(userId?: string): Promise<StraddleTrade | null> {
  const user = userId || DEFAULT_USER;
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'StatusDateIndex',
    KeyConditionExpression: 'gsi1pk = :open',
    ExpressionAttributeValues: { ':open': `USER#${user}#STATUS#open` },
    ScanIndexForward: false,
    Limit: 1,
  }));
  const item = result.Items?.[0];
  if (!item) return null;
  return normalizeTrade(item as StraddleTrade);
}

export async function getTradeHistory(
  from?: string,
  to?: string,
  userId?: string,
): Promise<StraddleTrade[]> {
  const user = userId || DEFAULT_USER;
  let keyExpr = 'gsi1pk = :closed';
  const values: Record<string, any> = { ':closed': `USER#${user}#STATUS#closed` };

  if (from && to) {
    keyExpr += ' AND gsi1sk BETWEEN :from AND :to';
    values[':from'] = from;
    values[':to'] = to;
  } else if (from) {
    keyExpr += ' AND gsi1sk >= :from';
    values[':from'] = from;
  } else if (to) {
    keyExpr += ' AND gsi1sk <= :to';
    values[':to'] = to;
  }

  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'StatusDateIndex',
    KeyConditionExpression: keyExpr,
    ExpressionAttributeValues: values,
    ScanIndexForward: false,
  }));
  return (result.Items || []) as StraddleTrade[];
}

export async function getCapitalSummary(userId?: string): Promise<{
  initialCapital: number;
  currentCapital: number;
  totalPnl: number;
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  maxDrawdownPct: number;
}> {
  const { initialCapital } = await getCapitalConfig(userId);
  const trades = await getTradeHistory(undefined, undefined, userId);

  let totalPnl = 0;
  let winningTrades = 0;
  for (const t of trades) {
    const pnl = t.netPnl ?? 0;
    totalPnl += pnl;
    if (pnl > 0) winningTrades++;
  }

  const totalTrades = trades.length;
  const currentCapital = initialCapital + totalPnl;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  // Compute max drawdown from cumulative PnL series
  let maxDrawdownPct = 0;
  if (totalTrades > 0) {
    // Sort by date ascending for drawdown calc
    const sorted = [...trades].sort((a, b) => (a.tradeDate || '').localeCompare(b.tradeDate || ''));
    let cumPnl = 0;
    let peak = 0;
    for (const t of sorted) {
      cumPnl += t.netPnl ?? 0;
      if (cumPnl > peak) peak = cumPnl;
      const dd = peak - cumPnl;
      const ddPct = peak > 0 ? (dd / (initialCapital + peak)) * 100 : 0;
      if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
    }
  }

  return {
    initialCapital,
    currentCapital: round2(currentCapital),
    totalPnl: round2(totalPnl),
    totalTrades,
    winningTrades,
    winRate: round1(winRate),
    maxDrawdownPct: round1(maxDrawdownPct),
  };
}

// ── Multi-user helpers ───────────────────────────────────────

export async function getUsersWithRunningEngines(): Promise<string[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'sk = :engine AND running = :true',
    ExpressionAttributeValues: {
      ':engine': 'ENGINE',
      ':true': true,
    },
    ProjectionExpression: 'pk',
  }));

  if (!result.Items) return [];

  return result.Items
    .map(item => {
      // pk is "USER#{userId}" — extract userId
      const pk = item.pk as string;
      const prefix = 'USER#';
      return pk.startsWith(prefix) ? pk.slice(prefix.length) : null;
    })
    .filter((id): id is string => id !== null && id !== DEFAULT_USER);
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round1(n: number): number { return Math.round(n * 10) / 10; }
