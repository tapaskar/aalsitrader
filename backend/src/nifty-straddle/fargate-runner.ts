/**
 * ECS Fargate entry point for Nifty Straddle engine.
 * Uses SharedMarketFeed (single WS) + per-user UserEngines for scalability.
 *
 * Architecture:
 *   SharedMarketFeed (1 WS) → price cache → fan-out to UserEngine[]
 *   Each UserEngine evaluates strategy independently → per-user adapter for orders (REST API)
 *
 * Lifecycle:
 * 1. Scan DynamoDB for users with running engines
 * 2. Create SharedMarketFeed using first user's broker credentials (for WS market data)
 * 3. Per user: create UserEngine with own BrokerAdapter (for order execution)
 * 4. SharedMarketFeed fans out ticks to all UserEngines in-memory
 * 5. Every 30s: re-scan for new/stopped users
 * 6. On SIGTERM: close shared feed, stop all engines, persist state, exit
 */

import {
  getUsersWithRunningEngines,
  getEngineState,
  setEngineState,
} from './straddle-store.js';
import { createBrokerAdapter } from './adapters/adapter-factory.js';
import type { BrokerAdapter } from './broker-adapter.js';
import { DhanAdapter } from './adapters/dhan-adapter.js';
import { isMarketOpen } from './market-hours.js';
import { ECSClient, UpdateServiceCommand } from '@aws-sdk/client-ecs';
import { SharedMarketFeed } from './shared-market-feed.js';
import { UserEngine } from './user-engine.js';

const USER_SCAN_INTERVAL = 30_000; // 30s

// ECS Fargate scaling (for auto-shutdown at market close)
const ECS_REGION = process.env.AWS_REGION || 'ap-south-1';
const ECS_CLUSTER = process.env.ECS_CLUSTER || 'nifty-straddle-prod';
const ECS_SERVICE = process.env.ECS_SERVICE || 'straddle-engine';

// ── Main Fargate Runner ──────────────────────────────────────

class FargateRunner {
  private sharedFeed: SharedMarketFeed | null = null;
  private feedPromise: Promise<SharedMarketFeed | null> | null = null; // Prevent duplicate creation
  private engines = new Map<string, UserEngine>();
  private scanTimer: NodeJS.Timeout | null = null;
  private shuttingDown = false;

