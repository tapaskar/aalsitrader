/**
 * UserEngine — lightweight per-user strategy evaluator.
 * No WebSocket of its own — reads tick data from SharedMarketFeed.
 * Has its own BrokerAdapter for order execution (REST API).
 *
 * Flow:
 * 1. Registers as listener on SharedMarketFeed
 * 2. On each tick: routes to index spot or option legs, debounces strategy eval
 * 3. evaluateStrategy() calls runTick() with injected data from shared feed
 * 4. runTick() uses the per-user adapter for order placement (REST API)
 *
 * Supports multi-index (NIFTY/BANKNIFTY) and N-leg positions.
 */

import { runTick, type InjectedTickData } from './straddle-engine.js';
import {
  getEngineState,
  setEngineState,
  getOpenTrade,
  normalizeTrade,
  type EngineState,
  type StraddleTrade,
} from './straddle-store.js';
import type { BrokerAdapter } from './broker-adapter.js';
import { DhanAdapter } from './adapters/dhan-adapter.js';
import type { SharedMarketFeed } from './shared-market-feed.js';
import type { IndexName } from './index-config.js';

const TICK_DEBOUNCE_MS = 500;
const STATE_PERSIST_INTERVAL = 30_000; // 30s
const TOKEN_RENEWAL_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

export class UserEngine {
  userId: string;
  adapter: BrokerAdapter;
  private sharedFeed: SharedMarketFeed;
  private openTrade: StraddleTrade | null = null;
  private currentSpot = 0;
  private indexName: IndexName = 'NIFTY';
  /** N-leg premium tracking (replaces ceCurPremium/peCurPremium) */
  private legPremiums: number[] = [];
  /** Subscribed option leg instrument IDs (N legs) */
  private subscribedLegIds: string[] = [];
  private lastTickEval = 0;
  private persistTimer: NodeJS.Timeout | null = null;
  private tokenRenewalTimer: NodeJS.Timeout | null = null;
  running = false;

  // Bound listener reference for cleanup
  private tickListener: ((instrumentId: string, ltp: number) => void) | null = null;

  // Whether this user's broker matches the shared feed's broker (for option leg subscriptions)
  private sameBrokerAsFeed: boolean;

  constructor(userId: string, adapter: BrokerAdapter, sharedFeed: SharedMarketFeed) {
    this.userId = userId;
    this.adapter = adapter;
    this.sharedFeed = sharedFeed;
    this.sameBrokerAsFeed = adapter.brokerName === sharedFeed.brokerName;
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(`[${this.userId}/${this.adapter.brokerName}] Starting user engine (sameBroker=${this.sameBrokerAsFeed})`);

    // Load current state
    const engineState = await getEngineState(this.userId);
    this.indexName = engineState.indexName || 'NIFTY';
    this.openTrade = await getOpenTrade(this.userId);
    this.currentSpot = engineState.lastSpot || 0;

    // Load persisted leg premiums
    const trade = this.openTrade ? normalizeTrade(this.openTrade) : null;
    const legs = trade?.legs || [];
    if (legs.length > 0 && this.hasLiveLegs(trade)) {
      this.legPremiums = engineState.legPremiums || legs.map(l => l.entryPremium);
    } else if (legs.length > 0) {
      this.legPremiums = [];
      console.log(`[${this.userId}] Paper mode or no live legs: clearing stale premiums, BS model will recalculate`);
    }

    // Schedule periodic token renewal for the per-user adapter (for REST API calls)
    if (this.adapter instanceof DhanAdapter) {
      this.tokenRenewalTimer = setInterval(() => this.renewAdapterToken(), TOKEN_RENEWAL_INTERVAL);
    }

    // Subscribe to option legs on the shared feed (only if same broker)
    this.subscribeToOptionLegs();

    // Register tick listener on shared feed
    this.tickListener = (instrumentId: string, ltp: number) => this.onTick(instrumentId, ltp);
    this.sharedFeed.addListener(this.tickListener);

    // Periodic state persist
    this.persistTimer = setInterval(() => this.persistState(), STATE_PERSIST_INTERVAL);

    console.log(`[${this.userId}] User engine started (index=${this.indexName}, legs=${legs.length})`);
  }

  /** Check if any legs have live instrument IDs (for WS subscription) */
  private hasLiveLegs(trade: StraddleTrade | null): boolean {
    if (!trade) return false;
    const legs = trade.legs || [];
    return legs.some(l => l.instrumentId != null);
  }

  private async renewAdapterToken(): Promise<void> {
    if (!this.running) return;
    if (this.adapter instanceof DhanAdapter) {
      console.log(`[${this.userId}] Periodic adapter token renewal...`);
      const renewed = await this.adapter.renewToken();
      if (!renewed) {
        console.warn(`[${this.userId}] Adapter token renewal failed`);
      }
    }
  }

