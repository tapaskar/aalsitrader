/**
 * Zerodha Kite Connect adapter for the Nifty Straddle engine.
 * REST: Kite Connect v3 API
 * WebSocket: Kite Ticker (binary protocol)
 *
 * Access token is retrieved from the zerodha-token-manager Lambda.
 * Instrument list is downloaded from Kite and cached in memory.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import WebSocket from 'ws';
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

const KITE_BASE = 'https://api.kite.trade';
const KITE_WS = 'wss://ws.kite.trade';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const lambdaClient = new LambdaClient({ region: REGION });
const ssmClient = new SSMClient({ region: 'us-east-1' });

export interface ZerodhaCredentials {
  apiKey: string;
  apiSecret: string;
}

interface KiteInstrument {
  instrument_token: number;
  exchange_token: number;
  tradingsymbol: string;
  name: string;
  expiry: string;
  strike: number;
  instrument_type: string; // CE, PE, EQ, FUT
  exchange: string;
  segment: string;
  lot_size: number;
}

export class ZerodhaAdapter implements BrokerAdapter {
  readonly brokerName: BrokerName = 'zerodha';
  private apiKey: string;
  private accessToken: string;
  private instruments: KiteInstrument[] = [];
  private instrumentsLoaded = false;

  constructor(creds: ZerodhaCredentials, accessToken: string) {
    this.apiKey = creds.apiKey;
    this.accessToken = accessToken;
  }

  private getHeaders(): Record<string, string> {
    return {
      'X-Kite-Version': '3',
      'Authorization': `token ${this.apiKey}:${this.accessToken}`,
    };
  }

  async checkConnectivity(): Promise<ConnectivityResult> {
    if (!this.accessToken) {
      return { connected: false, error: 'Zerodha access token not available' };
    }
    try {
      const res = await fetch(`${KITE_BASE}/user/margins`, { headers: this.getHeaders() });
      if (res.ok) return { connected: true, error: null };
      const data = await res.json().catch(() => ({}));
      return { connected: false, error: `HTTP ${res.status}: ${data.message || res.statusText}` };
    } catch (e: any) {
      return { connected: false, error: e.message };
    }
  }

  async getSpotPrice(index: IndexName): Promise<{ price: number; timestamp: Date } | null> {
    const config = getIndexConfig(index);
    const displayName = index === 'NIFTY' ? 'NIFTY 50' : 'NIFTY BANK';
    try {
      const res = await fetch(`${KITE_BASE}/quote?i=NSE:${encodeURIComponent(displayName)}`, { headers: this.getHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      const quote = data?.data?.[`NSE:${displayName}`];
      if (!quote) return null;
      return { price: quote.last_price, timestamp: new Date() };
    } catch (e: any) {
      console.error(`[Zerodha] getSpotPrice(${index}) error:`, e.message);
      return null;
    }
  }

  async getNiftySpot(): Promise<{ price: number; timestamp: Date } | null> {
    return this.getSpotPrice('NIFTY');
  }

  async getNearestExpiry(index: IndexName): Promise<string | null> {
    await this.ensureInstrumentsLoaded();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const symbolName = getIndexConfig(index).brokerTokens.zerodha.symbolName;
    const options = this.instruments.filter(
      i => i.name === symbolName && i.segment === 'NFO-OPT' && i.expiry >= today,
    );
    if (options.length === 0) return null;
    const expiries = [...new Set(options.map(i => i.expiry))].sort();
    return expiries[0] || null;
  }

  async getOptionChain(index: IndexName, expiry: string): Promise<OptionChainStrike[]> {
    await this.ensureInstrumentsLoaded();
    const symbolName = getIndexConfig(index).brokerTokens.zerodha.symbolName;
    const options = this.instruments.filter(
      i => i.name === symbolName && i.segment === 'NFO-OPT' && i.expiry === expiry,
    );
    const strikeMap = new Map<number, { ce?: KiteInstrument; pe?: KiteInstrument }>();
    for (const opt of options) {
      if (!strikeMap.has(opt.strike)) strikeMap.set(opt.strike, {});
      const entry = strikeMap.get(opt.strike)!;
      if (opt.instrument_type === 'CE') entry.ce = opt;
      else if (opt.instrument_type === 'PE') entry.pe = opt;
    }
    const symbols = options.map(o => `NFO:${o.tradingsymbol}`);
    const ltpMap = await this.fetchLTPs(symbols);
    const result: OptionChainStrike[] = [];
    for (const [strike, { ce, pe }] of strikeMap) {
      if (!ce || !pe) continue;
      result.push({
        strikePrice: strike,
        ceInstrumentId: ce.tradingsymbol,
        peInstrumentId: pe.tradingsymbol,
        ceLtp: ltpMap.get(`NFO:${ce.tradingsymbol}`) || 0,
        peLtp: ltpMap.get(`NFO:${pe.tradingsymbol}`) || 0,
        ceOi: 0,
        peOi: 0,
      });
    }
    return result;
  }

  async placeOrder(params: OrderParams): Promise<OrderResult | null> {
    try {
      const body = new URLSearchParams({
        tradingsymbol: params.instrumentId,
        exchange: 'NFO',
        transaction_type: params.transactionType,
        order_type: params.orderType || 'MARKET',
        quantity: String(params.quantity),
        product: 'MIS', // Intraday
        validity: 'DAY',
        ...(params.price ? { price: String(params.price) } : {}),
      });

      const res = await fetch(`${KITE_BASE}/orders/regular`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('[Zerodha] placeOrder error:', data);
        return null;
      }
      return { orderId: data.data?.order_id || '', orderStatus: 'PLACED' };
    } catch (e: any) {
      console.error('[Zerodha] placeOrder exception:', e.message);
      return null;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    try {
      const res = await fetch(`${KITE_BASE}/orders/${orderId}`, { headers: this.getHeaders() });
      if (!res.ok) return null;
      return res.json();
    } catch (e: any) {
      console.error('[Zerodha] getOrderStatus error:', e.message);
      return null;
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      const res = await fetch(`${KITE_BASE}/positions`, { headers: this.getHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data?.data?.net || [];
    } catch (e: any) {
      console.error('[Zerodha] getPositions error:', e.message);
      return [];
    }
  }

  createMarketFeed(): BrokerMarketFeed {
    return new KiteTickerAdapter(this.apiKey, this.accessToken, this.instruments);
  }

  getIndexSubscription(index: IndexName): MarketFeedSubscription {
    const config = getIndexConfig(index);
    return { instrumentId: config.brokerTokens.zerodha.spotId, segment: config.brokerTokens.zerodha.spotSegment };
  }

  getNiftyIndexSubscription(): MarketFeedSubscription {
    return this.getIndexSubscription('NIFTY');
  }

  getOptionLegSubscription(instrumentId: string): MarketFeedSubscription {
    // instrumentId is tradingsymbol — look up instrument_token
    const inst = this.instruments.find(i => i.tradingsymbol === instrumentId);
    const token = inst ? String(inst.instrument_token) : instrumentId;
    return { instrumentId: token, segment: 'NFO' };
  }

  // ── Helpers ──────────────────────────────────────────────────

  private async ensureInstrumentsLoaded(): Promise<void> {
    if (this.instrumentsLoaded) return;
    try {
      const res = await fetch(`${KITE_BASE}/instruments/NFO`, { headers: this.getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csv = await res.text();
      this.instruments = this.parseInstrumentCSV(csv);
      this.instrumentsLoaded = true;
      console.log(`[Zerodha] Loaded ${this.instruments.length} NFO instruments`);
    } catch (e: any) {
      console.error('[Zerodha] Failed to load instruments:', e.message);
    }
  }

  private parseInstrumentCSV(csv: string): KiteInstrument[] {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',');
    const result: KiteInstrument[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < headers.length) continue;
      const row: any = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = cols[j];
      }
      // Only keep NIFTY and BANKNIFTY options (much smaller set)
      if (row.name !== 'NIFTY' && row.name !== 'BANKNIFTY') continue;
      result.push({
        instrument_token: parseInt(row.instrument_token, 10),
        exchange_token: parseInt(row.exchange_token, 10),
        tradingsymbol: row.tradingsymbol,
        name: row.name,
        expiry: row.expiry, // YYYY-MM-DD format
        strike: parseFloat(row.strike),
        instrument_type: row.instrument_type,
        exchange: row.exchange,
        segment: row.segment,
        lot_size: parseInt(row.lot_size, 10),
      });
    }
    return result;
  }

  private async fetchLTPs(symbols: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (symbols.length === 0) return map;

    // Kite quote API accepts up to ~500 instruments per call
    const chunks: string[][] = [];
    for (let i = 0; i < symbols.length; i += 400) {
      chunks.push(symbols.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      try {
        const qs = chunk.map(s => `i=${encodeURIComponent(s)}`).join('&');
        const res = await fetch(`${KITE_BASE}/quote/ltp?${qs}`, { headers: this.getHeaders() });
        if (!res.ok) continue;
        const data = await res.json();
        for (const [key, val] of Object.entries(data.data || {})) {
          map.set(key, (val as any).last_price || 0);
        }
      } catch {
        // skip chunk on error
      }
    }
    return map;
  }
}

/**
 * Retrieve Zerodha access token from SSM Parameter Store (us-east-1).
 */
