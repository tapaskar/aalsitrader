/**
 * DhanHQ WebSocket Market Feed Client (v2 binary protocol).
 * Connects to wss://api-feed.dhan.co and streams real-time tick data.
 * Supports Quote mode for Nifty index + option legs.
 *
 * Binary protocol reference: DhanHQ Market Feed v2 documentation.
 */

import WebSocket from 'ws';
import type { DhanCredentials } from './dhan-client.js';

// ── Exchange segments ────────────────────────────────────────
export enum ExchangeSegment {
  NSE_CM = 0,
  NSE_FNO = 1,
  NSE_CUR = 2,
  BSE_CM = 3,
  BSE_FNO = 4,
  BSE_CUR = 5,
  MCX_COMM = 7,
  IDX_I = 11,     // NSE Index
  IDX_B = 12,     // BSE Index
}

// Map exchange segment bytes back to string keys (for binary response parsing)
const SEGMENT_MAP: Record<number, string> = {
  0: 'NSE_CM', 1: 'NSE_FNO', 2: 'NSE_CUR', 3: 'BSE_CM',
  4: 'BSE_FNO', 5: 'BSE_CUR', 7: 'MCX_COMM', 11: 'IDX_I', 12: 'IDX_B',
};

// Map exchange segment enum to v2 JSON subscription string names
const SEGMENT_STRING_MAP: Record<number, string> = {
  [ExchangeSegment.NSE_CM]: 'NSE_EQ',
  [ExchangeSegment.NSE_FNO]: 'NSE_FNO',
  [ExchangeSegment.NSE_CUR]: 'NSE_CURRENCY',
  [ExchangeSegment.BSE_CM]: 'BSE_EQ',
  [ExchangeSegment.BSE_FNO]: 'BSE_FNO',
  [ExchangeSegment.BSE_CUR]: 'BSE_CURRENCY',
  [ExchangeSegment.MCX_COMM]: 'MCX_COMM',
  [ExchangeSegment.IDX_I]: 'IDX_I',
  [ExchangeSegment.IDX_B]: 'IDX_B',
};

// ── Request/Response codes ───────────────────────────────────
const REQUEST_CODE_SUBSCRIBE = 15;
const REQUEST_CODE_UNSUBSCRIBE = 16;

// Response codes from server
const RESPONSE_TICKER = 2;
const RESPONSE_QUOTE = 3;
const RESPONSE_FULL = 5;
const RESPONSE_PREV_CLOSE = 6;
const RESPONSE_OI = 7;
const RESPONSE_DISCONNECTED = 50;
const RESPONSE_PONG = 100;  // Server heartbeat

// ── Types ────────────────────────────────────────────────────
export interface Instrument {
  exchangeSegment: ExchangeSegment;
  securityId: number;
}

export interface TickData {
  securityId: number;
  exchangeSegment: string;
  ltp: number;
  ltq: number;
  ltt: number;         // epoch seconds
  volume: number;
  avgPrice: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  dayClose: number;
  oi?: number;
}

type TickCallback = (tick: TickData) => void;
type StatusCallback = (status: 'connected' | 'disconnected' | 'reconnecting') => void;

export class DhanMarketFeed {
  private creds: DhanCredentials;
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Instrument> = new Map();
  private tickCallbacks: TickCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(creds: DhanCredentials) {
    this.creds = creds;
  }

