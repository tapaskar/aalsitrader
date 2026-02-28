/**
 * Smart Money Screener API
 * Scans top 100 F&O stocks via Yahoo Finance and maps to Smart Money Structure concepts.
 * Uses DynamoDB for persistent cache shared across all users/Lambda invocations.
 * During market hours (IST 9:00-15:30, Mon-Fri): refresh on demand, cache until next refresh.
 * After market hours: serve cached results only, no refresh allowed.
 */

import { fnoStocks, batchScanStocks, StockScanResult } from './agents/shared.js';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TableNames } from './utils/db.js';

export interface SmartMoneyStock {
  symbol: string;
  price: number;
  trendStrength: number;  // -100 to +100
  confidence: number;      // 0 to 100
  structure: 'BOS_BULLISH' | 'BOS_BEARISH' | 'CHOCH_BULLISH' | 'CHOCH_BEARISH' | 'RANGE';
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  rsi: number;
  momentum5d: number;
  trend: string;
  volumeSurge: boolean;
  support: number;
  resistance: number;
  sma20: number;
  sma50: number;
}

// DynamoDB cache keys
const CACHE_PK = 'SCREENER#CACHE';
const CACHE_SK = 'latest';

// In-memory fallback (warm Lambda reuse)
let memoryCache: { data: SmartMoneyStock[]; fetchedAt: number } | null = null;

/**
 * Check if Indian stock market is currently open.
 * Market hours: Monday-Friday, 9:00 AM - 3:30 PM IST (UTC+5:30)
 */
function isMarketOpen(): boolean {
  const now = new Date();
  // Convert to IST
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);

  const day = ist.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // 9:00 AM = 540 minutes, 3:30 PM = 930 minutes
  return timeInMinutes >= 540 && timeInMinutes <= 930;
}

/**
 * Read screener cache from DynamoDB.
 */
async function readCacheFromDB(): Promise<{ data: SmartMoneyStock[]; fetchedAt: number } | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TableNames.momentumConfig,
      Key: { pk: CACHE_PK, sk: CACHE_SK },
    }));
    if (result.Item && result.Item.stocks && result.Item.fetchedAt) {
      return { data: JSON.parse(result.Item.stocks), fetchedAt: result.Item.fetchedAt };
    }
    return null;
  } catch (err) {
    console.error('Failed to read screener cache from DynamoDB:', err);
    return null;
  }
}

/**
 * Write screener cache to DynamoDB.
 */
async function writeCacheToDB(stocks: SmartMoneyStock[], fetchedAt: number): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: TableNames.momentumConfig,
      Item: {
        pk: CACHE_PK,
        sk: CACHE_SK,
        stocks: JSON.stringify(stocks),
        fetchedAt,
        updatedAt: new Date().toISOString(),
      },
    }));
  } catch (err) {
    console.error('Failed to write screener cache to DynamoDB:', err);
  }
}

/**
 * Map Yahoo Finance scan result to Smart Money Structure concepts.
 */
function mapToSmartMoney(scan: StockScanResult): SmartMoneyStock {
  // Trend Strength: -100 to +100
  let trendStrength = 0;

  // Trend direction contribution (+/- 30)
  if (scan.trend === 'uptrend') trendStrength += 30;
  else if (scan.trend === 'downtrend') trendStrength -= 30;

  // RSI deviation from 50 (+/- 30)
  trendStrength += (scan.rsi - 50) * 0.6;

  // Momentum contribution (+/- 40)
  trendStrength += Math.min(40, Math.max(-40, scan.momentum5d * 4));

  trendStrength = Math.round(Math.max(-100, Math.min(100, trendStrength)));

  // Confidence: alignment of signals (0-100%)
  const bullishSignals = [
    scan.rsi < 40,
    scan.trend === 'uptrend',
    scan.momentum5d > 1,
    scan.price > scan.sma20,
    scan.volumeSurge && scan.momentum5d > 0,
  ].filter(Boolean).length;

  const bearishSignals = [
    scan.rsi > 65,
    scan.trend === 'downtrend',
    scan.momentum5d < -1,
    scan.price < scan.sma20,
    scan.volumeSurge && scan.momentum5d < 0,
  ].filter(Boolean).length;

  const maxSignals = Math.max(bullishSignals, bearishSignals);
  const confidence = Math.round((maxSignals / 5) * 100);

  // Structure detection (BOS = Break of Structure, CHoCH = Change of Character)
  let structure: SmartMoneyStock['structure'] = 'RANGE';
  if (scan.trend === 'uptrend' && scan.momentum5d > 2) {
    structure = 'BOS_BULLISH';
  } else if (scan.trend === 'downtrend' && scan.momentum5d < -2) {
    structure = 'BOS_BEARISH';
  } else if (scan.trend === 'downtrend' && scan.momentum5d > 0) {
    structure = 'CHOCH_BULLISH';
  } else if (scan.trend === 'uptrend' && scan.momentum5d < 0) {
    structure = 'CHOCH_BEARISH';
  }

  return {
    symbol: scan.symbol,
    price: scan.price,
    trendStrength,
    confidence,
    structure,
    signal: scan.overallSignal as SmartMoneyStock['signal'],
    rsi: scan.rsi,
    momentum5d: scan.momentum5d,
    trend: scan.trend,
    volumeSurge: scan.volumeSurge,
    support: scan.support,
    resistance: scan.resistance,
    sma20: scan.sma20,
    sma50: scan.sma50,
  };
}