export async function getZerodhaAccessToken(userId: string): Promise<string | null> {
  try {
    const safeEmail = userId.replace('@', '_at_').replace(/\./g, '_');
    const paramName = `/zerodha/users/${safeEmail}/access_token`;
    const result = await ssmClient.send(new GetParameterCommand({
      Name: paramName,
      WithDecryption: true,
    }));
    return result.Parameter?.Value || null;
  } catch (e: any) {
    if (e.name === 'ParameterNotFound') {
      console.warn(`[Zerodha] No access token in SSM for ${userId}`);
      return null;
    }
    console.error('[Zerodha] Failed to get access token:', e.message);
    return null;
  }
}

// ── Kite Ticker WebSocket Adapter ────────────────────────────

/**
 * Kite Ticker binary protocol WebSocket client.
 * Protocol:
 * - Subscribe: JSON message { "a": "subscribe", "v": [token1, token2, ...] }
 * - Mode: JSON message { "a": "mode", "v": ["full", [token1, token2, ...]] }
 * - Ticks: Binary packets, each 44 bytes (quote mode) or 184 bytes (full mode)
 *   Byte 0-3: instrument_token (int32 BE)
 *   Byte 4-7: LTP (int32 BE, divide by 100)
 */
class KiteTickerAdapter implements BrokerMarketFeed {
  private apiKey: string;
  private accessToken: string;
  private instruments: KiteInstrument[];
  private ws: WebSocket | null = null;
  private tickCallbacks: ((tick: { instrumentId: string; ltp: number }) => void)[] = [];
  private statusCallbacks: ((s: 'connected' | 'disconnected' | 'reconnecting') => void)[] = [];
  private subscribedTokens: Set<number> = new Set();
  private tokenToSymbol: Map<number, string> = new Map();
  private reconnectAttempts = 0;
  private maxReconnects = 20;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(apiKey: string, accessToken: string, instruments: KiteInstrument[]) {
    this.apiKey = apiKey;
    this.accessToken = accessToken;
    this.instruments = instruments;
    // Pre-build token → symbol map
    for (const inst of instruments) {
      this.tokenToSymbol.set(inst.instrument_token, inst.tradingsymbol);
    }
    // Also add Nifty 50 and Bank Nifty index tokens
    this.tokenToSymbol.set(256265, 'NIFTY 50');
    this.tokenToSymbol.set(260105, 'NIFTY BANK');
  }

