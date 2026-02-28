import { PutCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TableNames, WebSocketEndpoint } from './utils/db.js';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { PaperTrade, PortfolioState, getPortfolioState, getOpenTrades, updateUnrealizedPnL, exitTrade, PAPER_TRADING_CONFIG } from './momentum-trader/paper-trading.js';
import {
  makeDecision,
  generateHumanSummary,
  getTodaysDecisions,
  storeThinking,
  DecisionMemory,
} from './prime-intelligence.js';

const STAGE = process.env.STAGE || 'prod';
const USERS_TABLE = process.env.USERS_TABLE || `users-${STAGE}`;

const ACTIVE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

async function getActiveUserIds(): Promise<string[]> {
  try {
    const now = Date.now();
    const cutoff = now - ACTIVE_THRESHOLD_MS;

    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'sk = :sk AND lastActive >= :cutoff',
      ExpressionAttributeValues: {
        ':sk': 'PROFILE',
        ':cutoff': cutoff,
      },
      ProjectionExpression: 'email, lastActive',
    }));

    return (result.Items || []).map(item => item.email as string).filter(Boolean);
  } catch {
    return [];
  }
}

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const apiGateway = new ApiGatewayManagementApiClient({ endpoint: WebSocketEndpoint });
const lambdaClient = new LambdaClient({ region: AWS_REGION });
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });

// Agent definitions
const agents = [
  { id: 'alpha', name: 'Professor', greek: 'α', role: 'Research Agent', color: '#ff6b6b' },
  { id: 'beta', name: 'Techno-Kid', greek: 'β', role: 'Technical Analyst', color: '#4ecdc4' },
  { id: 'gamma', name: 'Risko-Frisco', greek: 'γ', role: 'Risk Manager', color: '#a855f7' },
  { id: 'sigma', name: 'Prime', greek: 'Σ', role: 'Trade Hunter / Orchestrator', color: '#10b981' },
  { id: 'theta', name: 'Macro', greek: 'θ', role: 'Macro Watcher', color: '#f97316' },
  { id: 'delta', name: 'Booky', greek: 'δ', role: 'Trade Journal', color: '#3b82f6' },
];

// Watchlist - F&O stocks the squad monitors
const watchlist = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'HAL', 'BDL', 'LT', 'BAJFINANCE', 'TATAMOTORS', 'HINDUNILVR', 'ITC', 'BHARTIARTL'];

