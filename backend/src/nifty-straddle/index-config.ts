/**
 * Index configuration for multi-index support.
 * Defines IndexName, per-index parameters, and broker-specific token mappings.
 */

import type { BrokerName } from './broker-adapter.js';

export type IndexName = 'NIFTY' | 'BANKNIFTY';

export interface BrokerTokenConfig {
  spotId: string;
  spotSegment: string;
  fnoSegment: string;
  /** Underlying symbol name used in broker API calls (e.g. option chain, expiry lookup) */
  symbolName: string;
}

export interface IndexConfig {
  name: IndexName;
  displayName: string;
  lotSize: number;
  strikeInterval: number;
  brokerTokens: Record<BrokerName, BrokerTokenConfig>;
}

export const INDEX_CONFIGS: Record<IndexName, IndexConfig> = {
  NIFTY: {
    name: 'NIFTY',
    displayName: 'Nifty 50',
    lotSize: 25,
    strikeInterval: 50,
    brokerTokens: {
      dhan: { spotId: '13', spotSegment: 'IDX_I', fnoSegment: 'NSE_FNO', symbolName: 'NIFTY' },
      zerodha: { spotId: '256265', spotSegment: 'NSE', fnoSegment: 'NFO', symbolName: 'NIFTY' },
      angelone: { spotId: '99926000', spotSegment: 'NSE', fnoSegment: 'NFO', symbolName: 'NIFTY' },
      upstox: { spotId: 'NSE_INDEX|Nifty 50', spotSegment: 'NSE_INDEX', fnoSegment: 'NSE_FO', symbolName: 'NIFTY' },
      motilal: { spotId: '26000', spotSegment: 'NSE', fnoSegment: 'NFO', symbolName: 'NIFTY' },
    },
  },
  BANKNIFTY: {
    name: 'BANKNIFTY',
    displayName: 'Bank Nifty',
    lotSize: 15,
    strikeInterval: 100,
    brokerTokens: {
      dhan: { spotId: '25', spotSegment: 'IDX_I', fnoSegment: 'NSE_FNO', symbolName: 'BANKNIFTY' },
      zerodha: { spotId: '260105', spotSegment: 'NSE', fnoSegment: 'NFO', symbolName: 'BANKNIFTY' },
      angelone: { spotId: '99926009', spotSegment: 'NSE', fnoSegment: 'NFO', symbolName: 'BANKNIFTY' },
      upstox: { spotId: 'NSE_INDEX|Nifty Bank', spotSegment: 'NSE_INDEX', fnoSegment: 'NSE_FO', symbolName: 'BANKNIFTY' },
      motilal: { spotId: '26009', spotSegment: 'NSE', fnoSegment: 'NFO', symbolName: 'BANKNIFTY' },
    },
  },
};

export function getIndexConfig(index: IndexName): IndexConfig {
  return INDEX_CONFIGS[index];
}
