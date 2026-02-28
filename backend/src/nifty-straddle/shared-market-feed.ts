/**
 * SharedMarketFeed — single WebSocket connection for market data.
 * All users share the same Nifty index spot price feed.
 * Option leg subscriptions are ref-counted (subscribe once, unsubscribe when no user needs it).
 * Tick data is fanned out to all registered UserEngine listeners in-memory (nanosecond latency).
 *
 * If the WS dies, falls back to REST API polling for Nifty spot until WS recovers.
 */

import type { BrokerAdapter, BrokerMarketFeed, MarketFeedSubscription } from './broker-adapter.js';
import { DhanAdapter } from './adapters/dhan-adapter.js';
import type { IndexName } from './index-config.js';

const TOKEN_RENEWAL_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CONNECT_RETRIES = 5;
const REST_POLL_INTERVAL = 30_000; // 30s fallback

export interface PriceEntry {
  ltp: number;
  timestamp: number;
}

type TickListener = (instrumentId: string, ltp: number) => void;

export class SharedMarketFeed {
  private adapter: BrokerAdapter;
  private feed: BrokerMarketFeed | null = null;
  private priceCache = new Map<string, PriceEntry>();
  private listeners: TickListener[] = [];
  private niftySubscription: MarketFeedSubscription;
  /** All index subscriptions (NIFTY, BANKNIFTY, etc.) */
  private indexSubscriptions = new Map<IndexName, MarketFeedSubscription>();
  private optionLegRefs = new Map<string, number>();
  private tickCount = 0;
  private running = false;
  private tokenRenewalTimer: NodeJS.Timeout | null = null;
  private restPollTimer: NodeJS.Timeout | null = null;

  constructor(adapter: BrokerAdapter) {
    this.adapter = adapter;
    this.niftySubscription = adapter.getNiftyIndexSubscription();
    // Pre-populate index subscriptions for all supported indices
    const niftySub = adapter.getIndexSubscription('NIFTY');
    const bnSub = adapter.getIndexSubscription('BANKNIFTY');
    this.indexSubscriptions.set('NIFTY', niftySub);
    this.indexSubscriptions.set('BANKNIFTY', bnSub);
  }

  get brokerName(): string {
    return this.adapter.brokerName;
  }

  get niftyInstrumentId(): string {
    return this.niftySubscription.instrumentId;
  }

  /** Get the instrument ID for a given index */
  getIndexInstrumentId(index: IndexName): string {
    return this.indexSubscriptions.get(index)?.instrumentId || this.niftySubscription.instrumentId;
  }

  getPrice(instrumentId: string): PriceEntry | undefined {
    return this.priceCache.get(instrumentId);
  }

  getNiftySpot(): number {
    return this.priceCache.get(this.niftySubscription.instrumentId)?.ltp || 0;
  }

  /** Get spot price for any supported index */
  getSpotPrice(index: IndexName): number {
    const sub = this.indexSubscriptions.get(index);
    return sub ? (this.priceCache.get(sub.instrumentId)?.ltp || 0) : 0;
  }

  addListener(cb: TickListener): void {
    this.listeners.push(cb);
  }

  removeListener(cb: TickListener): void {
    this.listeners = this.listeners.filter(l => l !== cb);
  }

  async start(): Promise<boolean> {
    this.running = true;
    console.log(`[SharedFeed/${this.adapter.brokerName}] Starting shared market feed`);

    // Renew token before connecting
    if (this.adapter instanceof DhanAdapter) {
      const renewed = await this.adapter.renewToken();
      if (renewed) {
        console.log(`[SharedFeed] DhanHQ token renewed on startup`);
      }
      this.tokenRenewalTimer = setInterval(() => this.renewToken(), TOKEN_RENEWAL_INTERVAL);
    }

    // Connect WS with retry
    if (!await this.connectWithRetry()) {
      // WS failed — start REST polling as fallback
      console.warn(`[SharedFeed] WS connect failed, starting REST polling fallback`);
      this.startRestPolling();
      return true; // Still "started" with REST fallback
    }

    // Subscribe to all index spot prices (Nifty + Bank Nifty)
    const allIndexSubs = Array.from(this.indexSubscriptions.values());
    this.feed!.subscribe(allIndexSubs);
    console.log(`[SharedFeed] Subscribed to indices: ${Array.from(this.indexSubscriptions.entries()).map(([k, v]) => `${k}=${v.instrumentId}`).join(', ')}`);

    // Re-subscribe any option legs that were requested before WS connected
    for (const instrumentId of this.optionLegRefs.keys()) {
      const sub = this.adapter.getOptionLegSubscription(instrumentId);
      this.feed!.subscribe([sub]);
    }

    // Watchdog: check for ticks after 60s
    setTimeout(() => this.startWatchdog(), 60_000);

    return true;
  }