export const handler = async (event: any): Promise<{ statusCode: number; body: string }> => {
  const timestamp = Date.now();
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || event);

  console.log('Agent orchestrator triggered:', body.action, body.agents);

  try {
    switch (body.action) {
      case 'simulate_heartbeat': {
        const agentsToRun = body.agents || ['alpha', 'beta', 'gamma', 'sigma'];
        for (const agentId of agentsToRun) {
          await runAgent(agentId, timestamp);
        }
        return { statusCode: 200, body: JSON.stringify({ ran: agentsToRun }) };
      }

      case 'wake_all': {
        for (const agent of agents) {
          await wakeAgent(agent, timestamp);
        }
        await broadcastToAll({
          type: 'systemMessage',
          message: 'All agents activated. Market opens soon.',
          timestamp,
        });
        return { statusCode: 200, body: JSON.stringify({ waked: agents.length }) };
      }

      case 'sleep_all': {
        for (const agent of agents) {
          await sleepAgent(agent, timestamp);
        }
        return { statusCode: 200, body: JSON.stringify({ slept: agents.length }) };
      }

      case 'eod_summary': {
        await runAgent('delta', timestamp);
        return { statusCode: 200, body: JSON.stringify({ summary: 'generated' }) };
      }

      case 'monitor_trades': {
        // Per-user monitoring: only active users (saves resources when no one is online)
        const userIds = await getActiveUserIds();
        const allResults: Array<{ userId: string; monitored: number; totalUnrealizedPnL: number; exitedTrades: string[] }> = [];
        const maxDurationMs = PAPER_TRADING_CONFIG.MAX_TRADE_DURATION_HOURS * 60 * 60 * 1000;

        for (const userId of userIds) {
          try {
            // Update unrealized P&L for this user's open trades
            const result = await updateUnrealizedPnL(body.priceUpdates, userId);

            // Check for trades that should be auto-exited (time-based exit after 24h)
            const openTrades = await getOpenTrades(userId);
            const exitedTrades: string[] = [];

            for (const trade of openTrades) {
              const tradeDuration = timestamp - trade.entryTime;
              if (tradeDuration >= maxDurationMs) {
                const currentPnL = result.updatedTrades.find(t => t.id === trade.id);
                const exitPrice = trade.entryPrice * (1 + (currentPnL?.unrealizedPnL ?? 0) / (trade.entryPrice * trade.lotSize * trade.futuresLots));

                const exitResult = await exitTrade({
                  tradeId: trade.id,
                  exitPrice: exitPrice || trade.entryPrice,
                  exitReason: 'expiry',
                  userId,
                });

                if (exitResult.success && exitResult.trade) {
                  exitedTrades.push(trade.id);
                  await broadcastPaperTradeClose(exitResult.trade);
                }
              }
            }

            if (result.updatedTrades.length > 0 || exitedTrades.length > 0) {
              const portfolio = await getPortfolioState(userId);
              await broadcastPaperPortfolioUpdate(portfolio);
            }

            allResults.push({
              userId,
              monitored: result.updatedTrades.length,
              totalUnrealizedPnL: result.totalUnrealizedPnL,
              exitedTrades,
            });
          } catch (err) {
            console.error(`[monitor_trades] Error for ${userId}:`, err);
          }
        }

        // Aggregate summary for activity log
        const totalMonitored = allResults.reduce((s, r) => s + r.monitored, 0);
        const totalPnL = allResults.reduce((s, r) => s + r.totalUnrealizedPnL, 0);
        const totalExited = allResults.reduce((s, r) => s + r.exitedTrades.length, 0);

        if (totalMonitored > 0 || totalExited > 0) {
          const sigma = agents.find(a => a.id === 'sigma')!;
          const pnlStatus = totalPnL >= 0 ? 'profit' : 'loss';
          const pnlSign = totalPnL >= 0 ? '+' : '';

          let activityContent = `Portfolio Update: ${totalMonitored} open position(s) across ${allResults.length} user(s), Unrealized P&L: ${pnlSign}₹${Math.abs(totalPnL).toLocaleString()}`;
          if (totalExited > 0) {
            activityContent += ` | ${totalExited} trade(s) auto-closed (24h expiry)`;
          }

          await postActivity(
            sigma,
            pnlStatus === 'profit' ? 'info' : 'warning',
            activityContent,
            ['Paper Trading', 'Portfolio', 'Update'],
            timestamp
          );
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            users: allResults.length,
            totalMonitored,
            totalUnrealizedPnL: totalPnL,
            results: allResults,
          })
        };
      }

      default: {
        // Default: run a contextually appropriate agent based on time
        const hour = new Date().getUTCHours() + 5.5; // IST offset
        let agentId: string;
        if (hour < 9.25) agentId = 'theta'; // Pre-market: macro
        else if (hour >= 15.5) agentId = 'delta'; // Post-market: journal
        else {
          // During market hours, rotate agents
          const marketAgents = ['alpha', 'beta', 'gamma', 'sigma', 'theta'];
          agentId = marketAgents[Math.floor(Math.random() * marketAgents.length)];
        }
        await runAgent(agentId, timestamp);
        return { statusCode: 200, body: JSON.stringify({ ran: agentId }) };
      }
    }
  } catch (error) {
    console.error('Orchestrator error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: (error as Error).message }) };
  }
};

// ── Agent Runners ──────────────────────────────────────────────────

async function runAgent(agentId: string, timestamp: number): Promise<void> {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return;

  // Mark agent as active
  await updateAgentState(agent.id, 'active', 'Working...', timestamp);

  try {
    switch (agentId) {
      case 'alpha': await runAlpha(agent, timestamp); break;
      case 'beta': await runBeta(agent, timestamp); break;
      case 'gamma': await runGamma(agent, timestamp); break;
      case 'theta': await runTheta(agent, timestamp); break;
      case 'delta': await runDelta(agent, timestamp); break;
      case 'sigma': await runSigma(agent, timestamp); break;
    }
  } catch (err) {
    console.error(`Agent ${agentId} error:`, err);
    await postActivity(agent, 'warning', `Encountered an issue during scan. Will retry next heartbeat.`, ['Error'], timestamp);
  }

  // 30% chance to sleep after activity
  if (Math.random() < 0.3 && agentId !== 'sigma') {
    await sleepAgent(agent, timestamp);
  }
}

// ── Alpha: Research Agent ──────────────────────────────────────────

