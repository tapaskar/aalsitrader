/**
 * Weekly Market Digest Lambda
 * Triggered by EventBridge every Monday 9 AM IST (cron(30 3 ? * MON *))
 * Sends market insight emails to inactive users (2+ weeks without login)
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { sendWeeklyInsightEmail } from './utils/email.js';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const STAGE = process.env.STAGE || 'prod';
const USERS_TABLE = process.env.USERS_TABLE || `users-${STAGE}`;
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

async function getMarketInsight(): Promise<string> {
  const prompt = `You are Prime (Σ), the lead AI trading agent at AalsiTrader — an Indian stock market trading platform.

Provide ONE interesting and actionable market observation about Indian markets (NSE/BSE) and macro environment for this week. Consider:
- Recent Nifty/Sensex trends and key support/resistance levels
- Any notable FII/DII activity patterns
- Sector rotation or emerging themes
- Global macro factors affecting Indian markets (US Fed, crude oil, dollar index)
- Upcoming events (earnings season, RBI policy, etc.)

Keep it concise (3-4 sentences). Be specific with numbers where possible. End with a brief actionable takeaway.
Format the response as plain text without any markdown or special formatting.`;

  const models = [
    { id: 'apac.amazon.nova-lite-v1:0', format: 'nova' as const },
    { id: 'apac.anthropic.claude-3-haiku-20240307-v1:0', format: 'claude' as const },
  ];

  for (const model of models) {
    try {
      let requestBody: string;
      if (model.format === 'nova') {
        requestBody = JSON.stringify({
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 300, temperature: 0.7 },
        });
      } else {
        requestBody = JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });
      }

      const response = await bedrockClient.send(
        new InvokeModelCommand({
          modelId: model.id,
          contentType: 'application/json',
          accept: 'application/json',
          body: requestBody,
        })
      );

      const result = JSON.parse(new TextDecoder().decode(response.body));
      const text = model.format === 'nova'
        ? result.output?.message?.content?.[0]?.text || ''
        : result.content?.[0]?.text || '';

      if (text) return text;
    } catch (err: any) {
      console.error(`[WeeklyDigest] Bedrock ${model.id} failed:`, err.message || err);
      continue;
    }
  }

  return 'Markets continue to present interesting opportunities. Stay tuned to your AI trading squad for real-time analysis and signals.';
}

async function getInactiveUsers(): Promise<Array<{ email: string; username: string }>> {
  const cutoff = Date.now() - TWO_WEEKS_MS;
  const users: Array<{ email: string; username: string }> = [];
  let lastKey: any = undefined;

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'sk = :sk AND (attribute_not_exists(emailOptOut) OR emailOptOut = :false) AND (attribute_not_exists(accountEnabled) OR accountEnabled = :true) AND (attribute_not_exists(lastActive) OR lastActive < :cutoff)',
      ExpressionAttributeValues: {
        ':sk': 'PROFILE',
        ':false': false,
        ':true': true,
        ':cutoff': cutoff,
      },
      ProjectionExpression: 'email, username',
      ExclusiveStartKey: lastKey,
    }));

    if (result.Items) {
      for (const item of result.Items) {
        if (item.email && item.username) {
          users.push({ email: item.email as string, username: item.username as string });
        }
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return users;
}

export const handler = async (): Promise<void> => {
  console.log('[WeeklyDigest] Starting weekly market digest...');

  // Get market insight from AI
  const insight = await getMarketInsight();
  console.log(`[WeeklyDigest] Generated insight: ${insight.substring(0, 100)}...`);

  // Get inactive users who haven't opted out
  const users = await getInactiveUsers();
  console.log(`[WeeklyDigest] Found ${users.length} inactive users to email`);

  if (users.length === 0) {
    console.log('[WeeklyDigest] No inactive users to email. Done.');
    return;
  }

  // Send emails (batch with small delays to avoid SES throttling)
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await sendWeeklyInsightEmail(user.email, user.username, insight);
      sent++;
    } catch (err) {
      console.error(`[WeeklyDigest] Failed to send to ${user.email}:`, err);
      failed++;
    }

    // Small delay to stay within SES rate limits (14/sec in sandbox, higher in production)
    if (sent % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[WeeklyDigest] Complete. Sent: ${sent}, Failed: ${failed}, Total: ${users.length}`);
};
