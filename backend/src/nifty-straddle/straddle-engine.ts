/**
 * Nifty Straddle paper/live trading engine — stateless tick.
 * Called by EventBridge Lambda every 3 minutes or Fargate WS runner.
 * Reads/writes all state from DynamoDB (no in-memory persistence).
 * All calls are scoped per-user via userId param.
 *
 * Now supports multi-index (NIFTY / BANKNIFTY) and multi-strategy
 * (straddle / strangle / iron condor) with N-leg positions.
 */

import {
  estimateAtmPremium,
  estimateStrategyMargin,
  computeDelta,
  updatePremium,
  findATMStrike,
  TRADING_DAYS_PER_YEAR,
} from './option-pricing.js';
import { isMarketOpen, getMinutesSinceOpen, type MarketStatus } from './market-hours.js';
import type { BrokerAdapter, OptionChainStrike } from './broker-adapter.js';
import { getIndexConfig, type IndexName } from './index-config.js';
import { getStrategyConfig, computeLegStrike, autoSelectStrategy, type StrategyType, type TradeLeg } from './strategy-types.js';
import {
  getEngineState,
  setEngineState,
  insertOpenTrade,
  closeTrade,
  getOpenTrade,
  normalizeTrade,
  type EngineState,
  type StraddleTrade,
} from './straddle-store.js';

const CONFIG = {
  entryStartHour: 9,
  entryStartMinute: 30,
  entryEndHour: 14,
  entryEndMinute: 30,
  exitHour: 15,
  exitMinute: 25,
  iv: 0.14,
  lots: 1,
  brokerage: 120,
  cooldownMinutes: 10,
  maxDailyTrades: 5,
};

/** Live tick data injected by Fargate runner (bypasses REST polling). */
export interface InjectedTickData {
  spot: number;
  legPremiums?: number[];
  // Legacy 2-leg fields
  niftySpot?: number;
  ceCurPremium?: number;
  peCurPremium?: number;
}

export async function runTick(
  userId?: string,
  adapter?: BrokerAdapter | null,
  injectedData?: InjectedTickData,
): Promise<{ action: string; details?: string }> {
  const state = await getEngineState(userId);
  if (!state.running) return { action: 'skipped', details: 'engine not running' };

  const market = isMarketOpen();
  const today = getTodayIST();
  const index: IndexName = state.indexName || 'NIFTY';
  const strategyType: StrategyType = state.strategyType || 'short_straddle';

  // Reset daily state on new day
  if (today !== state.todayDate) {
    state.todayDate = today;
    state.dailyTradeCount = 0;
    state.lastExitTime = null;
    const open = await getOpenTrade(userId);
    if (!open) state.prevSpot = null;
  }

  // Fetch spot — use injected data (Fargate WS) or REST poll (Lambda)
  if (injectedData) {
    state.prevSpot = state.lastSpot;
    state.lastSpot = injectedData.spot || injectedData.niftySpot || null;
  } else if (adapter) {
    const spotData = await adapter.getSpotPrice(index);
    if (spotData?.price) {
      state.prevSpot = state.lastSpot;
      state.lastSpot = spotData.price;
    }
  }
  state.lastUpdate = new Date().toISOString();

  // Check open trade
  const openTrade = await getOpenTrade(userId);

  // Handle market closed with open position
  if (!market.isOpen && openTrade) {
    if (isPastExitTime(market)) {
      await closePosition(openTrade, state, 'time', userId, adapter);
      await setEngineState(state, userId);
      return { action: 'closed', details: 'time exit (market closed)' };
    }
    await setEngineState(state, userId);
    return { action: 'skipped', details: 'market closed, position held' };
  }

  if (!market.isOpen) {
    await setEngineState(state, userId);
    return { action: 'skipped', details: 'market closed' };
  }

  if (!state.lastSpot) {
    await setEngineState(state, userId);
    return { action: 'skipped', details: 'no spot data' };
  }

  const minutesSinceOpen = getMinutesSinceOpen();

  // Update open position
  if (openTrade) {
    const trade = normalizeTrade(openTrade);
    const legs = trade.legs || [];

    // Use injected premium data from Fargate WebSocket if available
    if (injectedData?.legPremiums && injectedData.legPremiums.length === legs.length) {
      state.legPremiums = injectedData.legPremiums;
      const dte = estimateDte();
      state.legDeltas = legs.map(leg =>
        computeDelta(state.lastSpot!, leg.strikePrice, leg.side, dte, CONFIG.iv),
      );
    } else if (injectedData?.ceCurPremium != null && injectedData?.peCurPremium != null && legs.length === 2) {
      // Legacy 2-leg injected data
      state.legPremiums = [injectedData.ceCurPremium, injectedData.peCurPremium];
      const dte = estimateDte();
      state.legDeltas = legs.map(leg =>
        computeDelta(state.lastSpot!, leg.strikePrice, leg.side, dte, CONFIG.iv),
      );
    } else {
      const barChange = state.prevSpot != null ? state.lastSpot - state.prevSpot : 0;
      await updateLegPremiums(state, trade, barChange, minutesSinceOpen, adapter, index);
    }

    const exitReason = checkExitConditions(state, trade, market, strategyType);
    if (exitReason) {
      await closePosition(trade, state, exitReason, userId, adapter);
      await setEngineState(state, userId);
      return { action: 'closed', details: exitReason };
    }
  }

  // Check entry — auto-select strategy based on market conditions
  if (!openTrade && state.dailyTradeCount < CONFIG.maxDailyTrades && isEntryWindow(market) && isCooldownComplete(state)) {
    const dte = estimateDte();
    const recentExits = await getRecentExitReasons(userId);
    const picked = autoSelectStrategy(dte, market.istHour, market.istMinute, recentExits);
    const autoIndex = picked.index;
    const autoStrategy = picked.strategy;
    console.log(`[AutoStrategy] Selected ${autoStrategy} on ${autoIndex}: ${picked.reason}`);
    await openPosition(state, userId, adapter, autoIndex, autoStrategy);
    await setEngineState(state, userId);
    return { action: 'opened', details: `${picked.strategy}: ${picked.reason}` };
  }

  await setEngineState(state, userId);
  return { action: 'tick', details: 'monitored' };
}

