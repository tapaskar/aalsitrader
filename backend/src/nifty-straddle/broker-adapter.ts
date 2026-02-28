/**
 * Broker-agnostic adapter interface for the Nifty Straddle engine.
 * Each broker (DhanHQ, Zerodha, Motilal, AngelOne, Upstox) implements this interface.
 * Supports multi-index: NIFTY and BANKNIFTY via IndexName parameter.
 */

import type { IndexName } from './index-config.js';

export type BrokerName = 'dhan' | 'zerodha' | 'motilal' | 'angelone' | 'upstox';

export interface OptionChainStrike {
  strikePrice: number;
  ceInstrumentId: string;   // Broker-specific (DhanHQ=securityId, Zerodha=tradingsymbol, Motilal=scripCode)
  peInstrumentId: string;
  ceLtp: number;
  peLtp: number;
  ceOi: number;
  peOi: number;
}

export interface OrderParams {
  instrumentId: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  orderType?: 'MARKET' | 'LIMIT';
  price?: number;
}

export interface FuturesOrderParams {
  symbol: string;
  securityId?: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  lotSize: number;
  orderType: 'MARKET' | 'LIMIT';
  price?: number;
  productType: 'INTRADAY' | 'MARGIN';
}

export interface OrderResult {
  orderId: string;
  orderStatus?: string;
}

export interface ConnectivityResult {
  connected: boolean;
  error: string | null;
}

export interface MarketFeedSubscription {
  instrumentId: string;
  segment: string;
}

export interface BrokerAdapter {
  readonly brokerName: BrokerName;

  checkConnectivity(): Promise<ConnectivityResult>;

  // Index-parameterized methods (multi-index support)
  getSpotPrice(index: IndexName): Promise<{ price: number; timestamp: Date } | null>;
  getNearestExpiry(index: IndexName): Promise<string | null>;
  getOptionChain(index: IndexName, expiry: string): Promise<OptionChainStrike[]>;
  getIndexSubscription(index: IndexName): MarketFeedSubscription;

  // Backward-compat Nifty-only methods (delegate to index-parameterized)
  getNiftySpot(): Promise<{ price: number; timestamp: Date } | null>;
  /** @deprecated Use getNearestExpiry(index) */
  getNearestNiftyExpiry?(): Promise<string | null>;

  placeOrder(params: OrderParams): Promise<OrderResult | null>;
  placeFuturesOrder?(params: FuturesOrderParams): Promise<OrderResult | null>;
  getOrderStatus(orderId: string): Promise<any>;
  getPositions(): Promise<any[]>;

  // WebSocket feed for Fargate runner
  createMarketFeed(): BrokerMarketFeed;
  getNiftyIndexSubscription(): MarketFeedSubscription;
  getOptionLegSubscription(instrumentId: string): MarketFeedSubscription;
}

export interface BrokerMarketFeed {
  connect(): Promise<void>;
  subscribe(subs: MarketFeedSubscription[]): void;
  unsubscribe(subs: MarketFeedSubscription[]): void;
  onTick(cb: (tick: { instrumentId: string; ltp: number }) => void): void;
  onStatus(cb: (s: 'connected' | 'disconnected' | 'reconnecting') => void): void;
  close(): void;
  readonly isConnected: boolean;
}