async function runAlpha(agent: typeof agents[0], timestamp: number): Promise<void> {
  await updateAgentState(agent.id, 'active', 'Scanning news sources...', timestamp);

  // Pick a random stock from watchlist to focus news analysis
  const focusStock = watchlist[Math.floor(Math.random() * watchlist.length)];
  let newsData = '';
  let ragAnalysis: any = null;

  // Try using stock-news-rag-query Lambda for intelligent news analysis
  try {
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'stock-news-rag-query',
      Payload: Buffer.from(JSON.stringify({
        query: `Latest market news, sentiment and trading signals for Indian stock market. Focus on ${focusStock} and related sectors.`,
        symbol: focusStock,
      })),
    }));
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    ragAnalysis = typeof result.body === 'string' ? JSON.parse(result.body) : result;

    if (ragAnalysis && !ragAnalysis.error) {
      // Extract key insights from RAG response
      newsData = ragAnalysis.answer || ragAnalysis.response || ragAnalysis.summary || '';
      if (ragAnalysis.sources) {
        newsData += '\nSources: ' + (ragAnalysis.sources.slice(0, 3).map((s: any) => s.title || s).join(', '));
      }
    }
  } catch (err) {
    console.log('News RAG query failed, falling back to RSS:', err);
  }

  // Fallback to Google News RSS if Lambda failed
  if (!newsData) {
    try {
      const newsUrl = 'https://news.google.com/rss/search?q=NSE+stock+market+India+trading&hl=en-IN&gl=IN&ceid=IN:en';
      const res = await fetch(newsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const xml = await res.text();
      const titles: string[] = [];
      const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/g;
      let match;
      while ((match = titleRegex.exec(xml)) !== null && titles.length < 8) {
        titles.push(match[1]);
      }
      if (titles.length === 0) {
        const simpleRegex = /<title>(.*?)<\/title>/g;
        while ((match = simpleRegex.exec(xml)) !== null && titles.length < 8) {
          if (!match[1].includes('Google News')) titles.push(match[1]);
        }
      }
      newsData = titles.join('\n');
    } catch {
      newsData = 'Unable to fetch live news feeds.';
    }
  }

  // Use Claude to analyze news
  const prompt = `You are Professor, a trading research agent for Indian stock markets. Analyze these recent headlines/insights and produce a brief 2-3 line market intelligence update focused on what matters for F&O trading. Be specific, cite stock names if relevant. Watchlist: ${watchlist.slice(0, 6).join(', ')}.

News/Insights:
${newsData}

Respond with ONLY the analysis (no preamble). Format: one concise paragraph. Include alert type: [INFO], [ALERT], or [EARNINGS] at the start.`;

  const analysis = await callClaude(prompt);
  const alertType = analysis.includes('[ALERT]') ? 'alert' : analysis.includes('[EARNINGS]') ? 'success' : 'info';
  const cleanAnalysis = analysis.replace(/\[(INFO|ALERT|EARNINGS)\]\s*/g, '');

  await postActivity(agent, alertType, cleanAnalysis || 'Scanning news sources — no significant market-moving events detected this cycle.', ['News', 'Research', focusStock], timestamp);

  // Generate inter-agent comm to Beta if interesting
  if (alertType === 'alert') {
    const beta = agents.find(a => a.id === 'beta')!;
    await postComm(agent, beta, `Flagged potential market-moving news for ${focusStock}. Verify technical levels.`, timestamp);
  }
}

// ── Beta: Technical Analyst ────────────────────────────────────────

async function runBeta(agent: typeof agents[0], timestamp: number): Promise<void> {
  const symbol = watchlist[Math.floor(Math.random() * watchlist.length)];
  await updateAgentState(agent.id, 'active', `Analyzing ${symbol} technicals...`, timestamp);

  // Invoke Zerodha Technical Indicators Lambda
  let techData: any = null;
  try {
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'zerodha-technical-indicators',
      Payload: Buffer.from(JSON.stringify({ symbol, days: 365 })),
    }));
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    techData = typeof result.body === 'string' ? JSON.parse(result.body) : result;
  } catch (err) {
    console.log('Technical indicators fetch failed:', err);
  }

  if (techData && !techData.error) {
    // Use Claude to interpret real technical data
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

    const analysis = await callClaude(prompt);
    const signalType = analysis.includes('[BUY]') ? 'success' : analysis.includes('[SELL]') ? 'alert' : 'info';
    const cleanAnalysis = analysis.replace(/\[(BUY|SELL|NEUTRAL)\]\s*/g, '');
    const tags = ['Technical', symbol];
    if (techData.volume?.surge) tags.push('Volume');
    if (techData.overall_signal === 'BUY' || techData.overall_signal === 'SELL') tags.push(techData.overall_signal);

    await postActivity(agent, signalType, cleanAnalysis, tags, timestamp);

    // Notify Sigma if strong signal
    if (techData.overall_signal === 'BUY' || techData.overall_signal === 'SELL') {
      const sigma = agents.find(a => a.id === 'sigma')!;
      await postComm(agent, sigma, `${symbol} showing ${techData.overall_signal} signal. RSI ${techData.rsi?.value}, trend ${techData.trend?.trend}. Worth investigating.`, timestamp);
    }
  } else {
    // Fallback: use Yahoo Finance data
    await runBetaFallback(agent, symbol, timestamp);
  }
}