// ── Entry / Exit Logic ───────────────────────────────────────

function isEntryWindow(market: MarketStatus): boolean {
  const { istHour, istMinute } = market;
  const current = istHour * 60 + istMinute;
  const start = CONFIG.entryStartHour * 60 + CONFIG.entryStartMinute;
  const end = CONFIG.entryEndHour * 60 + CONFIG.entryEndMinute;
  return current >= start && current <= end;
}

function isCooldownComplete(state: EngineState): boolean {
  if (!state.lastExitTime) return true;
  const elapsed = (Date.now() - new Date(state.lastExitTime).getTime()) / 60000;
  return elapsed >= CONFIG.cooldownMinutes;
}

function isPastExitTime(market: MarketStatus): boolean {
  const { istHour, istMinute } = market;
  const exitMinutes = CONFIG.exitHour * 60 + CONFIG.exitMinute;
  const currentMinutes = istHour * 60 + istMinute;
  return currentMinutes >= exitMinutes;
}

async function openPosition(
  state: EngineState,
  userId: string | undefined,
  adapter: BrokerAdapter | null | undefined,
  index: IndexName,
  strategyType: StrategyType,
): Promise<void> {
  const spot = state.lastSpot!;
  const dte = estimateDte();
  const iv = CONFIG.iv;
  const indexConfig = getIndexConfig(index);
  const stratConfig = getStrategyConfig(strategyType);
  const lotSize = indexConfig.lotSize;
  const atmStrike = findATMStrike(spot, index);

  // Fetch option chain from broker
  let chain: OptionChainStrike[] = [];
  if (adapter) {
    const expiry = await adapter.getNearestExpiry(index);
    if (!expiry) {
      console.error(`[${state.mode}/${adapter.brokerName}] Could not get nearest expiry for ${index}`);
      return;
    }
    chain = await adapter.getOptionChain(index, expiry);
  }

  // Build legs from strategy template
  const legs: TradeLeg[] = [];
  let totalSellPremium = 0;
  let totalBuyPremium = 0;

  for (const template of stratConfig.legs) {
    const strike = computeLegStrike(atmStrike, template, indexConfig.strikeInterval);
    let premium: number;
    let instrumentId: string | undefined;
    let orderId: string | undefined;

    if (chain.length > 0) {
      // Find this strike in the option chain
      const strikeData = chain.find(s => s.strikePrice === strike);
      if (!strikeData) {
        console.error(`[${state.mode}/${adapter?.brokerName}] Strike ${strike} not found in ${index} chain`);
        return;
      }
      premium = template.side === 'CE' ? strikeData.ceLtp : strikeData.peLtp;
      instrumentId = template.side === 'CE' ? strikeData.ceInstrumentId : strikeData.peInstrumentId;

      // Live mode: place actual orders
      if (state.mode === 'live' && adapter) {
        const qty = lotSize * CONFIG.lots;
        const result = await adapter.placeOrder({
          instrumentId,
          transactionType: template.action,
          quantity: qty,
        });
        if (!result) {
          console.error(`[Live/${adapter.brokerName}] Order failed for ${template.side} ${template.action} at ${strike}`);
          return;
        }
        orderId = result.orderId;
      }
    } else {
      // No adapter: estimate via BS model
      premium = estimateAtmPremium(spot, dte, iv);
    }

    if (template.action === 'SELL') totalSellPremium += premium;
    else totalBuyPremium += premium;

    legs.push({
      side: template.side,
      action: template.action,
      strikePrice: strike,
      instrumentId,
      orderId,
      entryPremium: round2(premium),
    });
  }

  const totalCollected = round2(totalSellPremium - totalBuyPremium);
  const margin = estimateStrategyMargin(spot, lotSize, CONFIG.lots, totalCollected, stratConfig.marginFactor);
  const now = new Date().toISOString();
  const tradeDate = getTodayIST();

  // Build trade object — include legacy ce/pe fields for backward compat
  const tradeData: any = {
    tradeDate,
    strategyType,
    indexName: index,
    mode: state.mode,
    broker: state.broker,
    entryTime: now,
    niftyEntry: spot,
    legs,
    totalCollected,
    lotSize,
    lots: CONFIG.lots,
    marginRequired: round2(margin.totalMargin),
    premiumOffset: round2(margin.premiumOffset),
    netMarginRequired: round2(margin.netMargin),
  };

  // Legacy 2-leg compat: populate ce/pe fields
  if (legs.length >= 2) {
    const ceLeg = legs.find(l => l.side === 'CE' && l.action === 'SELL');
    const peLeg = legs.find(l => l.side === 'PE' && l.action === 'SELL');
    if (ceLeg) {
      tradeData.ceStrike = ceLeg.strikePrice;
      tradeData.ceEntryPremium = ceLeg.entryPremium;
      tradeData.ceInstrumentId = ceLeg.instrumentId;
      tradeData.ceOrderId = ceLeg.orderId;
      if (adapter?.brokerName === 'dhan' && ceLeg.instrumentId) {
        tradeData.ceSecurityId = Number(ceLeg.instrumentId);
      }
    }
    if (peLeg) {
      tradeData.peStrike = peLeg.strikePrice;
      tradeData.peEntryPremium = peLeg.entryPremium;
      tradeData.peInstrumentId = peLeg.instrumentId;
      tradeData.peOrderId = peLeg.orderId;
      if (adapter?.brokerName === 'dhan' && peLeg.instrumentId) {
        tradeData.peSecurityId = Number(peLeg.instrumentId);
      }
    }
  }

  const id = await insertOpenTrade(tradeData, userId);

  // Persist leg premiums and deltas in engine state
  state.legPremiums = legs.map(l => l.entryPremium);
  state.legDeltas = legs.map(l => computeDelta(spot, l.strikePrice, l.side, dte, iv));
  state.dailyTradeCount = (state.dailyTradeCount || 0) + 1;

  // Legacy 2-leg state compat
  if (legs.length >= 2) {
    const ceLeg = legs.find(l => l.side === 'CE');
    const peLeg = legs.find(l => l.side === 'PE');
    state.ceCurPremium = ceLeg?.entryPremium;
    state.peCurPremium = peLeg?.entryPremium;
    state.ceDelta = ceLeg ? computeDelta(spot, ceLeg.strikePrice, 'CE', dte, iv) : undefined;
    state.peDelta = peLeg ? computeDelta(spot, peLeg.strikePrice, 'PE', dte, iv) : undefined;
  }

  console.log(
    `[${state.mode}/${state.broker}] Opened ${strategyType} on ${index}: id=${id} Spot=${spot} ` +
    `Legs=${legs.map(l => `${l.action} ${l.side}@${l.strikePrice}=${l.entryPremium}`).join(', ')} ` +
    `Net=${totalCollected} DTE=${dte}`,
  );
}

