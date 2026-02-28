/**
 * DhanHQ adapter — wraps existing dhan-client.ts + dhan-ws-client.ts
 * behind the BrokerAdapter interface.
 */

import type {
  BrokerAdapter,
  BrokerMarketFeed,
  BrokerName,
  ConnectivityResult,
  FuturesOrderParams,
  MarketFeedSubscription,
  OptionChainStrike,
  OrderParams,
  OrderResult,
} from '../broker-adapter.js';
import {
  checkConnectivity,
  getNiftySpot,
  getNearestExpiry,
  getOptionChain as dhanGetOptionChain,
  placeOrder as dhanPlaceOrder,
  getOrderStatus as dhanGetOrderStatus,
  getPositions as dhanGetPositions,
  renewDhanToken,
  generateDhanToken,
  type DhanCredentials,
  type OptionChainStrike as DhanStrike,
} from '../dhan-client.js';
import { DhanMarketFeed, ExchangeSegment, type Instrument, type TickData } from '../dhan-ws-client.js';
import { updateUserProfile, getDhanTotpCredentials } from '../../auth/auth.js';
import { type IndexName, getIndexConfig } from '../index-config.js';

export class DhanAdapter implements BrokerAdapter {
  readonly brokerName: BrokerName = 'dhan';
  private creds: DhanCredentials;
  private userId: string;

  constructor(creds: DhanCredentials, userId: string) {
    this.creds = creds;
    this.userId = userId;
  }

  /**
   * Renew the DhanHQ access token.
   * 1) Try /v2/RenewToken (only works if token is still active)
   * 2) Fall back to TOTP-based generation (works even with expired token)
   * Persists the new token to DynamoDB.
   */
  async renewToken(): Promise<boolean> {
    // Attempt 1: Standard renewal (fast, no TOTP needed)
    const result = await renewDhanToken(this.creds);
    if (result) {
      this.creds = { ...this.creds, accessToken: result.accessToken };
      try {
        await updateUserProfile(this.userId, { dhanAccessToken: result.accessToken });
        console.log(`[DhanAdapter] Token renewed for ${this.userId}, expires: ${result.expiryTime}`);
      } catch (err: any) {
        console.error(`[DhanAdapter] Failed to persist renewed token:`, err.message);
      }
      return true;
    }

    // Attempt 2: TOTP-based token generation (works even if token expired)
    console.log(`[DhanAdapter] Standard renewal failed for ${this.userId}, trying TOTP generation...`);
    const totpCreds = await getDhanTotpCredentials(this.userId);
    if (!totpCreds) {
      console.warn(`[DhanAdapter] No TOTP credentials configured for ${this.userId} — cannot auto-generate token`);
      return false;
    }

    const newToken = await generateDhanToken(totpCreds.clientId, totpCreds.pin, totpCreds.totpSecret);
    if (!newToken) {
      console.error(`[DhanAdapter] TOTP token generation failed for ${this.userId}`);
      return false;
    }

    this.creds = { ...this.creds, accessToken: newToken };
    try {
      await updateUserProfile(this.userId, { dhanAccessToken: newToken });
      console.log(`[DhanAdapter] Fresh token generated via TOTP and persisted for ${this.userId}`);
    } catch (err: any) {
      console.error(`[DhanAdapter] Failed to persist TOTP-generated token:`, err.message);
    }
    return true;
  }

  /** Get current credentials (for WS reconnect with refreshed token) */
  getCredentials(): DhanCredentials {
    return this.creds;
  }

  async checkConnectivity(): Promise<ConnectivityResult> {
    const result = await checkConnectivity(this.creds);
    if (!result.connected) {
      // Token may be expired — attempt renewal before reporting inactive
      const renewed = await this.renewToken();
      if (renewed) {
        return checkConnectivity(this.creds); // creds updated by renewToken()
      }
    }
    return result;
  }

  // ── Index-parameterized methods ──────────────────────────────

