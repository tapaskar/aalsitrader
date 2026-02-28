/**
 * Motilal Oswal (MOTS) adapter for the Nifty Straddle engine.
 * REST: MOTS API v1
 * Auth: TOTP-based login → JWT session
 *
 * Credential fields:
 * - clientId: MOTS client code
 * - password: Login password
 * - totpSecret: Base32 TOTP secret for 2FA
 * - apiSecret: MOTS API key/secret
 */

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

const MOTS_BASE = 'https://openapi.motilaloswal.com/rest';
const MOTS_WS = 'wss://openapi.motilaloswal.com/ws';

export interface MotilalCredentials {
  clientId: string;
  password: string;
  totpSecret: string;
  apiSecret: string;
}

export class MotilalAdapter implements BrokerAdapter {
  readonly brokerName: BrokerName = 'motilal';
  private creds: MotilalCredentials;
  private sessionToken: string | null = null;
  private sessionExpiry = 0;

  constructor(creds: MotilalCredentials) {
    this.creds = creds;
  }

  private async ensureSession(): Promise<boolean> {
    if (this.sessionToken && Date.now() < this.sessionExpiry) return true;
    return this.login();
  }

  private async login(): Promise<boolean> {
    try {
      const totp = await this.generateTOTP();
      const res = await fetch(`${MOTS_BASE}/login/v4/authtwofa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': this.creds.apiSecret },
        body: JSON.stringify({
          clientcode: this.creds.clientId,
          password: this.creds.password,
          totp,
        }),
      });

      if (!res.ok) {
        console.error('[Motilal] Login failed:', res.status);
        return false;
      }

      const data = await res.json();
      if (data.status === 'SUCCESS' || data.status === 'Ok') {
        this.sessionToken = data.data?.jwtToken || data.AuthToken || null;
        // Sessions typically last until end of day
        this.sessionExpiry = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
        console.log('[Motilal] Login successful');
        return true;
      }
      console.error('[Motilal] Login response:', data);
      return false;
    } catch (e: any) {
      console.error('[Motilal] Login error:', e.message);
      return false;
    }
  }

  private async generateTOTP(): Promise<string> {
    // Dynamic import of otplib to avoid bundling issues when not installed
    try {
      const { authenticator } = await import('otplib');
      return authenticator.generate(this.creds.totpSecret);
    } catch {
      // Fallback: manual TOTP generation
      return this.manualTOTP(this.creds.totpSecret);
    }
  }

  private manualTOTP(secret: string): string {
    // Basic TOTP implementation (RFC 6238) for environments without otplib
    const crypto = require('crypto');
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const decoded: number[] = [];
    let bits = '';
    for (const c of secret.toUpperCase().replace(/=+$/, '')) {
      const val = base32chars.indexOf(c);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      decoded.push(parseInt(bits.slice(i, i + 8), 2));
    }
    const key = Buffer.from(decoded);
    const time = Math.floor(Date.now() / 30000);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(time));
    const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1000000;
    return String(code).padStart(6, '0');
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'apikey': this.creds.apiSecret,
      'Authorization': `Bearer ${this.sessionToken}`,
    };
  }

  async checkConnectivity(): Promise<ConnectivityResult> {
    if (!this.creds.clientId || !this.creds.totpSecret) {
      return { connected: false, error: 'Motilal credentials not configured' };
    }
    const ok = await this.ensureSession();
    if (!ok) return { connected: false, error: 'Login failed' };
    return { connected: true, error: null };
  }

  // ── Index-parameterized methods ──────────────────────────────

  async getSpotPrice(index: IndexName): Promise<{ price: number; timestamp: Date } | null> {
    if (!(await this.ensureSession())) return null;
    const config = getIndexConfig(index);
    const token = config.brokerTokens.motilal.spotId;
    try {
      const res = await fetch(`${MOTS_BASE}/market/v1/getquote`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ exchange: 'NSE', symboltoken: token }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const ltp = data?.data?.ltp || data?.data?.last_price;
      if (!ltp) return null;
      return { price: parseFloat(ltp), timestamp: new Date() };
    } catch (e: any) {
      console.error(`[Motilal] getSpotPrice(${index}) error:`, e.message);
      return null;
    }
  }

  async getNearestExpiry(index: IndexName): Promise<string | null> {
    if (!(await this.ensureSession())) return null;
    const symbolName = getIndexConfig(index).brokerTokens.motilal.symbolName;
    try {
      const res = await fetch(`${MOTS_BASE}/market/v1/getexpirydate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ exchange: 'NFO', symbolname: symbolName }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const expiries: string[] = data?.data || [];
      if (expiries.length === 0) return null;
      return expiries[0];
    } catch (e: any) {
      console.error(`[Motilal] getNearestExpiry(${index}) error:`, e.message);
      return null;
    }
  }

  async getOptionChain(index: IndexName, expiry: string): Promise<OptionChainStrike[]> {
    if (!(await this.ensureSession())) return [];
    const symbolName = getIndexConfig(index).brokerTokens.motilal.symbolName;
    try {
      const res = await fetch(`${MOTS_BASE}/market/v1/getoptionchain`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ exchange: 'NFO', symbolname: symbolName, expirydate: expiry }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const chain = data?.data || [];
      const result: OptionChainStrike[] = [];
      for (const strike of chain) {
        result.push({
          strikePrice: parseFloat(strike.strikeprice || strike.strike_price || 0),
          ceInstrumentId: String(strike.ce_symboltoken || strike.ce_token || ''),
          peInstrumentId: String(strike.pe_symboltoken || strike.pe_token || ''),
          ceLtp: parseFloat(strike.ce_ltp || 0),
          peLtp: parseFloat(strike.pe_ltp || 0),
          ceOi: parseInt(strike.ce_openinterest || '0', 10),
          peOi: parseInt(strike.pe_openinterest || '0', 10),
        });
      }
      return result;
    } catch (e: any) {
      console.error(`[Motilal] getOptionChain(${index}) error:`, e.message);
      return [];
    }
  }

