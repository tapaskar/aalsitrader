/**
 * API handlers for Nifty Straddle endpoints.
 * Called from http.ts route dispatcher.
 * All handlers accept userId for per-user data isolation.
 * Now broker-agnostic — resolves adapter via factory.
 */

import {
  getEngineState,
  setEngineState,
  getOpenTrade,
  getTradeHistory,
  getCapitalSummary,
  getCapitalConfig,
  initCapitalConfig,
  normalizeTrade,
} from './straddle-store.js';
import { isMarketOpen } from './market-hours.js';
import { createBrokerAdapter } from './adapters/adapter-factory.js';
import type { BrokerName } from './broker-adapter.js';
import { checkBrokerConfigured, getBrokerSetupGuidance } from '../utils/broker-check.js';
import { getUserProfile, checkPlanAccess } from '../auth/auth.js';
import { computeDelta, estimateStrategyMargin } from './option-pricing.js';
import { ECSClient, UpdateServiceCommand } from '@aws-sdk/client-ecs';
import type { IndexName } from './index-config.js';
import { getIndexConfig } from './index-config.js';
import { type StrategyType, STRATEGY_CONFIGS, getStrategyConfig } from './strategy-types.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const ECS_CLUSTER = process.env.ECS_CLUSTER || 'nifty-straddle-prod';
const ECS_SERVICE = process.env.ECS_SERVICE || 'straddle-engine';
const ecsClient = new ECSClient({ region: REGION });

const BROKER_LABELS: Record<BrokerName, string> = {
  dhan: 'DhanHQ API',
  zerodha: 'Zerodha Kite',
  motilal: 'Motilal MOTS',
  angelone: 'AngelOne SmartAPI',
  upstox: 'Upstox API',
};

interface ApiResult {
  statusCode: number;
  body: any;
}

/** GET /nifty-straddle/status */
export async function handleStraddleStatus(userId?: string): Promise<ApiResult> {
  const engine = await getEngineState(userId);
  const market = isMarketOpen();

  // Check broker connectivity via adapter
  let connected = false;
  let brokerError: string | null = null;
  if (userId) {
    const adapter = await createBrokerAdapter(engine.broker, userId);
    if (adapter) {
      const result = await adapter.checkConnectivity();
      connected = result.connected;
      brokerError = result.error;
    } else {
      brokerError = `${BROKER_LABELS[engine.broker]} credentials not configured`;
    }
  }

  return {
    statusCode: 200,
    body: {
      broker: {
        connected,
        error: brokerError,
        name: engine.broker,
        label: BROKER_LABELS[engine.broker],
      },
      market: { isOpen: market.isOpen, istTime: market.istTime },
      engine: {
        running: engine.running,
        mode: engine.mode,
        broker: engine.broker,
        indexName: engine.indexName || 'NIFTY',
        strategyType: engine.strategyType || 'short_straddle',
        lastUpdate: engine.lastUpdate,
        lastSpot: engine.lastSpot,
        lastNiftySpot: engine.lastSpot ?? engine.lastNiftySpot,
      },
    },
  };
}

/** GET /nifty-straddle/capital */
export async function handleStraddleCapital(userId?: string): Promise<ApiResult> {
  await initCapitalConfig(200000, userId);
  const summary = await getCapitalSummary(userId);
  return { statusCode: 200, body: summary };
}