async function runBetaFallback(agent: typeof agents[0], symbol: string, timestamp: number): Promise<void> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?interval=1d&range=5d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json() as any;
    const meta = data?.chart?.result?.[0]?.meta;
    if (meta) {
      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose;
      const change = ((price - prevClose) / prevClose * 100).toFixed(2);
      await postActivity(agent, parseFloat(change) > 0 ? 'success' : 'info',
        `${symbol} at ₹${price.toFixed(0)} (${parseFloat(change) > 0 ? '+' : ''}${change}%). Monitoring price action and volume patterns.`,
        ['Technical', symbol], timestamp);
    }
  } catch {
    await postActivity(agent, 'info', `Analyzing technical patterns across watchlist. Key levels being tracked for breakout opportunities.`, ['Technical'], timestamp);
  }
}

// ── Gamma: Risk Manager ────────────────────────────────────────────

async function runGamma(agent: typeof agents[0], timestamp: number): Promise<void> {
  await updateAgentState(agent.id, 'active', 'Checking portfolio risk...', timestamp);

  let positions: any = null;
  let margins: any = null;

  // Get real positions from Zerodha
  try {
    const posRes = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'zerodha-trading-api',
      Payload: Buffer.from(JSON.stringify({ action: 'get_positions' })),
    }));
    const posResult = JSON.parse(new TextDecoder().decode(posRes.Payload));
    const posBody = typeof posResult.body === 'string' ? JSON.parse(posResult.body) : posResult;
    if (!posBody.error) positions = posBody.positions;
  } catch (err) {
    console.log('Zerodha positions fetch failed:', err);
  }

  // Get margins
  try {
    const marginRes = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'zerodha-trading-api',
      Payload: Buffer.from(JSON.stringify({ action: 'get_margins' })),
    }));
    const marginResult = JSON.parse(new TextDecoder().decode(marginRes.Payload));
    const marginBody = typeof marginResult.body === 'string' ? JSON.parse(marginResult.body) : marginResult;
    if (!marginBody.error) margins = marginBody.margins;
  } catch (err) {
    console.log('Zerodha margins fetch failed:', err);
  }

  if (positions || margins) {
    const netPositions = positions?.net || [];
    const dayPositions = positions?.day || [];
    const equity = margins?.equity || {};

    const openPositions = netPositions.filter((p: any) => p.quantity !== 0);
    const totalPnl = netPositions.reduce((sum: number, p: any) => sum + (p.pnl || 0), 0);
    const availableMargin = equity?.available?.live_balance || equity?.available?.cash || 0;

    const prompt = `You are Risko-Frisco, a risk manager for an Indian F&O trading account. Produce a 2-3 line risk status update.

Portfolio Data:
- Open Positions: ${openPositions.length}
- Day Trades: ${dayPositions.length}
- Unrealized P&L: ₹${totalPnl.toFixed(0)}
- Available Margin: ₹${availableMargin.toFixed(0)}
- Portfolio Heat: ${openPositions.length > 0 ? 'Active' : '0% (all cash)'}

Rules: 2% max risk per trade, 6% max monthly loss, no position >15% of portfolio.
Respond with ONLY the update. Start with risk level: [SAFE], [CAUTION], or [DANGER].`;

    const analysis = await callClaude(prompt);
    const riskType = analysis.includes('[DANGER]') ? 'alert' : analysis.includes('[CAUTION]') ? 'warning' : 'success';
    const cleanAnalysis = analysis.replace(/\[(SAFE|CAUTION|DANGER)\]\s*/g, '');

    await postActivity(agent, riskType, cleanAnalysis, ['Risk', 'Portfolio'], timestamp);

    if (riskType === 'alert') {
      const sigma = agents.find(a => a.id === 'sigma')!;
      await postComm(agent, sigma, 'Risk limits approaching. Hold new positions until risk clears.', timestamp);
    }
  } else {
    // Zerodha not connected - report status
    await postActivity(agent, 'warning',
      'Zerodha connection unavailable. Cannot pull live positions. Portfolio risk assessment paused. Please ensure token is refreshed.',
      ['Risk', 'Offline'], timestamp);
  }
}