  async connect(): Promise<void> {
    if (this.closed) return;

    return new Promise((resolve, reject) => {
      const url = `${KITE_WS}?api_key=${this.apiKey}&access_token=${this.accessToken}`;
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      const timeout = setTimeout(() => {
        reject(new Error('Kite Ticker connection timeout'));
        this.ws?.close();
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        console.log('[KiteTicker] Connected');
        this.emitStatus('connected');

        // Re-subscribe on reconnect
        if (this.subscribedTokens.size > 0) {
          this.sendSubscribe(Array.from(this.subscribedTokens));
        }
        resolve();
      });

      this.ws.on('message', (data: ArrayBuffer) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        clearTimeout(timeout);
        this.emitStatus('disconnected');
        if (!this.closed) this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[KiteTicker] Error:', err.message);
        if (this.reconnectAttempts === 0) reject(err);
      });
    });
  }

  subscribe(subs: MarketFeedSubscription[]): void {
    const tokens = subs.map(s => Number(s.instrumentId));
    for (const t of tokens) this.subscribedTokens.add(t);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(tokens);
    }
  }

  unsubscribe(subs: MarketFeedSubscription[]): void {
    const tokens = subs.map(s => Number(s.instrumentId));
    for (const t of tokens) this.subscribedTokens.delete(t);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ a: 'unsubscribe', v: tokens }));
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribedTokens.clear();
    this.tickCallbacks = [];
    this.statusCallbacks = [];
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private sendSubscribe(tokens: number[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ a: 'subscribe', v: tokens }));
    // Set quote mode for these tokens
    this.ws.send(JSON.stringify({ a: 'mode', v: ['quote', tokens] }));
    console.log(`[KiteTicker] Subscribed to ${tokens.length} tokens`);
  }

  private handleMessage(data: ArrayBuffer): void {
    const buf = Buffer.from(data);
    // Kite sends JSON for heartbeat and text messages
    if (buf.length < 4) return;

    // Try to detect JSON (heartbeat)
    if (buf[0] === 0x7B) { // '{'
      return; // heartbeat or text — skip
    }

    // Binary: first 2 bytes = number of packets (int16 BE)
    const numPackets = buf.readInt16BE(0);
    let offset = 2;

    for (let i = 0; i < numPackets && offset < buf.length; i++) {
      const packetLen = buf.readInt16BE(offset);
      offset += 2;
      if (offset + packetLen > buf.length) break;

      const packet = buf.subarray(offset, offset + packetLen);
      offset += packetLen;

      if (packet.length >= 8) {
        const token = packet.readInt32BE(0);
        const ltp = packet.readInt32BE(4) / 100;
        const symbol = this.tokenToSymbol.get(token);

        // Emit using instrument_token as instrumentId (matching subscription)
        this.emitTick({ instrumentId: String(token), ltp });
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectAttempts >= this.maxReconnects) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.emitStatus('reconnecting');
    this.reconnectTimer = setTimeout(async () => {
      try { await this.connect(); } catch {}
    }, delay);
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