/** GET /nifty-straddle/current */
export async function handleStraddleCurrent(userId?: string): Promise<ApiResult> {
  const engine = await getEngineState(userId);
  const openTrade = await getOpenTrade(userId);

  if (!openTrade) {
    return { statusCode: 200, body: { position: null } };
  }

  const trade = normalizeTrade(openTrade);
  const legs = trade.legs || [];
  const qty = trade.lotSize * trade.lots;
  const strategyType: StrategyType = (trade.strategyType as StrategyType) || engine.strategyType || 'short_straddle';
  const stratConfig = getStrategyConfig(strategyType);
  const indexName: IndexName = trade.indexName || engine.indexName || 'NIFTY';

  // Build per-leg current premiums from engine state
  const legPremiums = engine.legPremiums || legs.map(l => l.entryPremium);
  const legDeltas = engine.legDeltas || legs.map(() => 0.5);

  // Build N-leg response
  const legDetails = legs.map((leg, i) => ({
    side: leg.side,
    action: leg.action,
    strikePrice: leg.strikePrice,
    entryPremium: round2(leg.entryPremium),
    curPremium: round2(legPremiums[i] ?? leg.entryPremium),
    delta: round4(legDeltas[i] ?? 0.5),
    instrumentId: leg.instrumentId,
    orderId: leg.orderId,
  }));

  // Compute combined unrealized P&L
  let unrealizedPnl = 0;
  let totalCollected = 0;
  let totalCurrent = 0;
  for (let i = 0; i < legs.length; i++) {
    const curPrem = legPremiums[i] ?? legs[i].entryPremium;
    if (legs[i].action === 'SELL') {
      unrealizedPnl += (legs[i].entryPremium - curPrem) * qty;
      totalCollected += legs[i].entryPremium;
      totalCurrent += curPrem;
    } else {
      unrealizedPnl += (curPrem - legs[i].entryPremium) * qty;
      totalCollected -= legs[i].entryPremium;
      totalCurrent -= curPrem;
    }
  }

  // Compute live margin
  const spot = engine.lastSpot || trade.niftyEntry;
  const margin = estimateStrategyMargin(spot, trade.lotSize, trade.lots, Math.abs(totalCollected), stratConfig.marginFactor);
  const { initialCapital } = await getCapitalConfig(userId);

  // Legacy 2-leg compat fields
  const ceLeg = legs.find(l => l.side === 'CE' && l.action === 'SELL');
  const peLeg = legs.find(l => l.side === 'PE' && l.action === 'SELL');
  const ceIdx = ceLeg ? legs.indexOf(ceLeg) : -1;
  const peIdx = peLeg ? legs.indexOf(peLeg) : -1;

  return {
    statusCode: 200,
    body: {
      position: {
        id: trade.id,
        mode: trade.mode,
        broker: trade.broker || engine.broker,
        entryTime: trade.entryTime,
        niftyEntry: trade.niftyEntry,
        indexName,
        strategyType,
        strategyLabel: stratConfig.displayName,
        // N-leg data
        legs: legDetails,
        totalCollected: round2(totalCollected),
        totalCurrent: round2(totalCurrent),
        lotSize: trade.lotSize,
        lots: trade.lots,
        unrealizedPnl: round2(unrealizedPnl),
        marginRequired: round2(margin.totalMargin),
        netMarginRequired: round2(margin.netMargin),
        capitalUtilization: round2((margin.netMargin / initialCapital) * 100),
        exitRules: stratConfig.exitRules,
        // Legacy 2-leg compat
        ceStrike: ceLeg?.strikePrice ?? trade.ceStrike,
        ceEntryPremium: ceLeg ? round2(ceLeg.entryPremium) : round2(trade.ceEntryPremium ?? 0),
        ceCurPremium: ceIdx >= 0 ? round2(legPremiums[ceIdx] ?? ceLeg!.entryPremium) : round2(engine.ceCurPremium ?? 0),
        ceDelta: ceIdx >= 0 ? round4(legDeltas[ceIdx] ?? 0.5) : round4(engine.ceDelta ?? 0.5),
        peStrike: peLeg?.strikePrice ?? trade.peStrike,
        peEntryPremium: peLeg ? round2(peLeg.entryPremium) : round2(trade.peEntryPremium ?? 0),
        peCurPremium: peIdx >= 0 ? round2(legPremiums[peIdx] ?? peLeg!.entryPremium) : round2(engine.peCurPremium ?? 0),
        peDelta: peIdx >= 0 ? round4(legDeltas[peIdx] ?? 0.5) : round4(engine.peDelta ?? 0.5),
        ceOrderId: ceLeg?.orderId ?? trade.ceOrderId,
        peOrderId: peLeg?.orderId ?? trade.peOrderId,
      },
    },
  };
}

/** GET /nifty-straddle/trades */
export async function handleStraddleTrades(
  queryParams: Record<string, string> | null,
  userId?: string,
): Promise<ApiResult> {
  const from = queryParams?.from;
  const to = queryParams?.to;
  const trades = await getTradeHistory(from, to, userId);
  return { statusCode: 200, body: { trades } };
}

/** Scale ECS Fargate service up or down */
async function scaleFargate(desiredCount: number): Promise<void> {
  try {
    await ecsClient.send(new UpdateServiceCommand({
      cluster: ECS_CLUSTER,
      service: ECS_SERVICE,
      desiredCount,
    }));
    console.log(`[Straddle API] Fargate scaled to desiredCount=${desiredCount}`);
  } catch (err: any) {
    console.error(`[Straddle API] Fargate scale error:`, err.message);
  }
}

/** POST /nifty-straddle/start */
export async function handleStraddleStart(body?: { index?: string; strategy?: string }, userId?: string): Promise<ApiResult> {
  const state = await getEngineState(userId);
  if (state.running) {
    return { statusCode: 200, body: { started: false, message: 'Engine already running' } };
  }

  // Auto-detect broker from user's credentials
  let broker = state.broker;
  if (!broker) {
    const profile = await getUserProfile(userId);
    if (profile?.hasDhanCredentials) broker = 'dhan';
    else if (profile?.hasZerodhaCredentials) broker = 'zerodha';
    else if (profile?.hasMotilalCredentials) broker = 'motilal';
    else broker = 'dhan'; // fallback for paper mode
    await setEngineState({ broker }, userId);
    console.log(`[Straddle API] Auto-detected broker=${broker} for user=${userId}`);
  }

  // Autonomous mode: strategy + index auto-selected per trade at entry time
  await initCapitalConfig(200000, userId);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  await setEngineState({ running: true, todayDate: today, todayTraded: false, indexName: 'NIFTY', strategyType: 'short_straddle' }, userId);

  const market = isMarketOpen();
  if (market.isOpen) {
    await scaleFargate(1);
  } else {
    console.log(`[Straddle API] Market closed (${market.istTime}), Fargate will auto-start at 9:10 AM via EventBridge`);
  }

  return {
    statusCode: 200,
    body: {
      started: true,
      message: 'Autonomous engine started — strategy auto-selected per trade',
      mode: state.mode,
      broker,
      autonomous: true,
    },
  };
}

