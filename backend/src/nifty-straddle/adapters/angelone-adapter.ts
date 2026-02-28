/**
 * AngelOne (SmartAPI) adapter for the Nifty Straddle engine.
 * REST: SmartAPI v1
 * WebSocket: SmartStream (binary protocol)
 * Auth: TOTP-based login → JWT (15min) + refreshToken (15 days)
 *
 * Credential fields:
 * - apiKey: SmartAPI app key (X-PrivateKey)
 * - clientId: AngelOne client code
 * - pin: Login PIN
 * - totpSecret: Base32 TOTP secret for 2FA
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

const ANGEL_BASE = 'https://apiconnect.angelone.in';
const ANGEL_WS = 'wss://smartapisocket.angelone.in/smart-stream';

export interface AngelOneCredentials {
  apiKey: string;
  clientId: string;
  pin: string;
  totpSecret: string;
}

export class AngelOneAdapter implements BrokerAdapter {
  readonly brokerName: BrokerName = 'angelone';
  private creds: AngelOneCredentials;
  private jwtToken: string | null = null;
  private refreshToken: string | null = null;
  private feedToken: string | null = null;
  private sessionExpiry = 0;

  constructor(creds: AngelOneCredentials) {
    this.creds = creds;
  }

  private async ensureSession(): Promise<boolean> {
    if (this.jwtToken && Date.now() < this.sessionExpiry) return true;
    // Try refresh first, then full login
    if (this.refreshToken) {
      const refreshed = await this.renewToken();
      if (refreshed) return true;
    }
    return this.login();
  }

  private async login(): Promise<boolean> {
    try {
      const totp = this.generateTOTP();
      const res = await fetch(`${ANGEL_BASE}/rest/auth/angelbroking/user/v1/loginByPassword`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '127.0.0.1',
          'X-ClientPublicIP': '127.0.0.1',
          'X-MACAddress': '00:00:00:00:00:00',
          'X-PrivateKey': this.creds.apiKey,
        },
        body: JSON.stringify({
          clientcode: this.creds.clientId,
          password: this.creds.pin,
          totp,
        }),
      });

      if (!res.ok) {
        console.error('[AngelOne] Login failed:', res.status);
        return false;
      }

      const data = await res.json();
      if (data.status && data.data?.jwtToken) {
        this.jwtToken = data.data.jwtToken;
        this.refreshToken = data.data.refreshToken || null;
        this.feedToken = data.data.feedToken || null;
        // JWT is valid for ~15 minutes, refresh proactively at 12min
        this.sessionExpiry = Date.now() + 12 * 60 * 1000;
        console.log('[AngelOne] Login successful');
        return true;
      }
      console.error('[AngelOne] Login response:', data.message || data);
      return false;
    } catch (e: any) {
      console.error('[AngelOne] Login error:', e.message);
      return false;
    }
  }

  private async renewToken(): Promise<boolean> {
    try {
      const res = await fetch(`${ANGEL_BASE}/rest/auth/angelbroking/jwt/v1/generateToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-PrivateKey': this.creds.apiKey,
          'Authorization': `Bearer ${this.jwtToken}`,
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data.status && data.data?.jwtToken) {
        this.jwtToken = data.data.jwtToken;
        this.feedToken = data.data.feedToken || this.feedToken;
        this.sessionExpiry = Date.now() + 12 * 60 * 1000;
        console.log('[AngelOne] Token refreshed');
        return true;
      }
      return false;
    } catch (e: any) {
      console.error('[AngelOne] Token refresh error:', e.message);
      return false;
    }
  }

  private generateTOTP(): string {
    const crypto = require('crypto');
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const c of this.creds.totpSecret.toUpperCase().replace(/=+$/, '')) {
      const val = base32chars.indexOf(c);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }
    const decoded: number[] = [];
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
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '127.0.0.1',
      'X-MACAddress': '00:00:00:00:00:00',
      'X-PrivateKey': this.creds.apiKey,
      'Authorization': `Bearer ${this.jwtToken}`,
    };
  }

  async checkConnectivity(): Promise<ConnectivityResult> {
    if (!this.creds.apiKey || !this.creds.clientId) {
      return { connected: false, error: 'AngelOne credentials not configured' };
    }
    const ok = await this.ensureSession();
    if (!ok) return { connected: false, error: 'Login failed' };
    return { connected: true, error: null };
  }

  // ── Index-parameterized methods ──────────────────────────────

  async getSpotPrice(index: IndexName): Promise<{ price: number; timestamp: Date } | null> {
    if (!(await this.ensureSession())) return null;
    const config = getIndexConfig(index);
    const token = config.brokerTokens.angelone.spotId;
    try {
      const res = await fetch(`${ANGEL_BASE}/rest/secure/angelbroking/market/v1/quote`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          mode: 'LTP',
          exchangeTokens: { NSE: [token] },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const fetched = data?.data?.fetched;
      if (Array.isArray(fetched) && fetched.length > 0) {
        const ltp = parseFloat(fetched[0].ltp);
        if (!isNaN(ltp)) return { price: ltp, timestamp: new Date() };
      }
      return null;
    } catch (e: any) {
      console.error(`[AngelOne] getSpotPrice(${index}) error:`, e.message);
      return null;
    }
  }

  async getNearestExpiry(index: IndexName): Promise<string | null> {
    if (!(await this.ensureSession())) return null;
    const symbolName = getIndexConfig(index).brokerTokens.angelone.symbolName;
    try {
      const res = await fetch(`${ANGEL_BASE}/rest/secure/angelbroking/market/v1/optionGreeks`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name: symbolName, expirydate: '' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const chain = data?.data;
      if (Array.isArray(chain) && chain.length > 0) {
        const expiries = [...new Set(chain.map((s: any) => s.expirydate).filter(Boolean))].sort();
        return expiries[0] || null;
      }
      return null;
    } catch (e: any) {
      console.error(`[AngelOne] getNearestExpiry(${index}) error:`, e.message);
      return null;
    }
  }

  async getOptionChain(index: IndexName, expiry: string): Promise<OptionChainStrike[]> {
    if (!(await this.ensureSession())) return [];
    const symbolName = getIndexConfig(index).brokerTokens.angelone.symbolName;
    try {
      const res = await fetch(`${ANGEL_BASE}/rest/secure/angelbroking/market/v1/optionGreeks`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name: symbolName, expirydate: expiry }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const chain = data?.data;
      if (!Array.isArray(chain)) return [];
      const strikeMap = new Map<number, { ce?: any; pe?: any }>();
      for (const opt of chain) {
        const strike = parseFloat(opt.strikePrice || opt.strikeprice || 0);
        if (!strikeMap.has(strike)) strikeMap.set(strike, {});
        const entry = strikeMap.get(strike)!;
        if (opt.optionType === 'CE') entry.ce = opt;
        else if (opt.optionType === 'PE') entry.pe = opt;
      }
      const result: OptionChainStrike[] = [];
      for (const [strike, { ce, pe }] of strikeMap) {
        if (!ce || !pe) continue;
        result.push({
          strikePrice: strike,
          ceInstrumentId: String(ce.symboltoken || ce.symbolToken || ''),
          peInstrumentId: String(pe.symboltoken || pe.symbolToken || ''),
          ceLtp: parseFloat(ce.ltp || 0),
          peLtp: parseFloat(pe.ltp || 0),
          ceOi: parseInt(ce.opnInterest || ce.openInterest || '0', 10),
          peOi: parseInt(pe.opnInterest || pe.openInterest || '0', 10),
        });
      }
      return result;
    } catch (e: any) {
      console.error(`[AngelOne] getOptionChain(${index}) error:`, e.message);
      return [];
    }
  }

  getIndexSubscription(index: IndexName): MarketFeedSubscription {
    const config = getIndexConfig(index);
    return { instrumentId: config.brokerTokens.angelone.spotId, segment: config.brokerTokens.angelone.spotSegment };
  }

  async getNiftySpot(): Promise<{ price: number; timestamp: Date } | null> {
    return this.getSpotPrice('NIFTY');
  }

  async placeOrder(params: OrderParams): Promise<OrderResult | null> {
    if (!(await this.ensureSession())) return null;
    try {
      const res = await fetch(`${ANGEL_BASE}/rest/secure/angelbroking/order/v1/placeOrder`, {
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
      if (!res.ok || !data.status) {
        console.error('[AngelOne] placeOrder error:', data);
        return null;
      }
      return { orderId: data.data?.orderid || '', orderStatus: 'PLACED' };
    } catch (e: any) {
      console.error('[AngelOne] placeOrder exception:', e.message);
      return null;
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    if (!(await this.ensureSession())) return null;
    try {
      const res = await fetch(`${ANGEL_BASE}/rest/secure/angelbroking/order/v1/details/${orderId}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    } catch (e: any) {
      console.error('[AngelOne] getOrderStatus error:', e.message);
      return null;
    }
  }

  async getPositions(): Promise<any[]> {
    if (!(await this.ensureSession())) return [];
    try {
      const res = await fetch(`${ANGEL_BASE}/rest/secure/angelbroking/order/v1/getPosition`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data?.data || [];
    } catch (e: any) {
      console.error('[AngelOne] getPositions error:', e.message);
      return [];
    }
  }

  createMarketFeed(): BrokerMarketFeed {
    return new SmartStreamAdapter(this.creds.apiKey, this.jwtToken || '', this.feedToken || '', this.creds.clientId);
  }

  getNiftyIndexSubscription(): MarketFeedSubscription {
    return this.getIndexSubscription('NIFTY');
  }

  getOptionLegSubscription(instrumentId: string): MarketFeedSubscription {
    return { instrumentId, segment: 'NFO' };
  }
}

// ── SmartStream WebSocket Market Feed ────────────────────────

/**
 * AngelOne SmartStream binary WebSocket client.
 * Protocol:
 * - Subscribe: JSON { action: 1, params: { mode: 1, tokenList: [{ exchangeType: N, tokens: ["token"] }] } }
 * - Unsubscribe: JSON { action: 0, params: { mode: 1, tokenList: [...] } }
 * - Mode: 1=LTP, 2=Quote, 3=Snap Quote
 * - Exchange types: 1=NSE_CM, 2=NSE_FNO, 3=BSE_CM
 * - Tick binary: exchange(1B) + token(25B) + seqNo(8B) + exchangeTimestamp(8B) + LTP(8B)
 */