  getIndexSubscription(index: IndexName): MarketFeedSubscription {
    const config = getIndexConfig(index);
    return { instrumentId: config.brokerTokens.motilal.spotId, segment: config.brokerTokens.motilal.spotSegment };
  }

  async getNiftySpot(): Promise<{ price: number; timestamp: Date } | null> {
    return this.getSpotPrice('NIFTY');
  }

  async placeOrder(params: OrderParams): Promise<OrderResult | null> {
    if (!(await this.ensureSession())) return null;
    try {
      const res = await fetch(`${MOTS_BASE}/order/v1/placeorder`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          variety: 'NORMAL',
          tradingsymbol: params.instrumentId,
          symboltoken: params.instrumentId,
          transactiontype: params.transactionType,
          exchange: 'NFO',
          ordertype: params.orderType || 'MARKET',
          producttype: 'INTRADAY',
          duration: 'DAY',
          quantity: String(params.quantity),
          price: String(params.price || 0),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'SUCCESS') {
        console.error('[Motilal] placeOrder error:', data);
        return null;
      }
      return { orderId: data.data?.orderid || '', orderStatus: 'PLACED' };
    } catch (e: any) {
      console.error('[Motilal] placeOrder exception:', e.message);
      return null;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    if (!(await this.ensureSession())) return null;
    try {
      const res = await fetch(`${MOTS_BASE}/order/v1/getorderbook`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const orders = data?.data || [];
      return orders.find((o: any) => o.orderid === orderId) || null;
    } catch (e: any) {
      console.error('[Motilal] getOrderStatus error:', e.message);
      return null;
    }
  }

  async getPositions(): Promise<any[]> {
    if (!(await this.ensureSession())) return [];
    try {
      const res = await fetch(`${MOTS_BASE}/order/v1/getposition`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data?.data || [];
    } catch (e: any) {
      console.error('[Motilal] getPositions error:', e.message);
      return [];
    }
  }

  createMarketFeed(): BrokerMarketFeed {
    return new MotilalMarketFeedAdapter(this.creds.apiSecret, this.sessionToken || '', this.creds.clientId);
  }

  getNiftyIndexSubscription(): MarketFeedSubscription {
    return this.getIndexSubscription('NIFTY');
  }

  getOptionLegSubscription(instrumentId: string): MarketFeedSubscription {
    return { instrumentId, segment: 'NFO' };
  }
}

// ── Motilal WebSocket Market Feed ────────────────────────────

class MotilalMarketFeedAdapter implements BrokerMarketFeed {
  private apiKey: string;
  private sessionToken: string;
  private clientId: string;
  private ws: WebSocket | null = null;
  private tickCallbacks: ((tick: { instrumentId: string; ltp: number }) => void)[] = [];
  private statusCallbacks: ((s: 'connected' | 'disconnected' | 'reconnecting') => void)[] = [];
  private subscribedTokens: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnects = 20;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(apiKey: string, sessionToken: string, clientId: string) {
    this.apiKey = apiKey;
    this.sessionToken = sessionToken;
    this.clientId = clientId;
  }

  async connect(): Promise<void> {
    if (this.closed) return;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(MOTS_WS);

      const timeout = setTimeout(() => {
        reject(new Error('Motilal WS connection timeout'));
        this.ws?.close();
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;

        // Authenticate
        this.ws!.send(JSON.stringify({
          task: 'cn',
          channel: '',
          token: this.sessionToken,
          user: this.clientId,
          acctid: this.clientId,
        }));

        console.log('[MotilalWS] Connected, authenticating...');
        this.emitStatus('connected');

        // Re-subscribe
        if (this.subscribedTokens.size > 0) {
          this.sendSubscribe(Array.from(this.subscribedTokens));
        }
        resolve();
      });

      this.ws.on('message', (data: Buffer | string) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        clearTimeout(timeout);
        this.emitStatus('disconnected');
        if (!this.closed) this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[MotilalWS] Error:', err.message);
        if (this.reconnectAttempts === 0) reject(err);
      });
    });
  }

  subscribe(subs: MarketFeedSubscription[]): void {
    const tokens = subs.map(s => s.instrumentId);
    for (const t of tokens) this.subscribedTokens.add(t);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(tokens);
    }
  }

  unsubscribe(subs: MarketFeedSubscription[]): void {
    const tokens = subs.map(s => s.instrumentId);
    for (const t of tokens) this.subscribedTokens.delete(t);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        task: 'ud',
        channel: tokens.join('&'),
      }));
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

  private sendSubscribe(tokens: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // MOTS WS subscribe: task=mw (market watch), channel = token list
    this.ws.send(JSON.stringify({
      task: 'mw',
      channel: tokens.join('&'),
      token: this.sessionToken,
      user: this.clientId,
      acctid: this.clientId,
    }));
    console.log(`[MotilalWS] Subscribed to ${tokens.length} tokens`);
  }

  private handleMessage(raw: string): void {
    try {
      const data = JSON.parse(raw);
      // MOTS tick format: { tk: "symboltoken", lp: "last_price", ... }
      if (data.tk && data.lp) {
        this.emitTick({
          instrumentId: String(data.tk),
          ltp: parseFloat(data.lp),
        });
      }
    } catch {
      // Non-JSON or parse error — skip
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