// ── Theta: Macro Watcher ───────────────────────────────────────────

async function runTheta(agent: typeof agents[0], timestamp: number): Promise<void> {
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

  await Promise.all(macroSymbols.map(async ({ key, symbol }) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = await res.json() as any;
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta) {
        const price = meta.regularMarketPrice || 0;
        const prevClose = meta.chartPreviousClose || meta.previousClose || price;
        macroData[key] = { price: Math.round(price * 100) / 100, change: Math.round((price - prevClose) / prevClose * 10000) / 100 };
      }
    } catch { /* skip */ }
  }));

  const macroSummary = Object.entries(macroData)
    .map(([k, v]) => `${k}: ${v.price} (${v.change >= 0 ? '+' : ''}${v.change}%)`)
    .join(', ');

  if (Object.keys(macroData).length > 0) {
    const prompt = `You are Macro, a macro watcher for Indian stock markets. Analyze this real-time global data and produce a 2-3 line macro assessment with a risk-on/risk-off score (1-10).

${macroSummary}

Context: Track VIX (fear gauge), DXY (dollar strength hurts FII flows), crude (impacts India inflation), US10Y (global liquidity), India VIX, USDINR.
Respond with ONLY the analysis. Start with [RISK-ON X/10] or [RISK-OFF X/10].`;

    const analysis = await callClaude(prompt);
    const isRiskOff = analysis.toLowerCase().includes('risk-off');
    const cleanAnalysis = analysis.replace(/\[RISK-(ON|OFF)\s*\d+\/10\]\s*/gi, '');
    const scoreMatch = analysis.match(/(\d+)\/10/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;

    await postActivity(agent, isRiskOff && score <= 4 ? 'warning' : 'info',
      `Risk Score: ${score}/10. ${cleanAnalysis}`,
      ['Macro', 'Global', isRiskOff ? 'Risk-Off' : 'Risk-On'], timestamp);

    // Alert if macro deteriorating
    if (score <= 3) {
      const gamma = agents.find(a => a.id === 'gamma')!;
      await postComm(agent, gamma, `Macro risk-off signal at ${score}/10. Consider reducing position sizes.`, timestamp);
    }
  } else {
    await postActivity(agent, 'info', 'Global macro scan in progress. Monitoring VIX, DXY, crude oil, and FII flow data.', ['Macro', 'Global'], timestamp);
  }
}

// ── Delta: Trade Journal ───────────────────────────────────────────

async function runDelta(agent: typeof agents[0], timestamp: number): Promise<void> {
  await updateAgentState(agent.id, 'active', 'Compiling trade journal...', timestamp);

  // Get trades from DynamoDB
  const tradesResult = await docClient.send(new ScanCommand({ TableName: TableNames.trades }));
  const trades = tradesResult.Items || [];
  const closedTrades = trades.filter((t) => t.status === 'closed' && t.pnl !== undefined);
  const openTrades = trades.filter((t) => t.status === 'open');
  const wins = closedTrades.filter((t) => (t.pnl || 0) > 0);
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0;

  // Also check Zerodha for real trade data
  let zerodhaPositions: any[] = [];
  try {
    const posRes = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'zerodha-trading-api',
      Payload: Buffer.from(JSON.stringify({ action: 'get_positions' })),
    }));
    const posResult = JSON.parse(new TextDecoder().decode(posRes.Payload));
    const posBody = typeof posResult.body === 'string' ? JSON.parse(posResult.body) : posResult;
    if (!posBody.error && posBody.positions) {
      zerodhaPositions = (posBody.positions.day || []).filter((p: any) => p.quantity !== 0 || p.pnl !== 0);
    }
  } catch { /* Zerodha unavailable */ }

  const zPnl = zerodhaPositions.reduce((sum: number, p: any) => sum + (p.pnl || 0), 0);
  const zTrades = zerodhaPositions.length;

  const prompt = `You are Booky, a trade journal agent. Produce a concise 2-3 line performance summary.

Dashboard Data:
- Total Trades Logged: ${trades.length} (${openTrades.length} open, ${closedTrades.length} closed)
- Win Rate: ${winRate}% (${wins.length}W / ${closedTrades.length - wins.length}L)
- Total P&L: ₹${totalPnl.toFixed(0)}

Zerodha Today:
- Day positions: ${zTrades}
- Zerodha P&L: ₹${zPnl.toFixed(0)}

Focus on process quality, rule adherence, and lessons. Be brutally honest.
Respond with ONLY the journal entry.`;

  const analysis = await callClaude(prompt);
  await postActivity(agent, totalPnl >= 0 ? 'success' : 'info', analysis, ['Journal', 'Stats'], timestamp);
}