class SmartStreamAdapter implements BrokerMarketFeed {
  private apiKey: string;
  private jwtToken: string;
  private feedToken: string;
  private clientId: string;
  private ws: WebSocket | null = null;
  private tickCallbacks: ((tick: { instrumentId: string; ltp: number }) => void)[] = [];
  private statusCallbacks: ((s: 'connected' | 'disconnected' | 'reconnecting') => void)[] = [];
  private subscribedTokens = new Map<string, number>(); // token → exchangeType
  private reconnectAttempts = 0;
  private maxReconnects = 20;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(apiKey: string, jwtToken: string, feedToken: string, clientId: string) {
    this.apiKey = apiKey;
    this.jwtToken = jwtToken;
    this.feedToken = feedToken;
    this.clientId = clientId;
  }

  async connect(): Promise<void> {
    if (this.closed) return;

    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.jwtToken}`,
        'x-api-key': this.apiKey,
        'x-client-code': this.clientId,
        'x-feed-token': this.feedToken,
      };

      this.ws = new WebSocket(ANGEL_WS, { headers });
      this.ws.binaryType = 'arraybuffer';

      const timeout = setTimeout(() => {
        reject(new Error('SmartStream connection timeout'));
        this.ws?.close();
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        console.log('[SmartStream] Connected');
        this.emitStatus('connected');
        this.startHeartbeat();

        // Re-subscribe on reconnect
        if (this.subscribedTokens.size > 0) {
          this.sendSubscribeAll();
        }
        resolve();
      });

      this.ws.on('message', (data: Buffer | ArrayBuffer) => {
        this.handleMessage(Buffer.from(data as ArrayBuffer));
      });

      this.ws.on('close', () => {
        clearTimeout(timeout);
        this.stopHeartbeat();
        this.emitStatus('disconnected');
        if (!this.closed) this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[SmartStream] Error:', err.message);
        if (this.reconnectAttempts === 0) reject(err);
      });
    });
  }

  subscribe(subs: MarketFeedSubscription[]): void {
    for (const s of subs) {
      const exchangeType = s.segment === 'NFO' ? 2 : 1; // NSE_FNO=2, NSE_CM=1
      this.subscribedTokens.set(s.instrumentId, exchangeType);
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribeAll();
    }
  }

  unsubscribe(subs: MarketFeedSubscription[]): void {
    const tokenList: { exchangeType: number; tokens: string[] }[] = [];
    for (const s of subs) {
      const exchangeType = this.subscribedTokens.get(s.instrumentId) || 2;
      this.subscribedTokens.delete(s.instrumentId);
      const existing = tokenList.find(t => t.exchangeType === exchangeType);
      if (existing) existing.tokens.push(s.instrumentId);
      else tokenList.push({ exchangeType, tokens: [s.instrumentId] });
    }

    if (this.ws?.readyState === WebSocket.OPEN && tokenList.length > 0) {
      this.ws.send(JSON.stringify({
        action: 0,
        params: { mode: 1, tokenList },
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
    this.stopHeartbeat();
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

  private sendSubscribeAll(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Group by exchange type
    const tokenList: { exchangeType: number; tokens: string[] }[] = [];
    for (const [token, exchangeType] of this.subscribedTokens) {
      const existing = tokenList.find(t => t.exchangeType === exchangeType);
      if (existing) existing.tokens.push(token);
      else tokenList.push({ exchangeType, tokens: [token] });
    }

    if (tokenList.length > 0) {
      this.ws.send(JSON.stringify({
        action: 1,
        params: { mode: 1, tokenList },
      }));
      console.log(`[SmartStream] Subscribed to ${this.subscribedTokens.size} tokens`);
    }
  }

  private handleMessage(buf: Buffer): void {
    // SmartStream LTP binary: exchange(1B) + token(25B padded) + seqNo(8B) + timestamp(8B) + LTP(8B)
    // Minimum LTP packet = 50 bytes
    if (buf.length < 50) return;

    try {
      // Extract token (bytes 1-25, null-terminated ASCII string)
      let tokenEnd = 1;
      while (tokenEnd < 26 && buf[tokenEnd] !== 0) tokenEnd++;
      const token = buf.subarray(1, tokenEnd).toString('ascii').trim();

      // LTP is at bytes 42-49 (int64 LE, but actually stored as a packed price)
      // SmartStream uses little-endian int64 for LTP in paise (divide by 100)
      const ltpRaw = buf.readBigInt64LE(42);
      const ltp = Number(ltpRaw) / 100;

      if (token && ltp > 0) {
        this.emitTick({ instrumentId: token, ltp });
      }
    } catch {
      // Parse error — skip malformed packet
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
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