/** POST /nifty-straddle/stop */
export async function handleStraddleStop(userId?: string): Promise<ApiResult> {
  const state = await getEngineState(userId);
  if (!state.running) {
    return { statusCode: 200, body: { stopped: false, message: 'Engine not running' } };
  }
  await setEngineState({ running: false }, userId);

  // Check if any other users still have engines running; if not, scale down Fargate
  const { getUsersWithRunningEngines } = await import('./straddle-store.js');
  const activeUsers = await getUsersWithRunningEngines();
  if (activeUsers.length === 0) {
    await scaleFargate(0);
  }

  return { statusCode: 200, body: { stopped: true, message: 'Engine stopped' } };
}

/** POST /nifty-straddle/mode */
export async function handleStraddleMode(body: { mode?: string }, userId?: string): Promise<ApiResult> {
  const state = await getEngineState(userId);

  // Only allow mode change when engine is stopped
  if (state.running) {
    return {
      statusCode: 400,
      body: { error: 'Stop the engine before changing mode' },
    };
  }

  const newMode = body.mode === 'live' ? 'live' : 'paper';

  // Gate live mode on plan access + broker credentials
  if (newMode === 'live' && userId) {
    const profile = await getUserProfile(userId);
    if (profile) {
      const access = checkPlanAccess(profile, 'nifty_scalper');
      if (!access.allowed) {
        return {
          statusCode: 403,
          body: { error: access.reason || 'Plan upgrade required', needsPlanUpgrade: true },
        };
      }
    }

    const brokerCheck = await checkBrokerConfigured(userId);
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

  await setEngineState({ mode: newMode }, userId);
  return { statusCode: 200, body: { mode: newMode, message: `Switched to ${newMode} mode` } };
}

/** POST /nifty-straddle/broker */
export async function handleStraddleBroker(body: { broker?: string }, userId?: string): Promise<ApiResult> {
  const state = await getEngineState(userId);

  // Only allow broker change when engine is stopped
  if (state.running) {
    return {
      statusCode: 400,
      body: { error: 'Stop the engine before changing broker' },
    };
  }

  const validBrokers: BrokerName[] = ['dhan', 'zerodha', 'motilal', 'angelone', 'upstox'];
  const newBroker = body.broker as BrokerName;
  if (!newBroker || !validBrokers.includes(newBroker)) {
    return {
      statusCode: 400,
      body: { error: `Invalid broker: ${body.broker}. Valid: ${validBrokers.join(', ')}` },
    };
  }

  await setEngineState({ broker: newBroker }, userId);
  return {
    statusCode: 200,
    body: {
      broker: newBroker,
      label: BROKER_LABELS[newBroker],
      message: `Switched to ${BROKER_LABELS[newBroker]}`,
    },
  };
}

/** POST /nifty-straddle/index — change index (only when stopped) */
export async function handleStraddleIndex(body: { index?: string }, userId?: string): Promise<ApiResult> {
  const state = await getEngineState(userId);
  if (state.running) {
    return { statusCode: 400, body: { error: 'Stop the engine before changing index' } };
  }
  const validIndices: IndexName[] = ['NIFTY', 'BANKNIFTY'];
  const newIndex = body.index as IndexName;
  if (!newIndex || !validIndices.includes(newIndex)) {
    return { statusCode: 400, body: { error: `Invalid index: ${body.index}. Valid: ${validIndices.join(', ')}` } };
  }
  await setEngineState({ indexName: newIndex }, userId);
  const config = getIndexConfig(newIndex);
  return { statusCode: 200, body: { indexName: newIndex, displayName: config.displayName, message: `Switched to ${config.displayName}` } };
}

/** POST /nifty-straddle/strategy — change strategy (only when stopped) */
export async function handleStraddleStrategy(body: { strategy?: string }, userId?: string): Promise<ApiResult> {
  const state = await getEngineState(userId);
  if (state.running) {
    return { statusCode: 400, body: { error: 'Stop the engine before changing strategy' } };
  }
  const validStrategies: StrategyType[] = ['short_straddle', 'short_strangle', 'iron_condor'];
  const newStrategy = body.strategy as StrategyType;
  if (!newStrategy || !validStrategies.includes(newStrategy)) {
    return { statusCode: 400, body: { error: `Invalid strategy: ${body.strategy}. Valid: ${validStrategies.join(', ')}` } };
  }
  await setEngineState({ strategyType: newStrategy }, userId);
  const config = getStrategyConfig(newStrategy);
  return { statusCode: 200, body: { strategyType: newStrategy, displayName: config.displayName, message: `Switched to ${config.displayName}` } };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
