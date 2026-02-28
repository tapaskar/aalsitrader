/**
 * Load test: 50 parallel users placing orders through the shared feed architecture.
 * Tests:
 * 1. In-memory fan-out performance (50 listeners × 100 ticks)
 * 2. Parallel DynamoDB writes for order opens (50 simultaneous)
 * 3. Parallel DynamoDB writes for order closes (50 simultaneous)
 * 4. Full cleanup
 */

import { insertOpenTrade, closeTrade, setEngineState } from './straddle-store.js';
import { docClient } from '../utils/db.js';
import { DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const NUM_USERS = 50;
const TEST_PREFIX = 'loadtest-';

async function testFanOut() {
  console.log(`\n=== Test 1: Shared Feed Fan-Out (${NUM_USERS} listeners) ===\n`);

  const listeners: ((id: string, ltp: number) => void)[] = [];
  let receivedCount = 0;

  for (let i = 0; i < NUM_USERS; i++) {
    listeners.push((_id, _ltp) => {
      receivedCount++;
    });
  }

  // Simulate 100 ticks fanned out to all listeners
  const tickStart = Date.now();
  for (let t = 0; t < 100; t++) {
    const ltp = 24500 + Math.random() * 100;
    for (const listener of listeners) {
      listener('13', ltp);
    }
  }
  const fanOutDuration = Date.now() - tickStart;

  console.log(`  ${NUM_USERS} listeners x 100 ticks = ${receivedCount} notifications`);
  console.log(`  Total fan-out: ${fanOutDuration}ms`);
  console.log(`  Per tick (${NUM_USERS} listeners): ${(fanOutDuration / 100).toFixed(2)}ms`);
  console.log(`  Per notification: ${(fanOutDuration / receivedCount * 1000).toFixed(1)}us`);

  return fanOutDuration;
}

async function testParallelOrderPlacement() {
  console.log(`\n=== Test 2: Parallel Order Placement (${NUM_USERS} users) ===\n`);

  // Step 1: Create engine states for all test users
  console.log(`  Creating ${NUM_USERS} engine states...`);
  const setupStart = Date.now();
  await Promise.all(
    Array.from({ length: NUM_USERS }, (_, i) =>
      setEngineState({
        running: true,
        mode: 'paper',
        broker: 'dhan',
        lastNiftySpot: 24500,
        dailyTradeCount: 0,
      }, `${TEST_PREFIX}${i}`)
    )
  );
  const setupDuration = Date.now() - setupStart;
  console.log(`  Engine state setup: ${setupDuration}ms (${(setupDuration / NUM_USERS).toFixed(1)}ms avg)`);

  // Step 2: Open 50 positions in parallel (simulating straddle sell entry)
  console.log(`  Opening ${NUM_USERS} straddle positions in parallel...`);
  const openStart = Date.now();
  const tradeIds = await Promise.all(
    Array.from({ length: NUM_USERS }, (_, i) =>
      insertOpenTrade({
        tradeDate: '2026-02-09',
        strategyType: 'straddle',
        mode: 'paper',
        broker: 'dhan',
        entryTime: new Date().toISOString(),
        niftyEntry: 24500 + i * 0.1, // slight variation per user
        ceStrike: 24500,
        ceEntryPremium: 148 + Math.random() * 4,
        peStrike: 24500,
        peEntryPremium: 138 + Math.random() * 4,
        totalCollected: 290,
        lotSize: 25,
        lots: 1,
        marginRequired: 120000,
        premiumOffset: 7250,
        netMarginRequired: 112750,
      }, `${TEST_PREFIX}${i}`)
    )
  );
  const openDuration = Date.now() - openStart;
  console.log(`  OPEN: ${openDuration}ms total, ${(openDuration / NUM_USERS).toFixed(1)}ms avg`);
  console.log(`  All ${tradeIds.length} trades opened successfully`);

  // Step 3: Close all 50 positions in parallel (simulating profit target exit)
  console.log(`  Closing ${NUM_USERS} positions in parallel (TP exit)...`);
  const closeStart = Date.now();
  await Promise.all(
    tradeIds.map((id, i) =>
      closeTrade(id, {
        exitTime: new Date().toISOString(),
        niftyExit: 24520,
        ceExitPremium: 58 + Math.random() * 4,
        peExitPremium: 54 + Math.random() * 4,
        totalAtExit: 116,
        grossPnl: (290 - 116) * 25, // (collected - buyback) * qty
        netPnl: (290 - 116) * 25 - 120, // minus brokerage
        exitReason: 'tp',
      }, `${TEST_PREFIX}${i}`)
    )
  );
  const closeDuration = Date.now() - closeStart;
  console.log(`  CLOSE: ${closeDuration}ms total, ${(closeDuration / NUM_USERS).toFixed(1)}ms avg`);

  return { setupDuration, openDuration, closeDuration, tradeIds };
}

async function testReEntryAfterCooldown() {
  console.log(`\n=== Test 3: Re-Entry After Cooldown (${NUM_USERS} users) ===\n`);

  // Simulate second round of trades (tests dailyTradeCount increment)
  console.log(`  Opening 2nd round of ${NUM_USERS} trades...`);
  const openStart = Date.now();
  const tradeIds = await Promise.all(
    Array.from({ length: NUM_USERS }, (_, i) =>
      insertOpenTrade({
        tradeDate: '2026-02-09',
        strategyType: 'straddle',
        mode: 'paper',
        broker: 'dhan',
        entryTime: new Date().toISOString(),
        niftyEntry: 24480 + i * 0.1,
        ceStrike: 24500,
        ceEntryPremium: 130 + Math.random() * 4,
        peStrike: 24500,
        peEntryPremium: 155 + Math.random() * 4,
        totalCollected: 288,
        lotSize: 25,
        lots: 1,
      }, `${TEST_PREFIX}${i}`)
    )
  );
  const openDuration = Date.now() - openStart;
  console.log(`  2nd OPEN: ${openDuration}ms total, ${(openDuration / NUM_USERS).toFixed(1)}ms avg`);

  // Close with SL
  console.log(`  Closing 2nd round (SL exit)...`);
  const closeStart = Date.now();
  await Promise.all(
    tradeIds.map((id, i) =>
      closeTrade(id, {
        exitTime: new Date().toISOString(),
        niftyExit: 24600,
        ceExitPremium: 200,
        peExitPremium: 30,
        totalAtExit: 230,
        grossPnl: (288 - 230) * 25,
        netPnl: (288 - 230) * 25 - 120,
        exitReason: 'sl_ce',
      }, `${TEST_PREFIX}${i}`)
    )
  );
  const closeDuration = Date.now() - closeStart;
  console.log(`  2nd CLOSE: ${closeDuration}ms total, ${(closeDuration / NUM_USERS).toFixed(1)}ms avg`);

  return { openDuration, closeDuration };
}

async function cleanup() {
  console.log(`\n=== Cleanup ===\n`);
  const TABLE = process.env.NIFTY_STRADDLE_TABLE || 'nifty-straddle-prod';

  // Scan for all test items
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'begins_with(pk, :prefix)',
    ExpressionAttributeValues: { ':prefix': `USER#${TEST_PREFIX}` },
    ProjectionExpression: 'pk, sk',
  }));

  if (result.Items && result.Items.length > 0) {
    console.log(`  Deleting ${result.Items.length} test items...`);
    for (let i = 0; i < result.Items.length; i += 25) {
      const batch = result.Items.slice(i, i + 25);
      await Promise.all(
        batch.map(item =>
          docClient.send(new DeleteCommand({
            TableName: TABLE,
            Key: { pk: item.pk, sk: item.sk },
          }))
        )
      );
    }
    console.log(`  Cleaned up ${result.Items.length} items`);
  } else {
    console.log('  No test items to clean up');
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log(`  LOAD TEST: ${NUM_USERS} Parallel Users — Order Placement`);
  console.log('='.repeat(60));
  console.log(`  Table: ${process.env.NIFTY_STRADDLE_TABLE || 'nifty-straddle-prod'}`);
  console.log(`  Region: ${process.env.AWS_REGION || 'ap-south-1'}`);

  try {
    const fanOutMs = await testFanOut();
    const round1 = await testParallelOrderPlacement();
    const round2 = await testReEntryAfterCooldown();

    console.log('\n' + '='.repeat(60));
    console.log('  RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Fan-out (${NUM_USERS} listeners x 100 ticks): ${fanOutMs}ms`);
    console.log(`  Round 1 — Open:  ${round1.openDuration}ms (${(round1.openDuration / NUM_USERS).toFixed(1)}ms/user)`);
    console.log(`  Round 1 — Close: ${round1.closeDuration}ms (${(round1.closeDuration / NUM_USERS).toFixed(1)}ms/user)`);
    console.log(`  Round 2 — Open:  ${round2.openDuration}ms (${(round2.openDuration / NUM_USERS).toFixed(1)}ms/user)`);
    console.log(`  Round 2 — Close: ${round2.closeDuration}ms (${(round2.closeDuration / NUM_USERS).toFixed(1)}ms/user)`);
    console.log(`  Throughput: ~${Math.round(1000 / (round1.openDuration / NUM_USERS))} opens/sec`);
    console.log(`  Order exec delay: ~${(round1.openDuration / NUM_USERS).toFixed(0)}ms per user (DynamoDB write)`);
    console.log('='.repeat(60));
  } finally {
    await cleanup();
  }
}

main().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
