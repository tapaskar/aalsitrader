/**
 * Upstox v2 adapter for the Nifty Straddle engine.
 * REST: Upstox v2 API
 * Market feed: REST polling (30s interval) — skips Protobuf WS complexity
 * Auth: OAuth2 access_token (valid ~1 day, user provides manually)
 *
 * Credential fields:
 * - apiKey: Upstox app API key
 * - apiSecret: Upstox app API secret
 * - accessToken: OAuth2 access token (user refreshes daily)
 */

import type {
  BrokerAdapter,
  BrokerMarketFeed,
  BrokerName,
  ConnectivityResult,
  MarketFeedSubscription,
  OptionChainStrike,
  OrderParams,
  OrderResult,
} from '../broker-adapter.js';
import { type IndexName, getIndexConfig } from '../index-config.js';

const UPSTOX_BASE = 'https://api.upstox.com/v2';

export interface UpstoxCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
}

export class UpstoxAdapter implements BrokerAdapter {
  readonly brokerName: BrokerName = 'upstox';
  private creds: UpstoxCredentials;

  constructor(creds: UpstoxCredentials) {
    this.creds = creds;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.creds.accessToken}`,
    };
  }

  async checkConnectivity(): Promise<ConnectivityResult> {
    if (!this.creds.accessToken) {
      return { connected: false, error: 'Upstox access token not configured' };
    }
    try {
      const res = await fetch(`${UPSTOX_BASE}/user/fund-margin`, {
        headers: this.getHeaders(),
      });
      if (res.ok) return { connected: true, error: null };
      const data = await res.json().catch(() => ({}));
      return { connected: false, error: `HTTP ${res.status}: ${data.message || res.statusText}` };
    } catch (e: any) {
      return { connected: false, error: e.message };
    }
  }

  // ── Index-parameterized methods ──────────────────────────────

  async getSpotPrice(index: IndexName): Promise<{ price: number; timestamp: Date } | null> {
    const instrumentKey = getIndexConfig(index).brokerTokens.upstox.spotId;
    try {
      const res = await fetch(
        `${UPSTOX_BASE}/market-quote/ltp?instrument_key=${encodeURIComponent(instrumentKey)}`,
        { headers: this.getHeaders() },
      );
      if (!res.ok) return null;
      const data = await res.json();
      const quote = data?.data?.[instrumentKey];
      if (!quote) return null;
      return { price: quote.last_price, timestamp: new Date() };
    } catch (e: any) {
      console.error(`[Upstox] getSpotPrice(${index}) error:`, e.message);
      return null;
    }
  }

  async getNearestExpiry(index: IndexName): Promise<string | null> {
    const instrumentKey = getIndexConfig(index).brokerTokens.upstox.spotId;
    try {
      const res = await fetch(
        `${UPSTOX_BASE}/option/contract?instrument_key=${encodeURIComponent(instrumentKey)}`,
        { headers: this.getHeaders() },
      );
      if (!res.ok) return null;
      const data = await res.json();
      const contracts = data?.data;
      if (!Array.isArray(contracts) || contracts.length === 0) return null;
      const today = new Date().toISOString().slice(0, 10);
      const expiries = [...new Set(
        contracts.map((c: any) => c.expiry).filter((e: string) => e >= today),
      )].sort();
      return expiries[0] || null;
    } catch (e: any) {
      console.error(`[Upstox] getNearestExpiry(${index}) error:`, e.message);
      return null;
    }
  }

  async getOptionChain(index: IndexName, expiry: string): Promise<OptionChainStrike[]> {
    const instrumentKey = getIndexConfig(index).brokerTokens.upstox.spotId;
    try {
      const res = await fetch(
        `${UPSTOX_BASE}/option/chain?instrument_key=${encodeURIComponent(instrumentKey)}&expiry_date=${expiry}`,
        { headers: this.getHeaders() },
      );
      if (!res.ok) return [];
      const data = await res.json();
      const chain = data?.data;
      if (!Array.isArray(chain)) return [];
      const result: OptionChainStrike[] = [];
      for (const strike of chain) {
        const ce = strike.call_options;
        const pe = strike.put_options;
        if (!ce || !pe) continue;
        result.push({
          strikePrice: parseFloat(strike.strike_price || 0),
          ceInstrumentId: ce.instrument_key || '',
          peInstrumentId: pe.instrument_key || '',
          ceLtp: parseFloat(ce.market_data?.ltp || 0),
          peLtp: parseFloat(pe.market_data?.ltp || 0),
          ceOi: parseInt(ce.market_data?.oi || '0', 10),
          peOi: parseInt(pe.market_data?.oi || '0', 10),
        });
      }
      return result;
    } catch (e: any) {
      console.error(`[Upstox] getOptionChain(${index}) error:`, e.message);
      return [];
    }
  }

  getIndexSubscription(index: IndexName): MarketFeedSubscription {
    const config = getIndexConfig(index);
    return { instrumentId: config.brokerTokens.upstox.spotId, segment: config.brokerTokens.upstox.spotSegment };
  }

  async getNiftySpot(): Promise<{ price: number; timestamp: Date } | null> {
    return this.getSpotPrice('NIFTY');
  }

  async placeOrder(params: OrderParams): Promise<OrderResult | null> {
    try {
      const res = await fetch(`${UPSTOX_BASE}/order/place`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          instrument_token: params.instrumentId,
          transaction_type: params.transactionType,
          quantity: params.quantity,
          order_type: params.orderType || 'MARKET',
          product: 'I', // Intraday
          validity: 'DAY',
          ...(params.price ? { price: params.price } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('[Upstox] placeOrder error:', data);
        return null;
      }
      return { orderId: data.data?.order_id || '', orderStatus: 'PLACED' };
    } catch (e: any) {
      console.error('[Upstox] placeOrder exception:', e.message);
      return null;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      const res = await fetch(
        `${UPSTOX_BASE}/order/details?order_id=${orderId}`,
        { headers: this.getHeaders() },
      );
      if (!res.ok) return null;
      return res.json();
    } catch (e: any) {
      console.error('[Upstox] getOrderStatus error:', e.message);
      return null;
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      const res = await fetch(`${UPSTOX_BASE}/portfolio/short-term-positions`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data?.data || [];
    } catch (e: any) {
      console.error('[Upstox] getPositions error:', e.message);
      return [];
    }
  }

  createMarketFeed(): BrokerMarketFeed {
    return new UpstoxPollingFeed(this.creds.accessToken);
  }

  getNiftyIndexSubscription(): MarketFeedSubscription {
    return this.getIndexSubscription('NIFTY');
  }

  getOptionLegSubscription(instrumentId: string): MarketFeedSubscription {
    return { instrumentId, segment: 'NSE_FO' };
  }
}

// ── Upstox REST Polling Market Feed ──────────────────────────

/**
 * REST-based polling feed for Upstox.
 * Polls LTP every 30s instead of using Protobuf WebSocket (which adds
 * significant complexity with minimal benefit for straddle monitoring).
 */
class UpstoxPollingFeed implements BrokerMarketFeed {
  private accessToken: string;
  private tickCallbacks: ((tick: { instrumentId: string; ltp: number }) => void)[] = [];
  private statusCallbacks: ((s: 'connected' | 'disconnected' | 'reconnecting') => void)[] = [];
  private subscribedKeys = new Set<string>();
  private pollTimer: NodeJS.Timeout | null = null;
  private _isConnected = false;
  private closed = false;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async connect(): Promise<void> {
    if (this.closed) return;
    this._isConnected = true;
    this.emitStatus('connected');
    this.startPolling();
  }

  subscribe(subs: MarketFeedSubscription[]): void {
    for (const s of subs) {
      this.subscribedKeys.add(s.instrumentId);
    }
  }

  unsubscribe(subs: MarketFeedSubscription[]): void {
    for (const s of subs) {
      this.subscribedKeys.delete(s.instrumentId);
    }
  }

  onTick(cb: (tick: { instrumentId: string; ltp: number }) => void): void {
    this.tickCallbacks.push(cb);
  }

  onStatus(cb: (s: 'connected' | 'disconnected' | 'reconnecting') => void): void {
    this.statusCallbacks.push(cb);
  }

  close(): void {
    this.closed = true;
    this._isConnected = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.subscribedKeys.clear();
    this.tickCallbacks = [];
    this.statusCallbacks = [];
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  private startPolling(): void {
    // Poll immediately, then every 30s
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), 30_000);
  }

  private async poll(): Promise<void> {
    if (this.closed || this.subscribedKeys.size === 0) return;

    try {
      const keys = Array.from(this.subscribedKeys);
      const qs = keys.map(k => `instrument_key=${encodeURIComponent(k)}`).join('&');
      const res = await fetch(`${UPSTOX_BASE}/market-quote/ltp?${qs}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          this._isConnected = false;
          this.emitStatus('disconnected');
        }
        return;
      }

      const data = await res.json();
      const quotes = data?.data || {};

      for (const [key, val] of Object.entries(quotes)) {
        const ltp = (val as any)?.last_price;
        if (ltp && ltp > 0) {
          this.emitTick({ instrumentId: key, ltp });
        }
      }
    } catch (e: any) {
      console.error('[UpstoxPoll] Poll error:', e.message);
    }
  }

  private emitTick(tick: { instrumentId: string; ltp: number }): void {
    for (const cb of this.tickCallbacks) {
      try { cb(tick); } catch {}
    }
  }

  private emitStatus(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    for (const cb of this.statusCallbacks) {
      try { cb(status); } catch {}
    }
  }
}
