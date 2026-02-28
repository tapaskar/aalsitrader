/**
 * Theta Agent Lambda Handler - Macro Watcher
 * Scans global macro data (VIX, DXY, crude, yields) and produces risk score.
 */

import {
  AgentEvent,
  agents,
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
  const agent = agents.find((a) => a.id === 'theta')!;
  const date = new Date(timestamp).toISOString().split('T')[0];

  // Skip if not scheduled for this execution
  if (!isScheduled(event, 'theta')) {
    return { agentId: 'theta', executionId, timestamp, skipped: true };
  }

  await updateAgentState(agent.id, 'active', 'Scanning global macro data...', timestamp);

  // Fetch real macro data from Yahoo Finance
  const macroSymbols = [
    { key: 'VIX', symbol: '^VIX' },
    { key: 'DXY', symbol: 'DX-Y.NYB' },
    { key: 'Gold', symbol: 'GC=F' },
    { key: 'Crude', symbol: 'CL=F' },
    { key: 'US10Y', symbol: '^TNX' },
    { key: 'SPX', symbol: '^GSPC' },
    { key: 'USDINR', symbol: 'USDINR=X' },
    { key: 'IndiaVIX', symbol: '^INDIAVIX' },
  ];

  const macroData: Record<string, { price: number; change: number }> = {};

  await Promise.all(
    macroSymbols.map(async ({ key, symbol }) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const data = (await res.json()) as any;
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta) {
          const price = meta.regularMarketPrice || 0;
          const prevClose =
            meta.chartPreviousClose || meta.previousClose || price;
          macroData[key] = {
            price: Math.round(price * 100) / 100,
            change:
              Math.round(
                ((price - prevClose) / prevClose) * 10000
              ) / 100,
          };
        }
      } catch {
        /* skip */
      }
    })
  );

  const macroSummary = Object.entries(macroData)
    .map(
      ([k, v]) =>
        `${k}: ${v.price} (${v.change >= 0 ? '+' : ''}${v.change}%)`
    )
    .join(', ');

  let cleanAnalysis = '';
  let activityType = 'info';
  let riskScore = 5;

  if (Object.keys(macroData).length > 0) {
    const prompt = `You are Macro, a macro watcher for Indian stock markets. Analyze this real-time global data and produce a 2-3 line macro assessment with a risk-on/risk-off score (1-10).

${macroSummary}

Context: Track VIX (fear gauge), DXY (dollar strength hurts FII flows), crude (impacts India inflation), US10Y (global liquidity), India VIX, USDINR.
Respond with ONLY the analysis. Start with [RISK-ON X/10] or [RISK-OFF X/10].`;

    const analysis = await callAgent('theta', executionId, prompt, prompt);
    const isRiskOff = analysis.toLowerCase().includes('risk-off');
    cleanAnalysis = analysis.replace(
      /\[RISK-(ON|OFF)\s*\d+\/10\]\s*/gi,
      ''
    );
    const scoreMatch = analysis.match(/(\d+)\/10/);
    riskScore = scoreMatch ? parseInt(scoreMatch[1]) : 5;

    activityType = isRiskOff && riskScore <= 4 ? 'warning' : 'info';
    await postActivity(
      agent,
      activityType,
      `Risk Score: ${riskScore}/10. ${cleanAnalysis}`,
      ['Macro', 'Global', isRiskOff ? 'Risk-Off' : 'Risk-On'],
      timestamp
    );

    // Alert if macro deteriorating
    if (riskScore <= 3) {
      const gamma = agents.find((a) => a.id === 'gamma')!;
      await postComm(
        agent,
        gamma,
        `Macro risk-off signal at ${riskScore}/10. Consider reducing position sizes.`,
        timestamp
      );
    }
  } else {
    cleanAnalysis =
      'Global macro scan in progress. Monitoring VIX, DXY, crude oil, and FII flow data.';
    await postActivity(
      agent,
      'info',
      cleanAnalysis,
      ['Macro', 'Global'],
      timestamp
    );
  }

  const output: AgentOutput = {
    agentId: 'theta',
    executionId,
    timestamp,
    date,
    analysis: cleanAnalysis,
    alertType: activityType,
    tags: ['Macro', 'Global'],
    metadata: { macroData, riskScore },
    interAgentMessages:
      riskScore <= 3
        ? [
            {
              toAgentId: 'gamma',
              content: `Macro risk-off signal at ${riskScore}/10. Consider reducing position sizes.`,
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
