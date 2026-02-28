/**
 * Factory for creating broker adapters based on broker name + user credentials.
 * Resolves encrypted credentials from DynamoDB and returns the appropriate adapter.
 */

import type { BrokerAdapter, BrokerName } from '../broker-adapter.js';
import { DhanAdapter } from './dhan-adapter.js';
import { ZerodhaAdapter, getZerodhaAccessToken } from './zerodha-adapter.js';
import { MotilalAdapter } from './motilal-adapter.js';
import { AngelOneAdapter } from './angelone-adapter.js';
import { UpstoxAdapter } from './upstox-adapter.js';
import { getDhanCredentials, getZerodhaCredentials, getMotilalCredentials, getAngelOneCredentials, getUpstoxCredentials } from '../../auth/auth.js';

/**
 * Create a BrokerAdapter for the given broker and user.
 * Returns null if credentials are missing or invalid.
 */
export async function createBrokerAdapter(broker: BrokerName, userId: string): Promise<BrokerAdapter | null> {
  switch (broker) {
    case 'dhan': {
      const creds = await getDhanCredentials(userId);
      if (!creds) {
        console.warn(`[AdapterFactory] No DhanHQ credentials for user ${userId}`);
        return null;
      }
      return new DhanAdapter(creds, userId);
    }

    case 'zerodha': {
      const creds = await getZerodhaCredentials(userId);
      if (!creds) {
        console.warn(`[AdapterFactory] No Zerodha credentials for user ${userId}`);
        return null;
      }
      const accessToken = await getZerodhaAccessToken(userId);
      if (!accessToken) {
        console.warn(`[AdapterFactory] No Zerodha access token for user ${userId}`);
        return null;
      }
      return new ZerodhaAdapter(creds, accessToken);
    }

    case 'motilal': {
      const creds = await getMotilalCredentials(userId);
      if (!creds) {
        console.warn(`[AdapterFactory] No Motilal credentials for user ${userId}`);
        return null;
      }
      return new MotilalAdapter(creds);
    }

    case 'angelone': {
      const creds = await getAngelOneCredentials(userId);
      if (!creds) {
        console.warn(`[AdapterFactory] No AngelOne credentials for user ${userId}`);
        return null;
      }
      return new AngelOneAdapter(creds);
    }

    case 'upstox': {
      const creds = await getUpstoxCredentials(userId);
      if (!creds) {
        console.warn(`[AdapterFactory] No Upstox credentials for user ${userId}`);
        return null;
      }
      return new UpstoxAdapter(creds);
    }

    default:
      console.error(`[AdapterFactory] Unknown broker: ${broker}`);
      return null;
  }
}