async function updateLegPremiums(
  state: EngineState,
  trade: StraddleTrade,
  barChange: number,
  minutesSinceOpen: number,
  adapter: BrokerAdapter | null | undefined,
  index: IndexName,
): Promise<void> {
  const dte = estimateDte();
  const iv = CONFIG.iv;
  const spot = state.lastSpot!;
  const legs = trade.legs || [];

  let premiumsUpdated = false;

  if (adapter && legs.length > 0) {
    // Fetch real premiums from option chain (REST API)
    try {
      const expiry = await adapter.getNearestExpiry(index);
      if (expiry) {
        const chain = await adapter.getOptionChain(index, expiry);
        // Only use chain if every leg's strike is found with a valid LTP
        const premiums: number[] = [];
        const deltas: number[] = [];
        let allFound = chain.length > 0;

        for (const leg of legs) {
          const strikeData = chain.find(s => s.strikePrice === leg.strikePrice);
          const ltp = strikeData ? (leg.side === 'CE' ? strikeData.ceLtp : strikeData.peLtp) : 0;
          if (!ltp) { allFound = false; break; }
          premiums.push(ltp);
          deltas.push(computeDelta(spot, leg.strikePrice, leg.side, dte, iv));
        }

        if (allFound && premiums.length === legs.length) {
          state.legPremiums = premiums;
          state.legDeltas = deltas;
          premiumsUpdated = true;

          // Legacy 2-leg compat
          if (legs.length >= 2) {
            const ceIdx = legs.findIndex(l => l.side === 'CE');
            const peIdx = legs.findIndex(l => l.side === 'PE');
            if (ceIdx >= 0) { state.ceCurPremium = premiums[ceIdx]; state.ceDelta = deltas[ceIdx]; }
            if (peIdx >= 0) { state.peCurPremium = premiums[peIdx]; state.peDelta = deltas[peIdx]; }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[Engine] Option chain fetch failed, falling back to BS model: ${err.message}`);
    }
  }

  if (!premiumsUpdated && legs.length > 0) {
    // BS model fallback: adapter unavailable, REST call failed, or chain had missing strikes
    const premiums = state.legPremiums || legs.map(l => l.entryPremium);
    const updatedPremiums: number[] = [];
    const updatedDeltas: number[] = [];

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const curPremium = premiums[i] || leg.entryPremium;
      const delta = computeDelta(spot, leg.strikePrice, leg.side, dte, iv);
      const newPremium = updatePremium(curPremium, barChange, leg.side, delta, dte, 3, minutesSinceOpen);
      updatedPremiums.push(newPremium);
      updatedDeltas.push(delta);
    }

    state.legPremiums = updatedPremiums;
    state.legDeltas = updatedDeltas;

    // Legacy 2-leg compat
    if (legs.length >= 2) {
      const ceIdx = legs.findIndex(l => l.side === 'CE');
      const peIdx = legs.findIndex(l => l.side === 'PE');
      if (ceIdx >= 0) { state.ceCurPremium = updatedPremiums[ceIdx]; state.ceDelta = updatedDeltas[ceIdx]; }
      if (peIdx >= 0) { state.peCurPremium = updatedPremiums[peIdx]; state.peDelta = updatedDeltas[peIdx]; }
    }
  }
}

function checkExitConditions(
  state: EngineState,
  trade: StraddleTrade,
  market: MarketStatus,
  strategyType: StrategyType,
): string | null {
  const stratConfig = getStrategyConfig(strategyType);
  const legs = trade.legs || [];
  const premiums = state.legPremiums || legs.map(l => l.entryPremium);

  if (legs.length === 0 || premiums.length !== legs.length) return null;

  // Compute total entry and current premium for SELL legs
  let totalEntryPremium = 0;
  let totalCurrentPremium = 0;
  for (let i = 0; i < legs.length; i++) {
    if (legs[i].action === 'SELL') {
      totalEntryPremium += legs[i].entryPremium;
      totalCurrentPremium += premiums[i];
    } else {
      totalEntryPremium -= legs[i].entryPremium;
      totalCurrentPremium -= premiums[i];
    }
  }

  if (totalEntryPremium <= 0) return null;

  // Per-leg SL check (only for SELL legs)
  if (stratConfig.exitRules.perLegSlPct != null) {
    for (let i = 0; i < legs.length; i++) {
      if (legs[i].action !== 'SELL') continue;
      const entry = legs[i].entryPremium;
      if (entry > 0) {
        const incrPct = ((premiums[i] - entry) / entry) * 100;
        if (incrPct >= stratConfig.exitRules.perLegSlPct) {
          return `sl_${legs[i].side.toLowerCase()}`;
        }
      }
    }
  }

  // Combined SL
  const combinedLossPct = ((totalCurrentPremium - totalEntryPremium) / Math.abs(totalEntryPremium)) * 100;
  if (combinedLossPct >= stratConfig.exitRules.combinedSlPct) return 'sl_combined';

  // Profit target
  const combinedProfitPct = ((totalEntryPremium - totalCurrentPremium) / Math.abs(totalEntryPremium)) * 100;
  if (combinedProfitPct >= stratConfig.exitRules.profitTargetPct) return 'tp';

  // Time exit
  if (isPastExitTime(market)) return 'time';

  return null;
}

async function closePosition(
  trade: StraddleTrade,
  state: EngineState,
  exitReason: string,
  userId: string | undefined,
  adapter: BrokerAdapter | null | undefined,
): Promise<void> {
  const spot = state.lastSpot ?? trade.niftyEntry;
  const index: IndexName = state.indexName || trade.indexName || 'NIFTY';
  const legs = trade.legs || [];
  const qty = trade.lotSize * trade.lots;
  const now = new Date().toISOString();

  const currentPremiums = state.legPremiums || legs.map(l => l.entryPremium);

  // Fetch real exit premiums and place exit orders
  if (adapter && legs.length > 0) {
    const expiry = await adapter.getNearestExpiry(index);
    if (expiry) {
      const chain = await adapter.getOptionChain(index, expiry);
      for (let i = 0; i < legs.length; i++) {
        const strikeData = chain.find(s => s.strikePrice === legs[i].strikePrice);
        if (strikeData) {
          currentPremiums[i] = legs[i].side === 'CE' ? strikeData.ceLtp : strikeData.peLtp;
          const instrumentId = legs[i].side === 'CE' ? strikeData.ceInstrumentId : strikeData.peInstrumentId;

          if (state.mode === 'live') {
            const exitAction = legs[i].action === 'SELL' ? 'BUY' : 'SELL';
            const result = await adapter.placeOrder({
              instrumentId,
              transactionType: exitAction,
              quantity: qty,
            });
            if (result) legs[i].exitOrderId = result.orderId;
          }
        }
        legs[i].exitPremium = round2(currentPremiums[i]);
      }
    }
  } else {
    for (let i = 0; i < legs.length; i++) {
      legs[i].exitPremium = round2(currentPremiums[i]);
    }
  }

  // Calculate P&L
  let grossPnl = 0;
  let totalAtExit = 0;
  for (let i = 0; i < legs.length; i++) {
    const exitPremium = currentPremiums[i];
    if (legs[i].action === 'SELL') {
      grossPnl += (legs[i].entryPremium - exitPremium) * qty;
      totalAtExit += exitPremium;
    } else {
      grossPnl += (exitPremium - legs[i].entryPremium) * qty;
      totalAtExit -= exitPremium;
    }
  }
  const netPnl = grossPnl - CONFIG.brokerage;

  const exitData: any = {
    exitTime: now,
    niftyExit: spot,
    totalAtExit: round2(totalAtExit),
    grossPnl: round2(grossPnl),
    netPnl: round2(netPnl),
    exitReason,
    legs,
  };

  // Legacy 2-leg compat
  if (legs.length >= 2) {
    const ceLeg = legs.find(l => l.side === 'CE');
    const peLeg = legs.find(l => l.side === 'PE');
    exitData.ceExitPremium = ceLeg?.exitPremium;
    exitData.peExitPremium = peLeg?.exitPremium;
    exitData.ceExitOrderId = ceLeg?.exitOrderId;
    exitData.peExitOrderId = peLeg?.exitOrderId;
  }

  await closeTrade(trade.id, exitData, userId);

  state.legPremiums = undefined;
  state.legDeltas = undefined;
  state.ceCurPremium = undefined;
  state.peCurPremium = undefined;
  state.ceDelta = undefined;
  state.peDelta = undefined;
  state.lastExitTime = now;

  console.log(
    `[${state.mode}/${state.broker}] Closed ${state.strategyType} on ${index}: reason=${exitReason} ` +
    `grossPnl=${round2(grossPnl)} netPnl=${round2(netPnl)} ` +
    `Legs=${legs.map(l => `${l.side}@${l.strikePrice}: ${l.entryPremium}→${l.exitPremium}`).join(', ')}`,
  );
}

// ── Helpers ──────────────────────────────────────────────────

function estimateDte(): number {
  const now = new Date();
  const istStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const ist = new Date(istStr);
  const day = ist.getDay();
  const daysAhead = (4 - day + 7) % 7; // Thursday expiry
  if (daysAhead === 0) return 0.5;
  let tradingDays = 0;
  for (let i = 1; i <= daysAhead; i++) {
    const d = (day + i) % 7;
    if (d !== 0 && d !== 6) tradingDays++;
  }
  return Math.max(tradingDays, 0.5);
}

function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Get last N exit reasons from recent trades for autonomous strategy selection */
async function getRecentExitReasons(userId?: string): Promise<string[]> {
  try {
    const { getTradeHistory } = await import('./straddle-store.js');
    const trades = await getTradeHistory(undefined, undefined, userId);
    return trades
      .filter((t: any) => t.exitReason)
      .slice(0, 5)
      .map((t: any) => t.exitReason);
  } catch {
    return [];
  }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