  async getSpotPrice(index: IndexName): Promise<{ price: number; timestamp: Date } | null> {
    // DhanHQ uses the same getNiftySpot function — for BANKNIFTY we use security ID 25
    const config = getIndexConfig(index);
    const secId = Number(config.brokerTokens.dhan.spotId);
    // getNiftySpot is hardcoded to securityId 13 in dhan-client.ts
    // For NIFTY, reuse existing; for others, we call the same LTP endpoint with different ID
    if (index === 'NIFTY') return getNiftySpot(this.creds);
    // Generic spot price fetch via DhanHQ market quote
    try {
      const res = await fetch('https://api.dhan.co/v2/marketfeed/ltp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access-token': this.creds.accessToken },
        body: JSON.stringify({ IDX_I: [secId] }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const ltp = data?.data?.IDX_I?.[String(secId)]?.last_price;
      if (!ltp) return null;
      return { price: ltp, timestamp: new Date() };
    } catch (e: any) {
      console.error(`[DhanAdapter] getSpotPrice(${index}) error:`, e.message);
      return null;
    }
  }

  async getNearestExpiry(index: IndexName): Promise<string | null> {
    // DhanHQ expiry endpoint uses underlying symbol — works for both NIFTY and BANKNIFTY
    return getNearestExpiry(this.creds, getIndexConfig(index).brokerTokens.dhan.symbolName);
  }

  async getOptionChain(index: IndexName, expiry: string): Promise<OptionChainStrike[]> {
    const chain = await dhanGetOptionChain(expiry, this.creds, getIndexConfig(index).brokerTokens.dhan.symbolName);
    return chain.map((s: DhanStrike) => ({
      strikePrice: s.strikePrice,
      ceInstrumentId: String(s.ceSecurityId),
      peInstrumentId: String(s.peSecurityId),
      ceLtp: s.ceLtp,
      peLtp: s.peLtp,
      ceOi: s.ceOi,
      peOi: s.peOi,
    }));
  }

  getIndexSubscription(index: IndexName): MarketFeedSubscription {
    const config = getIndexConfig(index);
    return { instrumentId: config.brokerTokens.dhan.spotId, segment: config.brokerTokens.dhan.spotSegment };
  }

  // ── Backward-compat Nifty-only methods ─────────────────────

  async getNiftySpot(): Promise<{ price: number; timestamp: Date } | null> {
    return this.getSpotPrice('NIFTY');
  }

  async placeOrder(params: OrderParams): Promise<OrderResult | null> {
    const result = await dhanPlaceOrder({
      securityId: Number(params.instrumentId),
      transactionType: params.transactionType,
      quantity: params.quantity,
      orderType: params.orderType,
      price: params.price,
    }, this.creds);
    if (!result) return null;
    return { orderId: result.orderId, orderStatus: result.orderStatus };
  }

  async placeFuturesOrder(params: FuturesOrderParams): Promise<OrderResult | null> {
    if (!params.securityId) {
      console.error('[DhanAdapter] securityId is required for futures order');
      return null;
    }
    const result = await dhanPlaceOrder({
      securityId: Number(params.securityId),
      transactionType: params.action,
      quantity: params.quantity,
      orderType: params.orderType,
      price: params.price,
      productType: params.productType,
      exchangeSegment: 'NSE_FNO',
    }, this.creds);
    if (!result) return null;
    return { orderId: result.orderId, orderStatus: result.orderStatus };
  }

  async getOrderStatus(orderId: string): Promise<any> {
    return dhanGetOrderStatus(orderId, this.creds);
  }

  async getPositions(): Promise<any[]> {
    return dhanGetPositions(this.creds);
  }

  createMarketFeed(): BrokerMarketFeed {
    return new DhanMarketFeedAdapter(this.creds);
  }

  getNiftyIndexSubscription(): MarketFeedSubscription {
    return this.getIndexSubscription('NIFTY');
  }

  getOptionLegSubscription(instrumentId: string): MarketFeedSubscription {
    return { instrumentId, segment: 'NSE_FNO' };
  }
}

/**
 * Wraps DhanMarketFeed (binary WS) behind BrokerMarketFeed interface.
 */
class DhanMarketFeedAdapter implements BrokerMarketFeed {
  private feed: DhanMarketFeed;

  constructor(creds: DhanCredentials) {
    this.feed = new DhanMarketFeed(creds);
  }

  async connect(): Promise<void> {
    return this.feed.connect();
  }

  subscribe(subs: MarketFeedSubscription[]): void {
    const instruments: Instrument[] = subs.map(s => ({
      exchangeSegment: segmentFromString(s.segment),
      securityId: Number(s.instrumentId),
    }));
    this.feed.subscribe(instruments);
  }

  unsubscribe(subs: MarketFeedSubscription[]): void {
    const instruments: Instrument[] = subs.map(s => ({
      exchangeSegment: segmentFromString(s.segment),
      securityId: Number(s.instrumentId),
    }));
    this.feed.unsubscribe(instruments);
  }

  onTick(cb: (tick: { instrumentId: string; ltp: number }) => void): void {
    this.feed.onTick((tick: TickData) => {
      if (tick.ltp > 0) {
        cb({ instrumentId: String(tick.securityId), ltp: tick.ltp });
      }
    });
  }

  onStatus(cb: (s: 'connected' | 'disconnected' | 'reconnecting') => void): void {
    this.feed.onStatus(cb);
  }

  close(): void {
    this.feed.close();
  }

  get isConnected(): boolean {
    return this.feed.isConnected;
  }
}

function segmentFromString(seg: string): ExchangeSegment {
  switch (seg) {
    case 'NSE_FNO': return ExchangeSegment.NSE_FNO;
    case 'NSE_CM': return ExchangeSegment.NSE_CM;
    case 'IDX_I': return ExchangeSegment.IDX_I;
    case 'IDX_B': return ExchangeSegment.IDX_B;
    case 'BSE_FNO': return ExchangeSegment.BSE_FNO;
    case 'MCX_COMM': return ExchangeSegment.MCX_COMM;
    default: return ExchangeSegment.NSE_FNO;
  }
}
