/**
 * Delta Agent Lambda Handler - Trade Journal (Booky)
 * Compiles trade journal entries and performance summaries.
 */

import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { InvokeCommand } from '@aws-sdk/client-lambda';
import { docClient, TableNames } from '../utils/db.js';
import {
  AgentEvent,
  agents,
  callAgent,
  postActivity,
  updateAgentState,
  sleepAgent,
  lambdaClient,
  isScheduled,
} from './shared.js';
import { saveAgentOutput, AgentOutput } from '../utils/agent-memory.js';

export const handler = async (event: AgentEvent) => {
  const { executionId, timestamp: tsInput } = event;
  const timestamp = typeof tsInput === 'number' ? tsInput : Date.now();
  const agent = agents.find((a) => a.id === 'delta')!;
  const date = new Date(timestamp).toISOString().split('T')[0];

  // Skip if not scheduled for this execution
  if (!isScheduled(event, 'delta')) {
    return { agentId: 'delta', executionId, timestamp, skipped: true };
  }

  await updateAgentState(agent.id, 'active', 'Compiling trade journal...', timestamp);

  // Get paper trades from momentum-trades table
  let paperTrades: any[] = [];
  let paperPortfolio: any = null;
  try {
    const paperRes = await docClient.send(new ScanCommand({
      TableName: TableNames.momentumTrades,
      Limit: 50,
    }));
    paperTrades = (paperRes.Items || []).filter((t: any) => t.pk?.includes('TRADE'));
  } catch (err) {
    console.log('Paper trades fetch failed:', err);
  }

  // Get paper portfolio
  try {
    const portRes = await docClient.send(new ScanCommand({
      TableName: TableNames.momentumPortfolio,
      Limit: 5,
    }));
    const portItems = (portRes.Items || []).sort((a: any, b: any) => (b.sk || '').localeCompare(a.sk || ''));
    paperPortfolio = portItems[0] || null;
  } catch (err) {
    console.log('Paper portfolio fetch failed:', err);
  }

  const openTrades = paperTrades.filter((t: any) => t.status === 'open' || t.sk?.includes('STATUS#open'));
  const closedTrades = paperTrades.filter((t: any) => t.status === 'closed' || t.sk?.includes('STATUS#closed'));
  const wins = closedTrades.filter((t: any) => (t.netPnL || t.pnl || 0) > 0);
  const totalPnl = closedTrades.reduce((sum: number, t: any) => sum + (t.netPnL || t.pnl || 0), 0);
  const winRate = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0;

  const capital = paperPortfolio?.capital || 1000000;
  const portfolioPnl = paperPortfolio?.totalPnl || totalPnl;
  const maxDrawdown = paperPortfolio?.maxDrawdown || 0;

  const prompt = `You are Booky, a trade journal agent for a paper trading portfolio. Produce a concise 2-3 line performance summary.

Paper Trading Portfolio:
- Capital: ₹${capital.toLocaleString()} (Starting: ₹10,00,000)
- Total Trades: ${paperTrades.length} (${openTrades.length} open, ${closedTrades.length} closed)
- Win Rate: ${winRate}% (${wins.length}W / ${closedTrades.length - wins.length}L)
- Total P&L: ₹${portfolioPnl.toFixed(0)}
- Max Drawdown: ${maxDrawdown.toFixed(1)}%

Focus on process quality, rule adherence, and lessons. Be brutally honest about the track record.
Respond with ONLY the journal entry.`;

  const analysis = await callAgent('delta', executionId, prompt, prompt);
  const activityType = portfolioPnl >= 0 ? 'success' : 'info';
  await postActivity(agent, activityType, analysis, ['Journal', 'Stats', 'Paper'], timestamp, {
    totalTrades: paperTrades.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    winRate,
    totalPnl: portfolioPnl,
    capital,
    maxDrawdown,
  });

  const output: AgentOutput = {
    agentId: 'delta',
    executionId,
    timestamp,
    date,
    analysis,
    alertType: activityType,
    tags: ['Journal', 'Stats', 'Paper'],
    metadata: {
      totalTrades: paperTrades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      winRate,
      totalPnl: portfolioPnl,
      capital,
      maxDrawdown,
    },
    interAgentMessages: [],
  };
  await saveAgentOutput(output);

  if (Math.random() < 0.3) {
    await sleepAgent(agent, timestamp);
  }

  return output;
};