// ── Sigma: Trade Hunter (Intelligent Decision-Making) ─────────────

async function runSigma(agent: typeof agents[0], timestamp: number): Promise<void> {
  await updateAgentState(agent.id, 'active', 'Consulting the squad...', timestamp);

  // Pick a stock to analyze from watchlist
  const symbol = watchlist[Math.floor(Math.random() * watchlist.length)];

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

  try {
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'zerodha-technical-indicators',
      Payload: Buffer.from(JSON.stringify({ symbol, days: 365 })),
    }));
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    techData = typeof result.body === 'string' ? JSON.parse(result.body) : result;

    if (techData && !techData.error) {
      entryPrice = techData.current_price || 0;
      // Check if there's a clear signal
      if (techData.overall_signal === 'BUY' || techData.overall_signal === 'SELL') {
        hasSignal = true;
        signal = techData.overall_signal;
      }
    }
  } catch (err) {
    console.log('Technical data fetch failed:', err);
  }

  if (!hasSignal || !entryPrice) {
    // No clear signal - just report scanning status
    await postActivity(
      agent,
      'info',
      `Scanned ${symbol}: No clear entry signal. RSI ${techData?.rsi?.value || 'N/A'}, Trend ${techData?.trend?.trend || 'N/A'}. Continuing to monitor.`,
      ['Hunt', 'Scanning', symbol],
      timestamp
    );
    return;
  }

  // We have a signal! Now consult the squad
  await updateAgentState(agent.id, 'active', `Consulting squad on ${symbol} ${signal}...`, timestamp);

  // Notify human that we're analyzing
  await postActivity(
    agent,
    'info',
    `Detected ${signal} signal on ${symbol} @ ₹${entryPrice}. Consulting Professor, Techno-Kid, and Risko-Frisco for analysis...`,
    ['Signal', symbol, signal],
    timestamp
  );

  // Make the intelligent decision (this consults all agents)
  let decision: DecisionMemory;
  try {
    decision = await makeDecision(symbol, signal, entryPrice, techData);
  } catch (err) {
    console.error('Decision making failed:', err);
    await postActivity(
      agent,
      'warning',
      `Error during decision process for ${symbol}. Will retry next cycle.`,
      ['Error', symbol],
      timestamp
    );
    return;
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

  // Post Prime's decision and rationale to human
  const decisionEmoji = decision.action === 'ENTER' ? '🎯' : decision.action === 'HOLD' ? '⏳' : '⏭️';
  const activityType = decision.action === 'ENTER' ? 'success' : decision.action === 'HOLD' ? 'warning' : 'info';

  await postActivity(
    agent,
    activityType,
    `${decisionEmoji} ${symbol} ${signal} Decision: ${decision.action} (${decision.confidence}% confidence)\n\nRationale: ${decision.rationale}`,
    ['Decision', symbol, decision.action, `${decision.confidence}%`],
    timestamp + 200
  );

  // If entering, notify Gamma and potentially execute
  if (decision.action === 'ENTER' && decision.confidence >= 70) {
    const gamma = agents.find(a => a.id === 'gamma')!;
    await postComm(
      agent,
      gamma,
      `Executing ${signal} on ${symbol} @ ₹${entryPrice}. Risk approved at ${decision.confidence}% confidence.`,
      timestamp + 300
    );

    // Broadcast signal for paper trading (if in paper mode)
    await broadcastPaperSignalGenerated(
      { symbol, signal, entryPrice, confidence: decision.confidence },
      true // requires approval
    );
  }

  // Post a summary for the human trader
  const todaysDecisions = await getTodaysDecisions();
  if (todaysDecisions.length > 0 && todaysDecisions.length % 5 === 0) {
    // Every 5 decisions, post a summary
    const summary = await generateHumanSummary();
    await postActivity(
      agent,
      'info',
      `📊 Activity Summary:\n${summary}`,
      ['Summary', 'Report'],
      timestamp + 400
    );
  }
}

