/**
 * Trial Expiration Reminder Lambda
 * Triggered by EventBridge daily at 9 AM IST (cron(30 3 ? * * *))
 * Sends reminder emails to trial users whose trial expires in 1 or 2 days
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { sendTrialExpiringEmail } from './utils/email.js';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const STAGE = process.env.STAGE || 'prod';
const USERS_TABLE = process.env.USERS_TABLE || `users-${STAGE}`;

interface TrialUser {
  email: string;
  username: string;
  trialEndsAt: string;
}

async function getExpiringTrialUsers(): Promise<TrialUser[]> {
  const now = new Date();
  const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const users: TrialUser[] = [];
  let lastKey: any = undefined;

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: [
        'sk = :sk',
        'planStatus = :trial',
        'attribute_exists(trialEndsAt)',
        'trialEndsAt <= :twoDays',
        'trialEndsAt > :now',
        '(attribute_not_exists(emailOptOut) OR emailOptOut = :false)',
        '(attribute_not_exists(accountEnabled) OR accountEnabled = :true)',
      ].join(' AND '),
      ExpressionAttributeValues: {
        ':sk': 'PROFILE',
        ':trial': 'trial',
        ':twoDays': twoDaysLater.toISOString(),
        ':now': now.toISOString(),
        ':false': false,
        ':true': true,
      },
      ProjectionExpression: 'email, username, trialEndsAt',
      ExclusiveStartKey: lastKey,
    }));

    if (result.Items) {
      for (const item of result.Items) {
        if (item.email && item.username && item.trialEndsAt) {
          users.push({
            email: item.email as string,
            username: item.username as string,
            trialEndsAt: item.trialEndsAt as string,
          });
        }
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return users;
}

export const handler = async (): Promise<void> => {
  console.log('[TrialReminder] Starting trial expiration reminder check...');

  const users = await getExpiringTrialUsers();
  console.log(`[TrialReminder] Found ${users.length} trial users expiring within 2 days`);

  if (users.length === 0) {
    console.log('[TrialReminder] No expiring trials. Done.');
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await sendTrialExpiringEmail(user.email, user.username, user.trialEndsAt);
      sent++;
    } catch (err) {
      console.error(`[TrialReminder] Failed to send to ${user.email}:`, err);
      failed++;
    }

    // Small delay to stay within SES rate limits
    if (sent % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[TrialReminder] Complete. Sent: ${sent}, Failed: ${failed}, Total: ${users.length}`);
};
