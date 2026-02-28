/**
 * One-time script: Send welcome email to all existing users who haven't received it.
 * Run: node send-welcome-blast.mjs
 */
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const REGION = 'ap-south-1';
const ses = new SESClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const FROM_EMAIL = '"AalsiTrader" <support@aalsitrader.com>';
const APP_URL = 'https://aalsitrader.com';

// Skip test accounts
const SKIP_EMAILS = ['testbroker@test.com', 'testbroker2@test.com'];

function buildWelcomeHtml(username, email) {
  const agentStyle = 'padding:12px 16px;border-radius:6px;margin:0 0 8px';
  const nameStyle = 'font-weight:600;font-size:14px;margin:0 0 4px';
  const descStyle = 'color:#6b7280;font-size:13px;margin:0;line-height:1.5';

  const body = `
    <h2 style="margin:0 0 16px;color:#18181b;font-size:24px">Welcome to AalsiTrader, ${username}!</h2>
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">
      Your account has been created and your <strong>7-day Pro trial</strong> is now active.
      Here's everything at your disposal.
    </p>

    <h3 style="margin:0 0 12px;color:#18181b;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px">AI Trading Squad — 6 Agents</h3>

    <div style="background:#fff0f0;${agentStyle}">
      <p style="${nameStyle};color:#ff6b6b">Professor (α) — Research Agent</p>
      <p style="${descStyle}">Reads news, corporate fundamentals, earnings, and macro events. Builds market context and fundamental outlook for every stock the squad is watching.</p>
    </div>
    <div style="background:#f0fffe;${agentStyle}">
      <p style="${nameStyle};color:#4ecdc4">Techno-Kid (β) — Technical Analyst</p>
      <p style="${descStyle}">Analyses charts, RSI, MACD, SuperTrend, Bollinger Bands, and support/resistance levels to spot high-probability entries and exits across F&O stocks.</p>
    </div>
    <div style="background:#faf5ff;${agentStyle}">
      <p style="${nameStyle};color:#a855f7">Risko-Frisco (γ) — Risk Manager</p>
      <p style="${descStyle}">Monitors portfolio exposure, position sizing, and drawdown. Reviews every proposed trade against your risk rules before Prime gives the final green light.</p>
    </div>
    <div style="background:#fff8f0;${agentStyle}">
      <p style="${nameStyle};color:#f97316">Macro (θ) — Macro Watcher</p>
      <p style="${descStyle}">Tracks RBI policy, FII/DII flows, global triggers, and macroeconomic data. Flags macro-level events that could shift overall market direction.</p>
    </div>
    <div style="background:#eff6ff;${agentStyle}">
      <p style="${nameStyle};color:#3b82f6">Booky (δ) — Trade Journal</p>
      <p style="${descStyle}">Records every trade, tracks P&L, win rate, average holding period, and drawdown. Builds your complete trading history over time.</p>
    </div>
    <div style="background:#f0fdf4;${agentStyle}">
      <p style="${nameStyle};color:#10b981">Prime (Σ) — Trade Hunter</p>
      <p style="${descStyle}">The chief strategist. Synthesises signals from all agents, hunts for high-conviction trade setups, and approves or vetoes trades. Chat with Prime directly for market analysis and ideas.</p>
    </div>

    <h3 style="margin:24px 0 12px;color:#18181b;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px">Platform Services</h3>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">
      <tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">
        <strong style="color:#18181b">Nifty Scalper</strong>
        <p style="${descStyle}">Autonomous options scalping engine. Auto-selects between straddles, strangles, and iron condors based on market conditions. Paper or live mode.</p>
      </td></tr>
      <tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">
        <strong style="color:#18181b">Smart Money Screener</strong>
        <p style="${descStyle}">Institutional activity scanner with bulk/block deal tracking, FII/DII flow analysis, and unusual volume detection across NSE & BSE.</p>
      </td></tr>
      <tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">
        <strong style="color:#18181b">Broker Portfolio</strong>
        <p style="${descStyle}">Real-time view of your broker holdings, positions, and P&L. Supports Zerodha, DhanHQ, Motilal, AngelOne, and Upstox.</p>
      </td></tr>
      <tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">
        <strong style="color:#18181b">Prime Intelligence Chat</strong>
        <p style="${descStyle}">Chat directly with Prime for market analysis, trade ideas, and macro insights powered by real-time data from all agents.</p>
      </td></tr>
      <tr><td style="padding:8px 12px">
        <strong style="color:#18181b">Paper Trading</strong>
        <p style="${descStyle}">Test strategies risk-free with simulated trades. Full performance analytics, equity curves, and trade journals.</p>
      </td></tr>
    </table>

    <a href="${APP_URL}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:500">Open Dashboard</a>
    <p style="color:#6b7280;font-size:13px;margin:16px 0 0;line-height:1.5">
      Your Pro trial gives you full access to all agents and services for 7 days. After that, the Free plan continues with the Smart Money Screener and paper trading.
    </p>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <tr><td style="background:#18181b;padding:24px 32px">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">AalsiTrader</h1>
        </td></tr>
        <tr><td style="padding:32px">${body}</td></tr>
        <tr><td style="padding:24px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center">
          <p style="margin:0 0 8px;color:#6b7280;font-size:12px">You received this email because you have an account on AalsiTrader.</p>
          <a href="${APP_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#6b7280;font-size:12px;text-decoration:underline">Unsubscribe from emails</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function main() {
  // 1. Scan all users
  const result = await ddb.send(new ScanCommand({
    TableName: 'users-prod',
    FilterExpression: 'sk = :sk',
    ExpressionAttributeValues: { ':sk': 'PROFILE' },
    ProjectionExpression: 'pk, email, username, emailOptOut, accountEnabled, welcomeEmailSent',
  }));

  const users = result.Items || [];
  console.log(`Found ${users.length} users total`);

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const email = user.email;
    const username = user.username || email.split('@')[0];

    // Skip test accounts
    if (SKIP_EMAILS.includes(email)) {
      console.log(`  SKIP (test): ${email}`);
      skipped++;
      continue;
    }

    // Skip opted-out users
    if (user.emailOptOut === true) {
      console.log(`  SKIP (opted out): ${email}`);
      skipped++;
      continue;
    }

    // Skip disabled accounts
    if (user.accountEnabled === false) {
      console.log(`  SKIP (disabled): ${email}`);
      skipped++;
      continue;
    }

    // Skip if already sent
    if (user.welcomeEmailSent === true) {
      console.log(`  SKIP (already sent): ${email}`);
      skipped++;
      continue;
    }

    // Send welcome email
    try {
      const html = buildWelcomeHtml(username, email);
      await ses.send(new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: 'Welcome to AalsiTrader!', Charset: 'UTF-8' },
          Body: { Html: { Data: html, Charset: 'UTF-8' } },
        },
      }));

      // Mark as sent in DynamoDB
      await ddb.send(new UpdateCommand({
        TableName: 'users-prod',
        Key: { pk: user.pk, sk: 'PROFILE' },
        UpdateExpression: 'SET welcomeEmailSent = :sent, welcomeEmailSentAt = :at',
        ExpressionAttributeValues: { ':sent': true, ':at': Date.now() },
      }));

      console.log(`  SENT: ${email} (${username})`);
      sent++;

      // 1s delay between sends to respect SES rate limits
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  FAILED: ${email} — ${err.message}`);
    }
  }

  console.log(`\nDone! Sent: ${sent}, Skipped: ${skipped}`);
}

main().catch(console.error);