// ── LLM / Bedrock Integration ──────────────────────────────────────

async function callClaude(prompt: string): Promise<string> {
  // Try Amazon Nova Lite first (no agreement needed), then Claude Haiku
  const models = [
    { id: 'amazon.nova-lite-v1:0', format: 'nova' },
    { id: 'anthropic.claude-3-haiku-20240307-v1:0', format: 'claude' },
  ];

  for (const model of models) {
    try {
      let requestBody: string;
      if (model.format === 'nova') {
        requestBody = JSON.stringify({
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 200, temperature: 0.7 },
        });
      } else {
        requestBody = JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });
      }

      const response = await bedrockClient.send(new InvokeModelCommand({
        modelId: model.id,
        contentType: 'application/json',
        accept: 'application/json',
        body: requestBody,
      }));

      const result = JSON.parse(new TextDecoder().decode(response.body));

      // Parse response based on model format
      if (model.format === 'nova') {
        return result.output?.message?.content?.[0]?.text || '';
      } else {
        return result.content?.[0]?.text || '';
      }
    } catch (err: any) {
      console.error(`Bedrock ${model.id} call failed:`, err.message || err);
      continue; // Try next model
    }
  }

  return ''; // All models failed
}

// ── Shared Utilities ───────────────────────────────────────────────

async function postActivity(
  agent: typeof agents[0],
  type: string,
  content: string,
  tags: string[],
  timestamp: number
): Promise<void> {
  const activity = {
    id: crypto.randomUUID(),
    agentId: agent.id,
    agentName: agent.name,
    agentGreek: agent.greek,
    agentColor: agent.color,
    type,
    content,
    tags,
    timestamp,
  };

  await docClient.send(new PutCommand({
    TableName: TableNames.activities,
    Item: { ...activity, ttl: Math.floor(timestamp / 1000) + 604800 },
  }));

  await updateAgentState(agent.id, 'active', content.slice(0, 60) + '...', timestamp);

  await broadcastToAll({ type: 'agentActivity', activity, timestamp });
}

async function postComm(
  from: typeof agents[0],
  to: typeof agents[0],
  content: string,
  timestamp: number
): Promise<void> {
  const comm = {
    id: crypto.randomUUID(),
    from: from.name,
    fromGreek: from.greek,
    fromColor: from.color,
    to: to.name,
    toGreek: to.greek,
    toColor: to.color,
    content,
    timestamp,
  };

  await docClient.send(new PutCommand({
    TableName: TableNames.communications,
    Item: { ...comm, ttl: Math.floor(timestamp / 1000) + 86400 },
  }));

  await broadcastToAll({ type: 'commMessage', comm, timestamp });
}

async function updateAgentState(agentId: string, status: string, currentTask: string, timestamp: number): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TableNames.agentState,
    Item: { agentId, status, currentTask, lastActivity: timestamp },
  }));

  await broadcastToAll({ type: 'agentStatusChange', agentId, status, currentTask, timestamp });
}

async function wakeAgent(agent: typeof agents[0], timestamp: number): Promise<void> {
  await updateAgentState(agent.id, 'active', 'Initializing...', timestamp);
}