  async start(): Promise<void> {
    console.log('[Fargate] Starting Nifty Straddle engine (shared feed architecture)');
    console.log(`[Fargate] Environment: STAGE=${process.env.STAGE}, TABLE=${process.env.NIFTY_STRADDLE_TABLE}`);

    // If started after market close, immediately scale down and exit
    const market = isMarketOpen();
    const totalMinutes = market.istHour * 60 + market.istMinute;
    if (!market.isOpen && totalMinutes > 930) {
      console.log(`[Fargate] Started after market close (${market.istTime} IST) — scaling down immediately`);
      try {
        const ecsClient = new ECSClient({ region: ECS_REGION });
        await ecsClient.send(new UpdateServiceCommand({
          cluster: ECS_CLUSTER,
          service: ECS_SERVICE,
          desiredCount: 0,
        }));
        console.log('[Fargate] Scaled to desiredCount=0, exiting');
      } catch (err: any) {
        console.error('[Fargate] Scale-down error:', err.message);
      }
      process.exit(0);
    }

    // Register shutdown handlers
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));

    // Initial user scan (also initializes shared feed)
    await this.scanUsers();

    // Periodic user scan
    this.scanTimer = setInterval(() => this.scanUsers(), USER_SCAN_INTERVAL);

    console.log('[Fargate] Engine running, scanning for users every 30s');
  }

  /**
   * Initialize the shared market feed using a user's broker credentials.
   * The shared feed only needs market data access (not order placement),
   * so any user's credentials work for the WS connection.
   */
  private async ensureSharedFeed(userId: string): Promise<SharedMarketFeed | null> {
    if (this.sharedFeed) return this.sharedFeed;
    // Prevent concurrent scans from creating duplicate shared feeds
    if (this.feedPromise) return this.feedPromise;

    this.feedPromise = this.createSharedFeed(userId);
    const feed = await this.feedPromise;
    this.feedPromise = null;
    return feed;
  }

  private async createSharedFeed(userId: string): Promise<SharedMarketFeed | null> {
    // Resolve broker for this user
    const state = await getEngineState(userId);
    let broker = state.broker;

    if (!broker) {
      const { getUserProfile } = await import('../auth/auth.js');
      const profile = await getUserProfile(userId);
      if (profile?.hasZerodhaCredentials) broker = 'zerodha';
      else if (profile?.hasDhanCredentials) broker = 'dhan';
      else if (profile?.hasMotilalCredentials) broker = 'motilal';
      else if (profile?.hasAngelOneCredentials) broker = 'angelone';
      else if (profile?.hasUpstoxCredentials) broker = 'upstox';
      else broker = 'dhan';
      await setEngineState({ broker }, userId);
    }

    const adapter = await createBrokerAdapter(broker, userId);
    if (!adapter) {
      console.warn(`[Fargate] No ${broker} credentials for shared feed from user ${userId}`);
      return null;
    }

    this.sharedFeed = new SharedMarketFeed(adapter);
    const started = await this.sharedFeed.start();
    if (!started) {
      console.error('[Fargate] Failed to start shared market feed');
      this.sharedFeed = null;
      return null;
    }

    console.log(`[Fargate] Shared market feed started (broker=${broker}, credentialUser=${userId})`);
    return this.sharedFeed;
  }

  private async scanUsers(): Promise<void> {
    if (this.shuttingDown) return;

    // Auto-shutdown at market close (3:30 PM IST)
    const market = isMarketOpen();
    if (!market.isOpen) {
      const totalMinutes = market.istHour * 60 + market.istMinute;
      if (totalMinutes > 930) {
        console.log(`[Fargate] Market closed (${market.istTime} IST) — initiating auto-shutdown`);
        await this.marketCloseShutdown();
        return;
      }
    }

    try {
      const activeUserIds = await getUsersWithRunningEngines();

      // Remove dead engines so they can be restarted
      for (const [userId, engine] of this.engines) {
        if (!engine.running) {
          console.warn(`[Fargate] Dead engine for ${userId}, removing for restart`);
          this.engines.delete(userId);
        }
      }

      // Start engines for new users
      for (const userId of activeUserIds) {
        if (!this.engines.has(userId)) {
          await this.startUserEngine(userId);
        }
      }

      // Stop engines for users who turned off
      for (const [userId, engine] of this.engines) {
        if (!activeUserIds.includes(userId)) {
          console.log(`[Fargate] User ${userId} engine stopped, removing`);
          await engine.stop();
          this.engines.delete(userId);
        }
      }

      // If no active engines, stop the shared feed
      if (this.engines.size === 0 && this.sharedFeed) {
        console.log(`[Fargate] No active users, stopping shared feed`);
        await this.sharedFeed.stop();
        this.sharedFeed = null;
      }

      console.log(`[Fargate] Active engines: ${this.engines.size} (users: ${activeUserIds.join(', ') || 'none'})`);
    } catch (err: any) {
      console.error('[Fargate] User scan error:', err.message);
    }
  }

  private async startUserEngine(userId: string): Promise<void> {
    try {
      // Ensure shared feed is running
      const feed = await this.ensureSharedFeed(userId);
      if (!feed) {
        console.warn(`[Fargate] Cannot start engine for ${userId}: no shared feed`);
        return;
      }

      // Resolve broker for this user
      const state = await getEngineState(userId);
      let broker = state.broker;
      if (!broker) {
        const { getUserProfile } = await import('../auth/auth.js');
        const profile = await getUserProfile(userId);
        if (profile?.hasZerodhaCredentials) broker = 'zerodha';
        else if (profile?.hasDhanCredentials) broker = 'dhan';
        else if (profile?.hasMotilalCredentials) broker = 'motilal';
        else if (profile?.hasAngelOneCredentials) broker = 'angelone';
        else if (profile?.hasUpstoxCredentials) broker = 'upstox';
        else broker = 'dhan';
        await setEngineState({ broker }, userId);
        console.log(`[Fargate] Auto-detected broker=${broker} for user=${userId}`);
      }

      // Create per-user adapter for order execution (REST API)
      const adapter = await createBrokerAdapter(broker, userId);
      if (!adapter) {
        console.warn(`[Fargate] No ${broker} credentials for user ${userId}, skipping`);
        return;
      }

      // Renew token for the per-user adapter (skip if shared feed already renewed it)
      if (adapter instanceof DhanAdapter) {
        const renewed = await adapter.renewToken();
        if (renewed) {
          console.log(`[Fargate] DhanHQ token renewed for ${userId}`);
        }
      }

      const engine = new UserEngine(userId, adapter, feed);
      this.engines.set(userId, engine);
      await engine.start();

      if (!engine.running) {
        console.warn(`[Fargate] Engine for ${userId} failed to start, removing`);
        this.engines.delete(userId);
      }
    } catch (err: any) {
      console.error(`[Fargate] Failed to start engine for ${userId}:`, err.message);
      this.engines.delete(userId);
    }
  }

  private async marketCloseShutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    console.log('[Fargate] Market close auto-shutdown: stopping all engines...');

    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    // Stop all user engines (persists final state)
    const stopPromises = Array.from(this.engines.values()).map(e => e.stop());
    await Promise.allSettled(stopPromises);

    // Mark all engines as stopped in DynamoDB
    for (const userId of this.engines.keys()) {
      try {
        await setEngineState({ running: false }, userId);
        console.log(`[Fargate] Engine marked stopped for ${userId}`);
      } catch (err: any) {
        console.error(`[Fargate] Failed to stop engine for ${userId}:`, err.message);
      }
    }
    this.engines.clear();

    // Stop shared feed
    if (this.sharedFeed) {
      await this.sharedFeed.stop();
      this.sharedFeed = null;
    }

    // Scale Fargate service to 0
    try {
      const ecsClient = new ECSClient({ region: ECS_REGION });
      await ecsClient.send(new UpdateServiceCommand({
        cluster: ECS_CLUSTER,
        service: ECS_SERVICE,
        desiredCount: 0,
      }));
      console.log('[Fargate] Scaled service to desiredCount=0');
    } catch (err: any) {
      console.error('[Fargate] Failed to scale down Fargate:', err.message);
    }

    console.log('[Fargate] Market close shutdown complete, exiting');
    process.exit(0);
  }

  private async shutdown(signal: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    console.log(`[Fargate] Received ${signal}, shutting down gracefully...`);

    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    // Stop all engines in parallel
    const stopPromises = Array.from(this.engines.values()).map(e => e.stop());
    await Promise.allSettled(stopPromises);
    this.engines.clear();

    // Stop shared feed
    if (this.sharedFeed) {
      await this.sharedFeed.stop();
      this.sharedFeed = null;
    }

    console.log('[Fargate] All engines stopped, exiting');
    process.exit(0);
  }
}

// ── Entry Point ──────────────────────────────────────────────

const runner = new FargateRunner();
runner.start().catch(err => {
  console.error('[Fargate] Fatal error:', err);
  process.exit(1);
});
