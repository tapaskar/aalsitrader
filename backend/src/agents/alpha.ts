/**
 * Alpha Agent Lambda Handler - Research / News Intelligence
 * Scans news sources, analyzes with Claude, reports market-moving events.
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
} from './shared.js';
import { saveAgentOutput, AgentOutput } from '../utils/agent-memory.js';

export const handler = async (event: AgentEvent) => {
  const { executionId, timestamp: tsInput } = event;
  const timestamp = typeof tsInput === 'number' ? tsInput : Date.now();
  const agent = agents.find((a) => a.id === 'alpha')!;
  const date = new Date(timestamp).toISOString().split('T')[0];

  // Skip if not scheduled for this execution
  if (!isScheduled(event, 'alpha')) {
    return { agentId: 'alpha', executionId, timestamp, skipped: true };
  }

  await updateAgentState(agent.id, 'active', 'Scanning news sources...', timestamp);

  // Pick a random stock from watchlist to focus news analysis
  const focusStock = watchlist[Math.floor(Math.random() * watchlist.length)];
  let newsData = '';
  let ragAnalysis: any = null;

  // Try using stock-news-rag-query Lambda for intelligent news analysis
  // Wrap with 60s timeout so we fall back to RSS quickly instead of timing out the whole Lambda
  try {
    const ragPromise = lambdaClient.send(
      new InvokeCommand({
        FunctionName: 'stock-news-rag-query',
        Payload: Buffer.from(
          JSON.stringify({
            query: `Latest news headlines, earnings reports, and market events for Indian stock market. Focus on ${focusStock} and related sectors. Only news — no technical analysis.`,
            symbol: focusStock,
          })
        ),
      })
    );
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('RAG query timed out after 60s')), 60_000)
    );
    const response = await Promise.race([ragPromise, timeoutPromise]);
    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    ragAnalysis =
      typeof result.body === 'string' ? JSON.parse(result.body) : result;

    if (ragAnalysis && !ragAnalysis.error) {
      // Use news source titles as the primary input — NOT the RAG answer which may contain technical analysis
      const headlines: string[] = [];
      if (ragAnalysis.sources) {
        ragAnalysis.sources.slice(0, 8).forEach((s: any) => {
          if (s.title) {
            const sentiment = s.sentiment ? ` [${s.sentiment}]` : '';
            const source = s.source ? ` — ${s.source}` : '';
            headlines.push(`• ${s.title}${source}${sentiment}`);
          }
        });
      }
      // Only use the RAG summary if no headlines found, and strip any technical jargon
      if (headlines.length > 0) {
        newsData = headlines.join('\n');
      } else {
        newsData =
          ragAnalysis.answer ||
          ragAnalysis.response ||
          ragAnalysis.summary ||
          '';
      }
    }
  } catch (err) {
    console.log('News RAG query failed, falling back to RSS:', err);
  }

  // Fallback to Google News RSS if Lambda failed
  if (!newsData) {
    try {
      const newsUrl =
        'https://news.google.com/rss/search?q=NSE+stock+market+India+trading&hl=en-IN&gl=IN&ceid=IN:en';
      const res = await fetch(newsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const xml = await res.text();
      const titles: string[] = [];
      const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/g;
      let match;
      while ((match = titleRegex.exec(xml)) !== null && titles.length < 8) {
        titles.push(match[1]);
      }
      if (titles.length === 0) {
        const simpleRegex = /<title>(.*?)<\/title>/g;
        while (
          (match = simpleRegex.exec(xml)) !== null &&
          titles.length < 8
        ) {
          if (!match[1].includes('Google News')) titles.push(match[1]);
        }
      }
      newsData = titles.join('\n');
    } catch {
      newsData = 'Unable to fetch live news feeds.';
    }
  }

  // Use Claude to analyze news
  const today = new Date().toISOString().split('T')[0];
  const prompt = `You are Professor (Alpha), the NEWS analyst. Summarize today's market news for F&O traders.

CRITICAL RULES:
- ONLY report news from the headlines below. Do NOT invent or recall news from memory.
- If the headlines mention specific companies, report those exact companies — not others.
- NEVER mention RSI, MACD, SMA, Bollinger, support/resistance, or any technical indicators.
- NEVER fabricate earnings numbers, profit percentages, or financial data not in the headlines.
- Keep it to 2-3 lines. Be specific — name companies and events from the headlines.
- If no real news headlines are provided: "Markets quiet — no major news-driven catalysts detected."

Today's date: ${today}
Focus stock: ${focusStock}

TODAY'S HEADLINES (use ONLY these):
${newsData || 'No news feeds available this cycle.'}

Start with: [INFO], [ALERT], or [EARNINGS]. Then summarize ONLY the above headlines.`;

  const analysis = await callAgent('alpha', executionId, prompt, prompt);
  const alertType = analysis.includes('[ALERT]')
    ? 'alert'
    : analysis.includes('[EARNINGS]')
      ? 'success'
      : 'info';
  const cleanAnalysis = analysis.replace(/\[(INFO|ALERT|EARNINGS)\]\s*/g, '');

  // Build metadata with RAG sources and full analysis
  const activityMetadata: Record<string, unknown> = {
    symbol: focusStock,
    fullAnalysis: analysis,
    dataSource: ragAnalysis ? 'rag' : 'rss',
  };
  if (ragAnalysis?.sources) {
    activityMetadata.sources = ragAnalysis.sources.slice(0, 5).map((s: any) => ({
      title: s.title,
      url: s.url,
      source: s.source,
      publishedAt: s.published_at,
      sentiment: s.sentiment,
    }));
  }
  if (ragAnalysis?.technical_analysis?.[0]) {
    activityMetadata.technicalSummary = ragAnalysis.technical_analysis[0];
  }
  if (ragAnalysis?.metadata) {
    activityMetadata.articlesSearched = ragAnalysis.metadata.total_articles_searched;
    activityMetadata.relevantArticles = ragAnalysis.metadata.relevant_articles_found;
  }

  await postActivity(
    agent,
    alertType,
    cleanAnalysis ||
      'Scanning news sources — no significant market-moving events detected this cycle.',
    ['News', 'Research', focusStock],
    timestamp,
    activityMetadata
  );

  // Generate inter-agent comm to Beta if interesting
  if (alertType === 'alert') {
    const beta = agents.find((a) => a.id === 'beta')!;
    await postComm(
      agent,
      beta,
      `Flagged potential market-moving news for ${focusStock}. Verify technical levels.`,
      timestamp
    );
  }

  // Save output to agent memory
  const output: AgentOutput = {
    agentId: 'alpha',
    executionId,
    timestamp,
    date,
    analysis:
      cleanAnalysis ||
      'No significant market-moving events detected this cycle.',
    alertType,
    tags: ['News', 'Research', focusStock],
    metadata: { focusStock, ragAnalysis: !!ragAnalysis },
    interAgentMessages:
      alertType === 'alert'
        ? [
            {
              toAgentId: 'beta',
              content: `Flagged potential market-moving news for ${focusStock}`,
            },
          ]
        : [],
  };
  await saveAgentOutput(output);

  // 30% chance to sleep after activity
  if (Math.random() < 0.3) {
    await sleepAgent(agent, timestamp);
  }

  return output;
};