async function sleepAgent(agent: typeof agents[0], timestamp: number): Promise<void> {
  const nextWake = new Date(timestamp + 15 * 60 * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  await docClient.send(new PutCommand({
    TableName: TableNames.agentState,
    Item: { agentId: agent.id, status: 'sleeping', nextWake, lastActivity: timestamp },
  }));

  await broadcastToAll({ type: 'agentStatusChange', agentId: agent.id, status: 'sleeping', nextWake, timestamp });
}

async function broadcastToAll(data: unknown): Promise<void> {
  const result = await docClient.send(new ScanCommand({ TableName: TableNames.connections }));
  const connections = result.Items || [];

  await Promise.all(connections.map(async (conn) => {
    try {
      await apiGateway.send(new PostToConnectionCommand({
        ConnectionId: conn.connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      }));
    } catch {
      console.log(`Dead connection: ${conn.connectionId}`);
    }
  }));
}

// ── Paper Trading Broadcast Functions ─────────────────────────────

// These are now handled via TableNames from db.ts

/**
 * Broadcast paper trade open event to all connected clients
 */
export async function broadcastPaperTradeOpen(trade: PaperTrade): Promise<void> {
  await broadcastToAll({
    type: 'paperTradeOpen',
    trade,
    timestamp: Date.now(),
  });

  // Also log to activities for Sigma
  await docClient.send(new PutCommand({
    TableName: TableNames.activities,
    Item: {
      id: crypto.randomUUID(),
      agentId: 'sigma',
      agentName: 'Sigma',
      agentGreek: 'Σ',
      agentColor: '#10b981',
      type: 'success',
      content: `Paper Trade Opened: ${trade.signal} ${trade.symbol} @ ₹${trade.entryPrice}`,
      tags: ['Paper Trading', trade.symbol, 'Trade Open'],
      metadata: { tradeId: trade.id, signal: trade.signal },
      timestamp: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 604800,
    },
  }));
}

/**
 * Broadcast paper trade close event with P&L
 */
export async function broadcastPaperTradeClose(trade: PaperTrade): Promise<void> {
  const pnlStatus = (trade.netPnL || 0) >= 0 ? 'profit' : 'loss';
  const emoji = pnlStatus === 'profit' ? '✅' : '❌';

  await broadcastToAll({
    type: 'paperTradeClose',
    trade,
    timestamp: Date.now(),
  });

  // Log to activities
  await docClient.send(new PutCommand({
    TableName: TableNames.activities,
    Item: {
      id: crypto.randomUUID(),
      agentId: 'sigma',
      agentName: 'Sigma',
      agentGreek: 'Σ',
      agentColor: '#10b981',
      type: pnlStatus === 'profit' ? 'success' : 'warning',
      content: `${emoji} Paper Trade Closed: ${trade.symbol} ${trade.exitReason} - ${pnlStatus === 'profit' ? '+' : ''}₹${Math.abs(trade.netPnL || 0).toFixed(0)}`,
      tags: ['Paper Trading', trade.symbol, 'Trade Close', pnlStatus === 'profit' ? 'Win' : 'Loss'],
      metadata: { tradeId: trade.id, pnl: trade.netPnL, exitReason: trade.exitReason },
      timestamp: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 604800,
    },
  }));
}

/**
 * Broadcast portfolio update
 */
export async function broadcastPaperPortfolioUpdate(portfolio: PortfolioState): Promise<void> {
  await broadcastToAll({
    type: 'paperPortfolioUpdate',
    portfolio,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast signal generated event (for Sigma approval)
 */
export async function broadcastPaperSignalGenerated(
  signal: {
    symbol: string;
    signal: 'BUY' | 'SELL';
    entryPrice: number;
    confidence: number;
  },
  requiresApproval: boolean
): Promise<void> {
  await broadcastToAll({
    type: 'paperSignalGenerated',
    signal,
    requiresApproval,
    timestamp: Date.now(),
  });

  if (requiresApproval) {
    // Log signal awaiting approval
    await docClient.send(new PutCommand({
      TableName: TableNames.activities,
      Item: {
        id: crypto.randomUUID(),
        agentId: 'sigma',
        agentName: 'Sigma',
        agentGreek: 'Σ',
        agentColor: '#10b981',
        type: 'alert',
        content: `🔔 New Signal: ${signal.symbol} ${signal.signal} @ ₹${signal.entryPrice} - Awaiting your review`,
        tags: ['Signal', 'Paper Trading', signal.symbol, 'Pending Approval'],
        metadata: { symbol: signal.symbol, signal: signal.signal, confidence: signal.confidence },
        timestamp: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 604800,
      },
    }));
  }
}

/**
 * Get current paper trading stats for Sigma display
 */
export async function getPaperTradingStatsForSigma(userId?: string): Promise<{
  trades: number;
  winRate: number;
  pnl: number;
  mode: 'paper' | 'live';
} | null> {
  try {
    const [portfolio, openTrades] = await Promise.all([
      getPortfolioState(userId),
      getOpenTrades(userId),
    ]);

    // Get config
    const configResult = await docClient.send(new QueryCommand({
      TableName: TableNames.momentumConfig,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': 'CONFIG#MODE' },
      Limit: 1,
      ScanIndexForward: false,
    }));
    const mode = configResult.Items?.[0]?.mode || 'paper';

    return {
      trades: portfolio.closedTrades + openTrades.length,
      winRate: portfolio.winRate,
      pnl: portfolio.totalPnl,
      mode,
    };
  } catch (err) {
    console.error('Failed to get paper trading stats:', err);
    return null;
  }
}