/**
 * Fetch OHLC chart data for a single stock from Yahoo Finance.
 */
export async function handleChartDataRequest(symbol: string) {
  if (!symbol) {
    return { statusCode: 400, body: { error: 'symbol query parameter is required' } };
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.NS')}?interval=1d&range=3mo`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      return { statusCode: 502, body: { error: `Yahoo Finance returned ${res.status}` } };
    }

    const data = (await res.json()) as any;
    const result = data?.chart?.result?.[0];
    if (!result) {
      return { statusCode: 404, body: { error: 'No chart data found' } };
    }

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const closes: (number | null)[] = quote.close || [];
    const opens: (number | null)[] = quote.open || [];
    const highs: (number | null)[] = quote.high || [];
    const lows: (number | null)[] = quote.low || [];
    const volumes: (number | null)[] = quote.volume || [];

    const candles = timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: opens[i] != null ? Math.round(opens[i]! * 100) / 100 : null,
      high: highs[i] != null ? Math.round(highs[i]! * 100) / 100 : null,
      low: lows[i] != null ? Math.round(lows[i]! * 100) / 100 : null,
      close: closes[i] != null ? Math.round(closes[i]! * 100) / 100 : null,
      volume: volumes[i],
    })).filter((c: any) => c.close != null);

    return {
      statusCode: 200,
      body: { symbol, candles, count: candles.length },
    };
  } catch (err) {
    console.error('Chart data fetch error:', err);
    return { statusCode: 500, body: { error: 'Failed to fetch chart data' } };
  }
}

export async function handleScreenerRequest(forceRefresh = false) {
  const marketOpen = isMarketOpen();

  // Try in-memory cache first (fast path for same Lambda instance)
  if (memoryCache && !forceRefresh) {
    return {
      statusCode: 200,
      body: {
        stocks: memoryCache.data,
        cached: true,
        fetchedAt: memoryCache.fetchedAt,
        count: memoryCache.data.length,
        marketOpen,
      },
    };
  }

  // Read from DynamoDB (shared across all Lambda instances / users)
  const dbCache = await readCacheFromDB();

  // After market hours: always serve cache, never refresh
  if (!marketOpen) {
    if (dbCache) {
      memoryCache = dbCache;
      return {
        statusCode: 200,
        body: {
          stocks: dbCache.data,
          cached: true,
          fetchedAt: dbCache.fetchedAt,
          count: dbCache.data.length,
          marketOpen,
        },
      };
    }
    // No cache at all — still try to scan (first-time scenario)
  }

  // Market is open: serve DynamoDB cache unless force-refresh
  if (dbCache && !forceRefresh) {
    memoryCache = dbCache;
    return {
      statusCode: 200,
      body: {
        stocks: dbCache.data,
        cached: true,
        fetchedAt: dbCache.fetchedAt,
        count: dbCache.data.length,
        marketOpen,
      },
    };
  }

  // Perform fresh scan
  try {
    console.log(`Screener: performing fresh scan (forceRefresh=${forceRefresh}, marketOpen=${marketOpen})`);
    const top100 = fnoStocks.slice(0, 100);
    const scanResults = await batchScanStocks(top100, 25);
    const stocks = scanResults.map(mapToSmartMoney);
    const fetchedAt = Date.now();

    // Store in both DynamoDB and memory
    memoryCache = { data: stocks, fetchedAt };
    await writeCacheToDB(stocks, fetchedAt);

    return {
      statusCode: 200,
      body: { stocks, cached: false, fetchedAt, count: stocks.length, marketOpen },
    };
  } catch (err) {
    console.error('Screener scan error:', err);
    // Fall back to stale cache if available
    if (dbCache) {
      return {
        statusCode: 200,
        body: {
          stocks: dbCache.data,
          cached: true,
          fetchedAt: dbCache.fetchedAt,
          count: dbCache.data.length,
          marketOpen,
          stale: true,
        },
      };
    }
    return {
      statusCode: 500,
      body: { error: 'Failed to scan stocks', stocks: [], count: 0, marketOpen },
    };
  }
}