  private onTick(instrumentId: string, ltp: number): void {
    if (!this.running || ltp <= 0) return;

    // Route tick: index spot price (check the user's configured index)
    const indexInstrumentId = this.sharedFeed.getIndexInstrumentId(this.indexName);
    if (instrumentId === indexInstrumentId) {
      this.currentSpot = ltp;
    }

    // Route tick: option legs (only if same broker as shared feed)
    if (this.sameBrokerAsFeed) {
      for (let i = 0; i < this.subscribedLegIds.length; i++) {
        const legId = this.subscribedLegIds[i];
        if (legId) {
          const legSub = this.adapter.getOptionLegSubscription(legId);
          if (instrumentId === legSub.instrumentId) {
            this.legPremiums[i] = ltp;
          }
        }
      }
    }

    // Debounce strategy evaluation
    const now = Date.now();
    if (now - this.lastTickEval < TICK_DEBOUNCE_MS) return;
    this.lastTickEval = now;

    // Run strategy asynchronously (don't block tick processing)
    this.evaluateStrategy().catch(err => {
      console.error(`[${this.userId}] Strategy error:`, err.message);
    });
  }

  private async evaluateStrategy(): Promise<void> {
    if (!this.running || this.currentSpot === 0) return;

    // Build injected tick data for N-leg support
    const hasLiveLegs = this.sameBrokerAsFeed && this.subscribedLegIds.length > 0 && this.subscribedLegIds.every(id => id != null);
    const validLegPremiums = hasLiveLegs && this.legPremiums.length === this.subscribedLegIds.length && this.legPremiums.every(p => p > 0);

    const injected: InjectedTickData = {
      spot: this.currentSpot,
      legPremiums: validLegPremiums ? [...this.legPremiums] : undefined,
      // Legacy 2-leg compat (for backward-compat with existing straddle-engine code paths)
      niftySpot: this.currentSpot,
    };

    const result = await runTick(this.userId, this.adapter, injected);

    if (result.action === 'opened') {
      this.openTrade = await getOpenTrade(this.userId);
      // Re-read engine state to get the new index/strategy
      const newState = await getEngineState(this.userId);
      this.indexName = newState.indexName || 'NIFTY';
      this.subscribeToOptionLegs();
      console.log(`[${this.userId}] Position opened at ${this.indexName}=${this.currentSpot}`);
    } else if (result.action === 'closed') {
      this.unsubscribeFromOptionLegs();
      this.openTrade = null;
      this.legPremiums = [];
      console.log(`[${this.userId}] Position closed: ${result.details}`);
    }
  }

  private subscribeToOptionLegs(): void {
    if (!this.openTrade || !this.sameBrokerAsFeed) return;

    const trade = normalizeTrade(this.openTrade);
    const legs = trade.legs || [];

    // Unsubscribe old legs first
    this.unsubscribeFromOptionLegs();

    // Subscribe to each leg's instrument
    this.subscribedLegIds = [];
    this.legPremiums = [];
    for (const leg of legs) {
      const instrumentId = leg.instrumentId || null;
      if (instrumentId) {
        this.sharedFeed.subscribeOptionLeg(instrumentId);
        this.subscribedLegIds.push(instrumentId);
        this.legPremiums.push(leg.entryPremium); // Initial premium
      }
    }

    if (this.subscribedLegIds.length > 0) {
      console.log(`[${this.userId}] Subscribed ${this.subscribedLegIds.length} option legs: ${this.subscribedLegIds.join(', ')}`);
    }
  }

  private unsubscribeFromOptionLegs(): void {
    for (const legId of this.subscribedLegIds) {
      if (legId) {
        this.sharedFeed.unsubscribeOptionLeg(legId);
      }
    }
    this.subscribedLegIds = [];
  }

  private async persistState(): Promise<void> {
    if (!this.running) return;
    try {
      const stateUpdate: Partial<EngineState> = {
        lastSpot: this.currentSpot || undefined,
        lastUpdate: new Date().toISOString(),
      };

      // Persist N-leg premiums
      if (this.legPremiums.length > 0) {
        stateUpdate.legPremiums = this.legPremiums;
      }

      // Legacy 2-leg compat
      stateUpdate.lastNiftySpot = this.currentSpot || undefined;
      if (this.legPremiums.length >= 2) {
        stateUpdate.ceCurPremium = this.legPremiums[0] || undefined;
        stateUpdate.peCurPremium = this.legPremiums[1] || undefined;
      }

      await setEngineState(stateUpdate, this.userId);
    } catch (err: any) {
      console.error(`[${this.userId}] Persist state error:`, err.message);
    }
  }

  async stop(): Promise<void> {
    console.log(`[${this.userId}] Stopping user engine`);
    this.running = false;

    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.tokenRenewalTimer) {
      clearInterval(this.tokenRenewalTimer);
      this.tokenRenewalTimer = null;
    }

    // Unsubscribe from shared feed
    this.unsubscribeFromOptionLegs();
    if (this.tickListener) {
      this.sharedFeed.removeListener(this.tickListener);
      this.tickListener = null;
    }

    // Final state persist
    await this.persistState();
    console.log(`[${this.userId}] User engine stopped`);
  }
}
