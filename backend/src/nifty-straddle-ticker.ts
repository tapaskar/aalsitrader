/**
 * EventBridge Lambda handler for Nifty Straddle ticker.
 * Triggered every 3 minutes during market hours.
 * Scans for all users with running engines and processes each independently.
 * Now broker-agnostic — resolves adapter from EngineState.broker.
 */

import { runTick } from './nifty-straddle/straddle-engine.js';
import { getUsersWithRunningEngines, getEngineState } from './nifty-straddle/straddle-store.js';
import { createBrokerAdapter } from './nifty-straddle/adapters/adapter-factory.js';

export const handler = async (event: any) => {
  console.log('Nifty Straddle ticker invoked', new Date().toISOString());

  try {
    // Find all users with running engines
    const userIds = await getUsersWithRunningEngines();

    if (userIds.length === 0) {
      console.log('No users with running engines');
      return { statusCode: 200, body: JSON.stringify({ action: 'skipped', details: 'no active users' }) };
    }

    console.log(`Processing ${userIds.length} user(s):`, userIds);

    const results: Record<string, any> = {};

    // Process each user sequentially to avoid broker API rate limits
    for (const userId of userIds) {
      try {
        // Load engine state to determine which broker to use
        const state = await getEngineState(userId);
        const adapter = await createBrokerAdapter(state.broker, userId);

        const result = await runTick(userId, adapter);
        results[userId] = result;
        console.log(`[${userId}/${state.broker}] Tick result:`, JSON.stringify(result));
      } catch (error: any) {
        console.error(`[${userId}] Tick error:`, error.message);
        results[userId] = { action: 'error', details: error.message };
      }
    }

    return { statusCode: 200, body: JSON.stringify({ users: userIds.length, results }) };
  } catch (error: any) {
    console.error('Ticker error:', error.message, error.stack);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
