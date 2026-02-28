/**
 * Gamma Agent Lambda Handler - Risk Manager
 * Monitors portfolio risk, checks positions, enforces risk limits.
 */

import { InvokeCommand } from '@aws-sdk/client-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TableNames } from '../utils/db.js';
import {
  AgentEvent,
  agents,
  lambdaClient,
  callAgent,
  postActivity,
  postComm,
  updateAgentState,
  sleepAgent,
  isScheduled,
} from './shared.js';
import { saveAgentOutput, AgentOutput } from '../utils/agent-memory.js';

export const handler = async (event: AgentEvent) => {
  const { executionId, timestamp: tsInput } = event;
  const timestamp = typeof tsInput === 'number' ? tsInput : Date.now();
  const agent = agents.find((a) => a.id === 'gamma')!;
  const date = new Date(timestamp).toISOString().split('T')[0];

  // Skip if not scheduled for this execution
  if (!isScheduled(event, 'gamma')) {
    return { agentId: 'gamma', executionId, timestamp, skipped: true };
  }

  await updateAgentState(agent.id, 'active', 'Checking portfolio risk...', timestamp);

  let positions: any = null;
  let margins: any = null;

  // Get real positions from Zerodha
  try {
    const posRes = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: 'zerodha-trading-api',
        Payload: Buffer.from(JSON.stringify({ action: 'get_positions' })),
      })
    );
    const posResult = JSON.parse(new TextDecoder().decode(posRes.Payload));
    const posBody =
      typeof posResult.body === 'string'
        ? JSON.parse(posResult.body)
        : posResult;
    if (!posBody.error) positions = posBody.positions;
  } catch (err) {
    console.log('Zerodha positions fetch failed:', err);
  }

  // Get margins
  try {
    const marginRes = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: 'zerodha-trading-api',
        Payload: Buffer.from(JSON.stringify({ action: 'get_margins' })),
      })
    );
    const marginResult = JSON.parse(
      new TextDecoder().decode(marginRes.Payload)
    );
    const marginBody =
      typeof marginResult.body === 'string'
        ? JSON.parse(marginResult.body)
        : marginResult;
    if (!marginBody.error) margins = marginBody.margins;
  } catch (err) {
    console.log('Zerodha margins fetch failed:', err);
  }

  let cleanAnalysis = '';
  let riskType = 'warning';

  if (positions || margins) {
    const netPositions = positions?.net || [];
    const dayPositions = positions?.day || [];
    const equity = margins?.equity || {};

    const openPositions = netPositions.filter((p: any) => p.quantity !== 0);
    const totalPnl = netPositions.reduce(
      (sum: number, p: any) => sum + (p.pnl || 0),
      0
    );
    const availableMargin =
      equity?.available?.live_balance || equity?.available?.cash || 0;

    const prompt = `You are Risko-Frisco (Gamma), the RISK MANAGER for an Indian F&O trading squad.

RULES:
- Write a 2-3 line risk status update with SPECIFIC numbers (₹ amounts, percentages, position counts)
- NEVER output just a score like "Risk Score: 5/10" — always explain WHY in plain language
- NEVER say "monitoring" or "scanning" — report the CURRENT state
- Mention: margin utilization, P&L status, and whether it's safe to take new trades
- If no open positions, say portfolio is fully in cash and ready for new setups

Portfolio Data:
- Open Positions: ${openPositions.length}
- Day Trades: ${dayPositions.length}
- Unrealized P&L: ₹${totalPnl.toFixed(0)}
- Available Margin: ₹${availableMargin.toFixed(0)}
- Portfolio Heat: ${openPositions.length > 0 ? 'Active' : '0% (all cash)'}

Risk Limits: 2% max risk per trade, 6% max monthly loss, no position >15% of portfolio.
Start with: [SAFE], [CAUTION], or [DANGER]. Then the update.`;

    const analysis = await callAgent('gamma', executionId, prompt, prompt);
    riskType = analysis.includes('[DANGER]')
      ? 'alert'
      : analysis.includes('[CAUTION]')
        ? 'warning'
        : 'success';
    cleanAnalysis = analysis.replace(/\[(SAFE|CAUTION|DANGER)\]\s*/g, '');

    await postActivity(
      agent,
      riskType,
      cleanAnalysis,
      ['Risk', 'Portfolio'],
      timestamp
    );

    if (riskType === 'alert') {
      const sigma = agents.find((a) => a.id === 'sigma')!;
      await postComm(
        agent,
        sigma,
        'Risk limits approaching. Hold new positions until risk clears.',
        timestamp
      );
    }
  } else {
    // Fallback: assess risk from paper trading portfolio
    let paperOpenTrades: any[] = [];
    let paperPortfolio: any = null;
    try {
      const tradesRes = await docClient.send(new ScanCommand({
        TableName: TableNames.momentumTrades,
        FilterExpression: 'contains(sk, :open)',
        ExpressionAttributeValues: { ':open': 'STATUS#open' },
        Limit: 20,
      }));
      paperOpenTrades = (tradesRes.Items || []);

      const portRes = await docClient.send(new ScanCommand({
        TableName: TableNames.momentumPortfolio,
        Limit: 5,
      }));
      const portItems = (portRes.Items || []).sort((a: any, b: any) => (b.sk || '').localeCompare(a.sk || ''));
      paperPortfolio = portItems[0] || null;
    } catch (err) {
      console.log('Paper trade data fetch failed:', err);
    }

    if (paperPortfolio || paperOpenTrades.length > 0) {
      const capital = paperPortfolio?.capital || 1000000;
      const availableCapital = paperPortfolio?.availableCapital || capital;
      const totalPnl = paperPortfolio?.totalPnl || 0;
      const maxDrawdown = paperPortfolio?.maxDrawdown || 0;
      const openCount = paperOpenTrades.length;

      const prompt = `You are Risko-Frisco (Gamma), the RISK MANAGER for an Indian F&O paper trading squad.

RULES:
- Write a 2-3 line risk status update with SPECIFIC numbers (₹ amounts, percentages, position counts)
- NEVER output just a score like "Risk Score: 5/10" — always explain WHY in plain language
- NEVER mention Zerodha, broker connections, or API status — focus ONLY on portfolio risk
- NEVER say "monitoring" or "scanning" — report the CURRENT state
- Mention: capital utilization (% deployed), P&L vs starting capital, drawdown status, and whether safe to take new trades
- If drawdown > 3%, flag it. If P&L is positive, note the buffer.

Paper Trading Portfolio:
- Starting Capital: ₹10,00,000
- Current Capital: ₹${capital.toLocaleString('en-IN')}
- Available Capital: ₹${availableCapital.toLocaleString('en-IN')}
- Open Positions: ${openCount} of 3 max
- Total P&L: ₹${totalPnl.toFixed(0)} (${((totalPnl / 1000000) * 100).toFixed(1)}% return)
- Max Drawdown: ${maxDrawdown.toFixed(1)}% (limit: 5%)

Start with: [SAFE], [CAUTION], or [DANGER]. Then the update.`;

      const analysis = await callAgent('gamma', executionId, prompt, prompt);
      riskType = analysis.includes('[DANGER]')
        ? 'alert'
        : analysis.includes('[CAUTION]')
          ? 'warning'
          : 'success';
      cleanAnalysis = analysis.replace(/\[(SAFE|CAUTION|DANGER)\]\s*/g, '');
    } else {
      cleanAnalysis = 'No open positions. Portfolio at starting capital ₹10,00,000. All risk limits clear. Ready for new trades.';
      riskType = 'success';
    }

    await postActivity(
      agent,
      riskType,
      cleanAnalysis,
      ['Risk', 'Paper'],
      timestamp
    );
  }

  const output: AgentOutput = {
    agentId: 'gamma',
    executionId,
    timestamp,
    date,
    analysis: cleanAnalysis,
    alertType: riskType,
    tags: ['Risk', 'Portfolio'],
    metadata: {
      hasPositions: !!positions,
      hasMargins: !!margins,
    },
    interAgentMessages:
      riskType === 'alert'
        ? [
            {
              toAgentId: 'sigma',
              content:
                'Risk limits approaching. Hold new positions until risk clears.',
            },
          ]
        : [],
  };
  await saveAgentOutput(output);

  if (Math.random() < 0.3) {
    await sleepAgent(agent, timestamp);
  }

  return output;
};
