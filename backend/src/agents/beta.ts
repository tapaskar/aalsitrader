/**
 * Beta Agent Lambda Handler - Technical Analyst
 * Analyzes charts, patterns, and technical indicators for F&O stocks.
 */

import { InvokeCommand } from '@aws-sdk/client-lambda';
import {
  AgentEvent,
  agents,
  watchlist,
  lambdaClient,
  callAgent,
  postActivity,
  postComm,
  updateAgentState,
  sleepAgent,
  isScheduled,
  scanStockYahoo,
  scanStockDhan,
} from './shared.js';
import { saveAgentOutput, AgentOutput } from '../utils/agent-memory.js';
import { getDhanCredentials } from '../auth/auth.js';

export const handler = async (event: AgentEvent) => {
  const { executionId, timestamp: tsInput } = event;
  const timestamp = typeof tsInput === 'number' ? tsInput : Date.now();
  const agent = agents.find((a) => a.id === 'beta')!;
  const date = new Date(timestamp).toISOString().split('T')[0];
  const symbol = watchlist[Math.floor(Math.random() * watchlist.length)];

  // Skip if not scheduled for this execution
  if (!isScheduled(event, 'beta')) {
    return { agentId: 'beta', executionId, timestamp, skipped: true };
  }

  await updateAgentState(agent.id, 'active', `Analyzing ${symbol} technicals...`, timestamp);

  let techData: any = null;
  try {
    const response = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: 'zerodha-technical-indicators',
        Payload: Buffer.from(JSON.stringify({ symbol, days: 365 })),
      })
    );
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    techData =
      typeof result.body === 'string' ? JSON.parse(result.body) : result;
  } catch (err) {
    console.log('Technical indicators fetch failed:', err);
  }

  let cleanAnalysis = '';
  let signalType = 'info';

  if (techData && !techData.error) {
    const prompt = `You are Techno-Kid, a technical analyst for Indian stock markets. Analyze this real technical data for ${symbol} and produce a concise 2-3 line update for the trading dashboard. Focus on actionable insights: trend, key levels, signals.

Data:
- Price: ₹${techData.current_price}, Change: ${techData.change_percent}%
- RSI: ${techData.rsi?.value} (${techData.rsi?.signal})
- MACD: ${techData.macd?.signal_interpretation}, Histogram: ${techData.macd?.histogram}
- Trend: ${techData.trend?.trend} (${techData.trend?.strength})
- Support: ₹${techData.support_resistance?.support}, Resistance: ₹${techData.support_resistance?.resistance}
- Bollinger: ${techData.bollinger_bands?.position}
- Volume Surge: ${techData.volume?.surge}
- Overall Signal: ${techData.overall_signal}

Respond with ONLY the analysis. Start with the signal type: [BUY], [SELL], or [NEUTRAL].`;

    const analysis = await callAgent('beta', executionId, prompt, prompt);
    signalType = analysis.includes('[BUY]')
      ? 'success'
      : analysis.includes('[SELL]')
        ? 'alert'
        : 'info';
    cleanAnalysis = analysis.replace(/\[(BUY|SELL|NEUTRAL)\]\s*/g, '');
    const tags = ['Technical', symbol];
    if (techData.volume?.surge) tags.push('Volume');
    if (
      techData.overall_signal === 'BUY' ||
      techData.overall_signal === 'SELL'
    )
      tags.push(techData.overall_signal);

    await postActivity(agent, signalType, cleanAnalysis, tags, timestamp, {
      symbol,
      fullAnalysis: analysis,
      techData: {
        currentPrice: techData.current_price,
        changePercent: techData.change_percent,
        rsi: { value: techData.rsi?.value, signal: techData.rsi?.signal },
        macd: { signalInterpretation: techData.macd?.signal_interpretation, histogram: techData.macd?.histogram },
        trend: { trend: techData.trend?.trend, strength: techData.trend?.strength },
        supportResistance: { support: techData.support_resistance?.support, resistance: techData.support_resistance?.resistance },
        bollingerPosition: techData.bollinger_bands?.position,
        volumeSurge: techData.volume?.surge,
        overallSignal: techData.overall_signal,
      },
    });

    // Notify Sigma if strong signal
    if (
      techData.overall_signal === 'BUY' ||
      techData.overall_signal === 'SELL'
    ) {
      const sigma = agents.find((a) => a.id === 'sigma')!;
      await postComm(
        agent,
        sigma,
        `${symbol} showing ${techData.overall_signal} signal. RSI ${techData.rsi?.value}, trend ${techData.trend?.trend}. Worth investigating.`,
        timestamp
      );
    }
  } else {
    // Fallback: Yahoo Finance → Dhan API technical scan (3-month data, RSI, trend, signals)
    try {
      let dhanToken: string | undefined;
      if (!process.env.DHAN_ACCESS_TOKEN) {
        try {
          const creds = await getDhanCredentials('iamspark.bot@gmail.com');
          dhanToken = creds?.accessToken;
        } catch { /* no Dhan creds available */ }
      }
      const scan = await scanStockYahoo(symbol) || await scanStockDhan(symbol, dhanToken);
      if (scan) {
        const prompt = `You are Techno-Kid, a technical analyst for Indian F&O markets. Analyze this data for ${symbol} and produce a concise 2-3 line actionable update. SuperTrend is the PRIMARY deciding factor — if SuperTrend says BUY/SELL, lean strongly in that direction unless other indicators overwhelmingly contradict it. Mention specific numbers — price, SuperTrend level, RSI, support/resistance.

Data:
- Price: ₹${scan.price}, 5d Momentum: ${scan.momentum5d > 0 ? '+' : ''}${scan.momentum5d}%
- SuperTrend(10,3): ₹${scan.superTrend} — Signal: ${scan.superTrendSignal} ${scan.superTrendSignal === 'BUY' ? '(price ABOVE SuperTrend = bullish)' : '(price BELOW SuperTrend = bearish)'}
- RSI(14): ${scan.rsi} (${scan.rsiSignal})
- Trend: ${scan.trend} (SMA20: ₹${scan.sma20}, SMA50: ₹${scan.sma50})
- Support: ₹${scan.support}, Resistance: ₹${scan.resistance}
- Volume Surge: ${scan.volumeSurge ? 'YES' : 'No'}
- Overall Signal: ${scan.overallSignal} (Score: ${scan.score}/100)

Respond with ONLY the analysis. Start with: [BUY], [SELL], or [NEUTRAL].`;

        const analysis = await callAgent('beta', executionId, prompt, prompt);
        signalType = analysis.includes('[BUY]')
          ? 'success'
          : analysis.includes('[SELL]')
            ? 'alert'
            : 'info';
        cleanAnalysis = analysis.replace(/\[(BUY|SELL|NEUTRAL)\]\s*/g, '');

        const tags = ['Technical', symbol];
        if (scan.volumeSurge) tags.push('Volume');
        if (scan.overallSignal === 'BUY' || scan.overallSignal === 'SELL') tags.push(scan.overallSignal);

        await postActivity(agent, signalType, cleanAnalysis, tags, timestamp, {
          symbol,
          fullAnalysis: analysis,
          techData: {
            currentPrice: scan.price,
            changePercent: scan.momentum5d,
            rsi: { value: scan.rsi, signal: scan.rsiSignal },
            trend: { trend: scan.trend, strength: Math.abs(scan.momentum5d) > 3 ? 'strong' : 'moderate' },
            supportResistance: { support: scan.support, resistance: scan.resistance },
            superTrend: { value: scan.superTrend, signal: scan.superTrendSignal },
            volumeSurge: scan.volumeSurge,
            overallSignal: scan.overallSignal,
          },
        });

        // Notify Sigma if strong signal
        if (scan.overallSignal === 'BUY' || scan.overallSignal === 'SELL') {
          const sigma = agents.find((a) => a.id === 'sigma')!;
          await postComm(
            agent,
            sigma,
            `${symbol} ${scan.overallSignal} signal (score ${scan.score}/100). SuperTrend ${scan.superTrendSignal} at ₹${scan.superTrend}, RSI ${scan.rsi}, trend ${scan.trend}.`,
            timestamp
          );
        }
      } else {
        cleanAnalysis = `${symbol}: Market data temporarily unavailable. Will retry on next cycle.`;
        await postActivity(agent, 'info', cleanAnalysis, ['Technical', symbol], timestamp);
      }
    } catch {
      cleanAnalysis = `${symbol}: Technical scan failed this cycle. Retrying shortly.`;
      await postActivity(agent, 'info', cleanAnalysis, ['Technical', symbol], timestamp);
    }
  }

  const output: AgentOutput = {
    agentId: 'beta',
    executionId,
    timestamp,
    date,
    analysis:
      cleanAnalysis ||
      'Technical analysis in progress. Monitoring key levels.',
    alertType: signalType,
    tags: ['Technical', symbol],
    metadata: {
      symbol,
      overallSignal: techData?.overall_signal,
      rsi: techData?.rsi?.value,
      trend: techData?.trend?.trend,
      price: techData?.current_price,
    },
    interAgentMessages:
      techData?.overall_signal === 'BUY' ||
      techData?.overall_signal === 'SELL'
        ? [
            {
              toAgentId: 'sigma',
              content: `${symbol} showing ${techData.overall_signal} signal. RSI ${techData.rsi?.value}, trend ${techData.trend?.trend}.`,
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
