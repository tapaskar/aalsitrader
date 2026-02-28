/**
 * Sigma Agent Lambda Handler - Trade Hunter / Orchestrator (Prime)
 * Consults the squad, makes intelligent trade decisions, and broadcasts signals.
 */

import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { InvokeCommand } from '@aws-sdk/client-lambda';
import { docClient, TableNames } from '../utils/db.js';
import {
  AgentEvent,
  agents,
  watchlist,
  postActivity,
  postComm,
  updateAgentState,
  broadcastToAll,
  lambdaClient,
  isScheduled,
} from './shared.js';
import { saveAgentOutput, AgentOutput } from '../utils/agent-memory.js';
import {
  makeDecision,
  generateHumanSummary,
  getTodaysDecisions,
  storeThinking,
  storeChatMessage,
  DecisionMemory,
  PortfolioContext,
} from '../prime-intelligence.js';

export const handler = async (event: AgentEvent) => {
  const { executionId, timestamp: tsInput } = event;
  const timestamp = typeof tsInput === 'number' ? tsInput : Date.now();
  const agent = agents.find((a) => a.id === 'sigma')!;
  const date = new Date(timestamp).toISOString().split('T')[0];

  // Sigma always runs (orchestrator) but respect scheduledAgents if explicitly excluded
  if (!isScheduled(event, 'sigma')) {
    return { agentId: 'sigma', executionId, timestamp, skipped: true };
  }

  await updateAgentState(agent.id, 'active', 'Consulting the squad...', timestamp);

  // Pick a stock to analyze from watchlist (allow override via event for testing)
  const symbol = (event as any).symbol || watchlist[Math.floor(Math.random() * watchlist.length)];

  // Log thinking: Starting analysis
  await storeThinking({
    id: crypto.randomUUID(),
    symbol,
    phase: 'analysis',
    content: `Prime initiating analysis for ${symbol}. Will consult Professor, Techno-Kid, and Risko-Frisco.`,
    timestamp,
  });

  // Get technical data first to determine if there's a signal
  let techData: any = null;
  let hasSignal = false;
  let signal: 'BUY' | 'SELL' = 'BUY';
  let entryPrice = 0;
  let dataSource = 'zerodha';

  try {
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'zerodha-technical-indicators',
      Payload: Buffer.from(JSON.stringify({ symbol, days: 365 })),
    }));
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    techData = typeof result.body === 'string' ? JSON.parse(result.body) : result;

    if (techData && !techData.error) {
      entryPrice = techData.current_price || 0;
      if (techData.overall_signal === 'BUY' || techData.overall_signal === 'SELL') {
        hasSignal = true;
        signal = techData.overall_signal;
      }
    }
  } catch (err) {
    console.log('Technical data fetch failed:', err);
  }

  // Fallback: Yahoo Finance when Zerodha is unavailable
  if (!entryPrice || (techData?.error)) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?interval=1d&range=3mo`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = (await res.json()) as any;
      const chartResult = data?.chart?.result?.[0];
      const meta = chartResult?.meta;
      const closes: number[] = (chartResult?.indicators?.quote?.[0]?.close || []).filter((c: any) => c != null);
      const volumes: number[] = (chartResult?.indicators?.quote?.[0]?.volume || []).filter((v: any) => v != null);

      if (meta?.regularMarketPrice && closes.length >= 20) {
        dataSource = 'yahoo';
        entryPrice = meta.regularMarketPrice;

        // Compute RSI(14)
        const gains: number[] = [];
        const losses: number[] = [];
        for (let i = closes.length - 14; i < closes.length; i++) {
          const change = closes[i] - closes[i - 1];
          if (change > 0) gains.push(change);
          else losses.push(Math.abs(change));
        }
        const avgGain = gains.reduce((s, g) => s + g, 0) / 14;
        const avgLoss = losses.reduce((s, l) => s + l, 0) / 14 || 0.001;
        const rs = avgGain / avgLoss;
        const rsi = Math.round((100 - (100 / (1 + rs))) * 10) / 10;

        // Compute SMA(20) and SMA(50)
        const sma20 = closes.slice(-20).reduce((s, c) => s + c, 0) / 20;
        const sma50 = closes.length >= 50
          ? closes.slice(-50).reduce((s, c) => s + c, 0) / 50
          : sma20;

        // Trend detection
        const priceAboveSma20 = entryPrice > sma20;
        const sma20AboveSma50 = sma20 > sma50;
        const trend = priceAboveSma20 && sma20AboveSma50 ? 'uptrend'
          : !priceAboveSma20 && !sma20AboveSma50 ? 'downtrend' : 'sideways';

        // 5-day momentum
        const fiveDayMomentum = closes.length >= 6
          ? ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100
          : 0;

        // Support/Resistance from recent highs/lows
        const recent20 = closes.slice(-20);
        const support = Math.min(...recent20);
        const resistance = Math.max(...recent20);

        // Volume surge check
        const recentVolAvg = volumes.length >= 20
          ? volumes.slice(-20).reduce((s, v) => s + v, 0) / 20
          : 0;
        const latestVol = volumes[volumes.length - 1] || 0;
        const volumeSurge = recentVolAvg > 0 && latestVol > recentVolAvg * 1.5;

        // Determine overall signal
        let overallSignal = 'NEUTRAL';
        const bullishCount = [
          rsi < 40,
          trend === 'uptrend',
          fiveDayMomentum > 1,
          priceAboveSma20,
          volumeSurge && fiveDayMomentum > 0,
        ].filter(Boolean).length;
        const bearishCount = [
          rsi > 65,
          trend === 'downtrend',
          fiveDayMomentum < -1,
          !priceAboveSma20,
          volumeSurge && fiveDayMomentum < 0,
        ].filter(Boolean).length;

        if (bullishCount >= 3) overallSignal = 'BUY';
        else if (bearishCount >= 3) overallSignal = 'SELL';

        const rsiSignal = rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : rsi < 40 ? 'bullish' : rsi > 60 ? 'bearish' : 'neutral';

        techData = {
          current_price: entryPrice,
          change_percent: fiveDayMomentum,
          rsi: { value: rsi, signal: rsiSignal },
          trend: { trend, strength: Math.abs(fiveDayMomentum) > 3 ? 'strong' : 'moderate' },
          support_resistance: { support: Math.round(support * 100) / 100, resistance: Math.round(resistance * 100) / 100 },
          volume: { surge: volumeSurge },
          overall_signal: overallSignal,
          macd: { signal_interpretation: trend === 'uptrend' ? 'bullish' : trend === 'downtrend' ? 'bearish' : 'neutral' },
          sma20: Math.round(sma20 * 100) / 100,
          sma50: Math.round(sma50 * 100) / 100,
          dataSource: 'yahoo',
        };

        if (overallSignal === 'BUY' || overallSignal === 'SELL') {
          hasSignal = true;
          signal = overallSignal as 'BUY' | 'SELL';
        }

        console.log(`Yahoo fallback for ${symbol}: price=${entryPrice}, RSI=${rsi}, trend=${trend}, signal=${overallSignal}`);
      }
    } catch (err) {
      console.log('Yahoo Finance fallback failed:', err);
    }
  }

  let analysis = '';
  let activityType = 'info';
  const interAgentMessages: AgentOutput['interAgentMessages'] = [];

  if (!hasSignal || !entryPrice) {
    // No clear signal - report scanning status with whatever data we have
    const rsiStr = techData?.rsi?.value ? `RSI ${techData.rsi.value}` : 'RSI N/A';
    const trendStr = techData?.trend?.trend || 'N/A';
    const priceStr = entryPrice ? ` @ ₹${entryPrice}` : '';
    const srcStr = dataSource === 'yahoo' ? ' (Yahoo data)' : '';
    analysis = `Scanned ${symbol}${priceStr}: No clear entry signal. ${rsiStr}, Trend ${trendStr}${srcStr}. Continuing to monitor.`;
    await postActivity(agent, 'info', analysis, ['Hunt', 'Scanning', symbol], timestamp);
  } else {
    // We have a signal! Now consult the squad
    await updateAgentState(agent.id, 'active', `Consulting squad on ${symbol} ${signal}...`, timestamp);

    await postActivity(
      agent,
      'info',
      `Detected ${signal} signal on ${symbol} @ ₹${entryPrice}. Consulting Professor, Techno-Kid, and Risko-Frisco for analysis...`,
      ['Signal', symbol, signal],
      timestamp
    );

    // Fetch portfolio context so makeDecision has full visibility
    let portfolioContext: PortfolioContext | undefined;
    try {
      const { getPortfolioState, getOpenTrades } = await import('../momentum-trader/paper-trading.js');
      const [portfolio, openTrades] = await Promise.all([getPortfolioState(), getOpenTrades()]);
      const capitalUtilized = openTrades.reduce((sum: number, t: any) => sum + (t.entryPrice * t.lotSize * t.futuresLots), 0);
      const baseCapital = (portfolio.startingCapital || 1000000) + (portfolio.totalPnl || 0);
      portfolioContext = {
        openPositions: openTrades.length,
        todayPnL: portfolio.dailyPnl || 0,
        totalPnL: portfolio.totalPnl || 0,
        capitalUsed: capitalUtilized,
        availableCapital: baseCapital - capitalUtilized,
        winRate: portfolio.winRate || 0,
        maxDrawdown: portfolio.maxDrawdown || 0,
      };
    } catch (err) {
      console.warn('[Sigma] Could not fetch portfolio context:', (err as any).message);
    }

    // Make the intelligent decision (this consults all agents)
    let decision: DecisionMemory;
    try {
      decision = await makeDecision(symbol, signal, entryPrice, techData, undefined, undefined, portfolioContext);
    } catch (err) {
      console.error('Decision making failed:', err);
      analysis = `Error during decision process for ${symbol}. Will retry next cycle.`;
      await postActivity(agent, 'warning', analysis, ['Error', symbol], timestamp);

      const output: AgentOutput = {
        agentId: 'sigma',
        executionId,
        timestamp,
        date,
        analysis,
        alertType: 'warning',
        tags: ['Error', symbol],
        metadata: { symbol, error: true },
        interAgentMessages: [],
      };
      await saveAgentOutput(output);
      return output;
    }

    // Post consultation communications to show the squad discussion
    for (const consultation of decision.consultations) {
      const fromAgent = agents.find(a => a.id === consultation.agentId);
      if (fromAgent) {
        await postComm(
          fromAgent,
          agent,
          consultation.response.slice(0, 200) + (consultation.response.length > 200 ? '...' : ''),
          timestamp + 100
        );
      }
    }

    // Post Prime's decision and rationale
    activityType = decision.action === 'ENTER' ? 'success' : decision.action === 'HOLD' ? 'warning' : 'info';
    analysis = `${symbol} ${signal} Decision: ${decision.action} (${decision.confidence}% confidence)\n\nRationale: ${decision.rationale}`;

    await postActivity(
      agent,
      activityType,
      analysis,
      ['Decision', symbol, decision.action, `${decision.confidence}%`],
      timestamp + 200
    );

    // Post decision to chat window so users see it in "Chat with Prime"
    const chatContent = decision.action === 'ENTER'
      ? `I'm recommending a ${signal} on **${symbol}** @ ₹${entryPrice} with ${decision.confidence}% confidence.\n\n${decision.rationale}`
      : decision.action === 'HOLD'
      ? `Spotted a ${signal} signal on **${symbol}** @ ₹${entryPrice}, but holding off (${decision.confidence}% confidence).\n\n${decision.rationale}`
      : `Scanned **${symbol}** for ${signal} @ ₹${entryPrice} — skipping this one (${decision.confidence}% confidence).\n\n${decision.rationale}`;

    await storeChatMessage({
      id: crypto.randomUUID(),
      userId: 'GLOBAL',
      role: 'prime',
      content: chatContent,
      timestamp: timestamp + 250,
      context: { intent: 'autonomous_decision', symbols: [symbol], action: `${signal}_${decision.action}` },
    });

    // If entering, notify Gamma and broadcast signal
    if (decision.action === 'ENTER' && decision.confidence >= 55) {
      const gamma = agents.find(a => a.id === 'gamma')!;
      await postComm(
        agent,
        gamma,
        `Executing ${signal} on ${symbol} @ ₹${entryPrice}. Risk approved at ${decision.confidence}% confidence.`,
        timestamp + 300
      );

      interAgentMessages.push({
        toAgentId: 'gamma',
        content: `Executing ${signal} on ${symbol} @ ₹${entryPrice}. Risk approved at ${decision.confidence}% confidence.`,
      });

      // Broadcast signal for paper trading (requires approval)
      await broadcastToAll({
        type: 'paperSignalGenerated',
        signal: { symbol, signal, entryPrice, confidence: decision.confidence },
        requiresApproval: true,
        timestamp: Date.now(),
      });

      // Log signal awaiting approval
      await docClient.send(new PutCommand({
        TableName: TableNames.activities,
        Item: {
          id: crypto.randomUUID(),
          agentId: 'sigma',
          agentName: 'Prime',
          agentGreek: 'Σ',
          agentColor: '#10b981',
          type: 'alert',
          content: `New Signal: ${symbol} ${signal} @ ₹${entryPrice} - Awaiting your review`,
          tags: ['Signal', 'Paper Trading', symbol, 'Pending Approval'],
          metadata: { symbol, signal, confidence: decision.confidence },
          timestamp: Date.now(),
          ttl: Math.floor(Date.now() / 1000) + 604800,
        },
      }));
    }

    // Every 5 decisions, post a summary
    const todaysDecisions = await getTodaysDecisions();
    if (todaysDecisions.length > 0 && todaysDecisions.length % 5 === 0) {
      const summary = await generateHumanSummary();
      await postActivity(
        agent,
        'info',
        `Activity Summary:\n${summary}`,
        ['Summary', 'Report'],
        timestamp + 400
      );
    }
  }

  const output: AgentOutput = {
    agentId: 'sigma',
    executionId,
    timestamp,
    date,
    analysis,
    alertType: activityType,
    tags: hasSignal ? ['Decision', symbol, signal] : ['Hunt', 'Scanning', symbol],
    metadata: { symbol, hasSignal, dataSource, techData: techData ? { rsi: techData.rsi, trend: techData.trend, overall_signal: techData.overall_signal } : null },
    interAgentMessages,
  };
  await saveAgentOutput(output);

  return output;
};