  private async connectWithRetry(): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_CONNECT_RETRIES; attempt++) {
      try {
        this.feed = this.adapter.createMarketFeed();
        this.feed.onTick((tick) => this.onTick(tick));
        this.feed.onStatus((status) => {
          console.log(`[SharedFeed/${this.adapter.brokerName}] WS status: ${status}`);
        });
        await this.feed.connect();
        return true;
      } catch (err: any) {
        console.error(`[SharedFeed] WS connect attempt ${attempt}/${MAX_CONNECT_RETRIES} failed: ${err.message}`);
        if (attempt < MAX_CONNECT_RETRIES) {
          const delay = Math.min(5000 * attempt, 30000);
          console.log(`[SharedFeed] Retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    console.error(`[SharedFeed] WS connect failed after ${MAX_CONNECT_RETRIES} attempts`);
    return false;
  }

  private onTick(tick: { instrumentId: string; ltp: number }): void {
    if (tick.ltp <= 0) return;
    this.tickCount++;
    if (this.tickCount <= 5 || this.tickCount % 500 === 0) {
      console.log(`[SharedFeed] Tick #${this.tickCount}: id=${tick.instrumentId} ltp=${tick.ltp}`);
    }

    // Update price cache
    this.priceCache.set(tick.instrumentId, { ltp: tick.ltp, timestamp: Date.now() });

    // Fan out to all listeners (UserEngines) — in-memory, nanosecond latency
    for (const listener of this.listeners) {
      try {
        listener(tick.instrumentId, tick.ltp);
      } catch (err: any) {
        console.error(`[SharedFeed] Listener error:`, err.message);
      }
    }
  }

  /**
   * Subscribe to an option leg (ref-counted).
   * Multiple users can request the same instrumentId — only subscribes on the WS once.
   */
  subscribeOptionLeg(instrumentId: string): void {
    const count = this.optionLegRefs.get(instrumentId) || 0;
    this.optionLegRefs.set(instrumentId, count + 1);
    if (count === 0 && this.feed) {
      const sub = this.adapter.getOptionLegSubscription(instrumentId);
      this.feed.subscribe([sub]);
      console.log(`[SharedFeed] Subscribed option leg ${instrumentId} (first user)`);
    }
  }

  /**
   * Unsubscribe from an option leg (ref-counted).
   */
  unsubscribeOptionLeg(instrumentId: string): void {
    const count = this.optionLegRefs.get(instrumentId) || 0;
    if (count <= 1) {
      this.optionLegRefs.delete(instrumentId);
      if (this.feed) {
        const sub = this.adapter.getOptionLegSubscription(instrumentId);
        this.feed.unsubscribe([sub]);
        console.log(`[SharedFeed] Unsubscribed option leg ${instrumentId} (no more users)`);
      }
    } else {
      this.optionLegRefs.set(instrumentId, count - 1);
    }
  }

  private async renewToken(): Promise<void> {
    if (!this.running) return;
    if (this.adapter instanceof DhanAdapter) {
      console.log(`[SharedFeed] Periodic token renewal...`);
      const renewed = await this.adapter.renewToken();
      if (!renewed) {
        console.warn(`[SharedFeed] Token renewal failed`);
      }
    }
  }

  private startWatchdog(): void {
    if (!this.running) return;
    if (this.tickCount > 0) {
      console.log(`[SharedFeed] Watchdog: healthy, ${this.tickCount} ticks received`);
      return;
    }

    // No ticks in 60s — WS is dead
    console.warn(`[SharedFeed] Watchdog: 0 ticks in 60s — WS feed dead, starting REST fallback + recovery`);
    this.startRestPolling();
    this.attemptRecovery();
  }

  private startRestPolling(): void {
    if (this.restPollTimer) return; // Already polling
    this.restPollTimer = setInterval(() => this.restPollSpot(), REST_POLL_INTERVAL);
    this.restPollSpot(); // Immediate first poll
  }

  private stopRestPolling(): void {
    if (this.restPollTimer) {
      clearInterval(this.restPollTimer);
      this.restPollTimer = null;
    }
  }

  private async restPollSpot(): Promise<void> {
    if (!this.running) return;
    // Poll all subscribed indices
    for (const [index, sub] of this.indexSubscriptions) {
      try {
        const spot = await this.adapter.getSpotPrice(index);
        if (spot && spot.price > 0) {
          console.log(`[SharedFeed] REST poll: ${index}=${spot.price}`);
          this.onTick({ instrumentId: sub.instrumentId, ltp: spot.price });
        }
      } catch (err: any) {
        console.error(`[SharedFeed] REST poll error (${index}):`, err.message);
      }
    }
  }

  private async attemptRecovery(): Promise<void> {
    if (!this.running) return;
    if (!(this.adapter instanceof DhanAdapter)) return;

    console.log(`[SharedFeed] Attempting WS recovery: renew token + reconnect...`);
    const renewed = await this.adapter.renewToken();
    if (!renewed) {
      console.warn(`[SharedFeed] Recovery: token renewal failed, staying on REST polling`);
      return;
    }

    // Close old dead WS and reconnect
    this.feed?.close();
    if (await this.connectWithRetry()) {
      // Re-subscribe to all indices
      const allIndexSubs = Array.from(this.indexSubscriptions.values());
      this.feed!.subscribe(allIndexSubs);
      // Re-subscribe to all active option legs
      for (const instrumentId of this.optionLegRefs.keys()) {
        const sub = this.adapter.getOptionLegSubscription(instrumentId);
        this.feed!.subscribe([sub]);
      }
      console.log(`[SharedFeed] Recovery: reconnected, resubscribed to ${this.optionLegRefs.size} option legs`);

      // Check if WS recovers after 30s, then stop REST polling
      setTimeout(() => {
        if (this.tickCount > 0 && this.restPollTimer) {
          console.log(`[SharedFeed] WS recovered, stopping REST polling`);
          this.stopRestPolling();
        }
      }, 30_000);
    }
  }

  async stop(): Promise<void> {
    console.log(`[SharedFeed] Stopping (${this.tickCount} total ticks)`);
    this.running = false;
    if (this.tokenRenewalTimer) {
      clearInterval(this.tokenRenewalTimer);
      this.tokenRenewalTimer = null;
    }
    this.stopRestPolling();
    this.feed?.close();
    this.listeners = [];
    this.priceCache.clear();
    this.optionLegRefs.clear();
  }
}