  async connect(): Promise<void> {
    if (this.closed) return;

    return new Promise((resolve, reject) => {
      const url = `wss://api-feed.dhan.co?version=2&token=${this.creds.accessToken}&clientId=${this.creds.clientId}&authType=2`;

      const tokenPreview = this.creds.accessToken.slice(0, 20) + '...';
      console.log(`[DhanWS] Connecting: clientId=${this.creds.clientId} token=${tokenPreview} authType=2`);

      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout (10s)'));
        this.ws?.close();
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        console.log(`[DhanWS] Connected (readyState=${this.ws?.readyState})`);
        this.emitStatus('connected');

        // Re-subscribe to all instruments on reconnect
        if (this.subscriptions.size > 0) {
          this.sendSubscribe(Array.from(this.subscriptions.values()));
        }

        // Server sends ping every 10s; we respond with pong
        this.startPingMonitor();

        // Diagnostic: check WS state after 15s
        setTimeout(() => {
          console.log(`[DhanWS] Diagnostic 15s: readyState=${this.ws?.readyState} msgCount=${this.msgCount} subs=${this.subscriptions.size}`);
        }, 15000);

        resolve();
      });

      this.ws.on('message', (data: ArrayBuffer) => {
        this.handleMessage(data);
      });

      this.ws.on('ping', () => {
        console.log('[DhanWS] Received ping from server');
      });

      this.ws.on('pong', () => {
        console.log('[DhanWS] Received pong from server');
      });

      this.ws.on('close', (code, reason) => {
        clearTimeout(timeout);
        console.log(`[DhanWS] Disconnected: code=${code} reason=${reason}`);
        this.emitStatus('disconnected');
        this.stopPingMonitor();

        if (!this.closed) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[DhanWS] Error:', err.message);
        // Don't reject on reconnect attempts
        if (this.reconnectAttempts === 0) {
          reject(err);
        }
      });
    });
  }

  subscribe(instruments: Instrument[]): void {
    for (const inst of instruments) {
      const key = `${inst.exchangeSegment}:${inst.securityId}`;
      this.subscriptions.set(key, inst);
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(instruments);
    }
  }

  unsubscribe(instruments: Instrument[]): void {
    for (const inst of instruments) {
      const key = `${inst.exchangeSegment}:${inst.securityId}`;
      this.subscriptions.delete(key);
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe(instruments);
    }
  }

  onTick(callback: TickCallback): void {
    this.tickCallbacks.push(callback);
  }

  onStatus(callback: StatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  close(): void {
    this.closed = true;
    this.stopPingMonitor();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.tickCallbacks = [];
    this.statusCallbacks = [];
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Subscription protocol ──────────────────────────────────

  private sendSubscribe(instruments: Instrument[]): void {
    this.sendSubscriptionPacket(REQUEST_CODE_SUBSCRIBE, instruments);
  }

  private sendUnsubscribe(instruments: Instrument[]): void {
    this.sendSubscriptionPacket(REQUEST_CODE_UNSUBSCRIBE, instruments);
  }

  /**
   * Subscription message format (v2 JSON):
   * {
   *   "RequestCode": 15 (subscribe) or 16 (unsubscribe),
   *   "InstrumentCount": N,
   *   "InstrumentList": [{ "ExchangeSegment": "NSE_EQ", "SecurityId": "1333" }, ...]
   * }
   */
  private sendSubscriptionPacket(requestCode: number, instruments: Instrument[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Max 100 instruments per message
    const chunks = [];
    for (let i = 0; i < instruments.length; i += 100) {
      chunks.push(instruments.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      const msg = {
        RequestCode: requestCode,
        InstrumentCount: chunk.length,
        InstrumentList: chunk.map(inst => ({
          ExchangeSegment: SEGMENT_STRING_MAP[inst.exchangeSegment] || 'NSE_EQ',
          SecurityId: String(inst.securityId),
        })),
      };
      this.ws.send(JSON.stringify(msg));
    }

    const secIds = instruments.map(i => i.securityId);
    const action = requestCode === REQUEST_CODE_SUBSCRIBE ? 'Subscribed' : 'Unsubscribed';
    console.log(`[DhanWS] ${action} to ${instruments.length} instruments: ${secIds.join(', ')}`);
  }

  // ── Binary message parsing ─────────────────────────────────

  private msgCount = 0;

  private handleMessage(data: ArrayBuffer): void {
    const buf = Buffer.from(data);
    if (buf.length < 1) return;

    this.msgCount++;
    const responseCode = buf.readUInt8(0);

    if (this.msgCount <= 10 || this.msgCount % 200 === 0) {
      console.log(`[DhanWS] Msg #${this.msgCount}: code=${responseCode} len=${buf.length}`);
    }

    switch (responseCode) {
      case RESPONSE_PONG:
        // Server heartbeat — no action needed
        break;

      case RESPONSE_DISCONNECTED:
        console.warn('[DhanWS] Server sent disconnect signal');
        this.ws?.close();
        break;

      case RESPONSE_TICKER:
        this.parseTicker(buf);
        break;

      case RESPONSE_QUOTE:
        this.parseQuote(buf);
        break;

      case RESPONSE_FULL:
        // Full packet — parse same as quote for the fields we need
        this.parseQuote(buf);
        break;

      case RESPONSE_PREV_CLOSE:
        // Previous close data — skip for now
        break;

      case RESPONSE_OI:
        this.parseOI(buf);
        break;

      default:
        // Unknown response code — log and skip
        if (buf.length > 4) {
          console.debug(`[DhanWS] Unknown response code: ${responseCode}, len=${buf.length}`);
        }
        break;
    }
  }

  /**
   * Ticker packet (response code 2):
   * Byte 0: Response code
   * Byte 1-2: Message length (int16 LE)
   * Byte 3: Exchange segment (uint8)
   * Bytes 4-7: Security ID (int32 LE)
   * Bytes 8-11: LTP (float32 LE)
   */
  private parseTicker(buf: Buffer): void {
    if (buf.length < 12) return;

    const segment = buf.readUInt8(3);
    const securityId = buf.readInt32LE(4);
    const ltp = buf.readFloatLE(8);

    this.emitTick({
      securityId,
      exchangeSegment: SEGMENT_MAP[segment] || String(segment),
      ltp,
      ltq: 0, ltt: 0, volume: 0, avgPrice: 0,
      dayOpen: 0, dayHigh: 0, dayLow: 0, dayClose: 0,
    });
  }

  /**
   * Quote packet (response code 3):
   * Byte 0: Response code
   * Byte 1-2: Message length (int16 LE)
   * Byte 3: Exchange segment (uint8)
   * Bytes 4-7: Security ID (int32 LE)
   * Bytes 8-11: LTP (float32 LE)
   * Bytes 12-13: LTQ (int16 LE)
   * Bytes 14-17: LTT epoch (int32 LE)
   * Bytes 18-21: ATP / Avg Price (float32 LE)
   * Bytes 22-25: Volume (int32 LE)
   * Bytes 26-29: Total Sell Qty (int32 LE) — skip
   * Bytes 30-33: Total Buy Qty (int32 LE) — skip
   * Bytes 34-37: Day Open (float32 LE)
   * Bytes 38-41: Day High (float32 LE)
   * Bytes 42-45: Day Low (float32 LE)
   * Bytes 46-49: Day Close (float32 LE)
   */
  private parseQuote(buf: Buffer): void {
    if (buf.length < 50) {
      // Fall back to ticker parsing if too short
      if (buf.length >= 12) this.parseTicker(buf);
      return;
    }

    const segment = buf.readUInt8(3);
    const securityId = buf.readInt32LE(4);
    const ltp = buf.readFloatLE(8);
    const ltq = buf.readInt16LE(12);
    const ltt = buf.readInt32LE(14);
    const avgPrice = buf.readFloatLE(18);
    const volume = buf.readInt32LE(22);
    const dayOpen = buf.readFloatLE(34);
    const dayHigh = buf.readFloatLE(38);
    const dayLow = buf.readFloatLE(42);
    const dayClose = buf.readFloatLE(46);

    this.emitTick({
      securityId,
      exchangeSegment: SEGMENT_MAP[segment] || String(segment),
      ltp, ltq, ltt, avgPrice, volume,
      dayOpen, dayHigh, dayLow, dayClose,
    });
  }

  /**
   * OI packet (response code 7):
   * Only emits securityId + OI — we merge into existing ticks if needed.
   */
  private parseOI(buf: Buffer): void {
    if (buf.length < 12) return;
    const segment = buf.readUInt8(3);
    const securityId = buf.readInt32LE(4);
    const oi = buf.readInt32LE(8);

    this.emitTick({
      securityId,
      exchangeSegment: SEGMENT_MAP[segment] || String(segment),
      ltp: 0, ltq: 0, ltt: 0, volume: 0, avgPrice: 0,
      dayOpen: 0, dayHigh: 0, dayLow: 0, dayClose: 0,
      oi,
    });
  }

  // ── Reconnection ───────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[DhanWS] Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    console.log(`[DhanWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.emitStatus('reconnecting');

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (err: any) {
        console.error(`[DhanWS] Reconnect failed: ${err.message}`);
      }
    }, delay);
  }

  // ── Heartbeat monitor ──────────────────────────────────────

  private startPingMonitor(): void {
    this.stopPingMonitor();
    // If no data received in 30s, force reconnect
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 15000);
  }

  private stopPingMonitor(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  // ── Event emitters ─────────────────────────────────────────

  private emitTick(tick: TickData): void {
    for (const cb of this.tickCallbacks) {
      try {
        cb(tick);
      } catch (err: any) {
        console.error('[DhanWS] Tick callback error:', err.message);
      }
    }
  }

  private emitStatus(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    for (const cb of this.statusCallbacks) {
      try {
        cb(status);
      } catch (err: any) {
        console.error('[DhanWS] Status callback error:', err.message);
      }
    }
  }
}
