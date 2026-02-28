/**
 * Technical Indicators Module for Momentum Trading
 * Calculates RSI, MACD, Bollinger Bands, ADX, Volume Profile, and more
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RSIResult {
  value: number;
  signal: 'overbought' | 'oversold' | 'neutral';
  divergence?: 'bullish' | 'bearish' | null;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  signal_interpretation: string;
  trend_strength: 'strong' | 'moderate' | 'weak';
}

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  position: 'above_upper' | 'near_upper' | 'middle' | 'near_lower' | 'below_lower';
  squeeze: boolean;
}

export interface ADXResult {
  adx: number;
  plusDI: number;
  minusDI: number;
  trend_strength: 'strong' | 'moderate' | 'weak' | 'none';
  direction: 'bullish' | 'bearish' | 'neutral';
}

export interface VolumeProfile {
  current: number;
  average20: number;
  average50: number;
  surge: boolean;
  trend: 'increasing' | 'decreasing' | 'neutral';
  confirmation: boolean;
}

export interface MomentumResult {
  score: number; // -100 to 100
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: 'strong' | 'moderate' | 'weak';
  confidence: number; // 0 to 1
}

// ─────────────────────────────────────────────────────────────────────────────
// RSI Calculation
// ─────────────────────────────────────────────────────────────────────────────

export function calculateRSI(candles: Candle[], period: number = 14): RSIResult {
  if (candles.length < period + 1) {
    return { value: 50, signal: 'neutral', divergence: null };
  }

  let gains = 0;
  let losses = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Calculate RS and RSI for remaining candles
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  // Detect divergence
  const divergence = detectRSIDivergence(candles, period);

  return {
    value: Math.round(rsi * 100) / 100,
    signal: rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral',
    divergence,
  };
}

function detectRSIDivergence(candles: Candle[], period: number): 'bullish' | 'bearish' | null {
  if (candles.length < period * 3) return null;

  // Helper to calculate RSI at a specific point
  const calculateRSIAtIndex = (endIndex: number): number => {
    if (endIndex < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = endIndex - period; i < endIndex; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  };

  // Find swing lows and highs in recent and previous periods
  const findSwingLow = (start: number, end: number): { index: number; price: number } | null => {
    let minPrice = Infinity;
    let minIndex = -1;

    for (let i = start + 2; i < end - 2; i++) {
      const low = candles[i].low;
      if (low < candles[i - 1].low && low < candles[i - 2].low &&
          low < candles[i + 1].low && low < candles[i + 2].low) {
        if (low < minPrice) {
          minPrice = low;
          minIndex = i;
        }
      }
    }

    return minIndex >= 0 ? { index: minIndex, price: minPrice } : null;
  };

  const findSwingHigh = (start: number, end: number): { index: number; price: number } | null => {
    let maxPrice = -Infinity;
    let maxIndex = -1;

    for (let i = start + 2; i < end - 2; i++) {
      const high = candles[i].high;
      if (high > candles[i - 1].high && high > candles[i - 2].high &&
          high > candles[i + 1].high && high > candles[i + 2].high) {
        if (high > maxPrice) {
          maxPrice = high;
          maxIndex = i;
        }
      }
    }

    return maxIndex >= 0 ? { index: maxIndex, price: maxPrice } : null;
  };

  const halfLen = Math.floor(candles.length / 2);
  const recentStart = halfLen;
  const recentEnd = candles.length;
  const prevStart = 0;
  const prevEnd = halfLen;

  // Check for bullish divergence: price makes lower low, RSI makes higher low
  const recentLow = findSwingLow(recentStart, recentEnd);
  const prevLow = findSwingLow(prevStart, prevEnd);

  if (recentLow && prevLow && recentLow.price < prevLow.price) {
    const recentRSI = calculateRSIAtIndex(recentLow.index);
    const prevRSI = calculateRSIAtIndex(prevLow.index);

    // Bullish: price lower, RSI higher (by at least 3 points for significance)
    if (recentRSI > prevRSI + 3) {
      return 'bullish';
    }
  }

  // Check for bearish divergence: price makes higher high, RSI makes lower high
  const recentHigh = findSwingHigh(recentStart, recentEnd);
  const prevHigh = findSwingHigh(prevStart, prevEnd);

  if (recentHigh && prevHigh && recentHigh.price > prevHigh.price) {
    const recentRSI = calculateRSIAtIndex(recentHigh.index);
    const prevRSI = calculateRSIAtIndex(prevHigh.index);

    // Bearish: price higher, RSI lower (by at least 3 points for significance)
    if (recentRSI < prevRSI - 3) {
      return 'bearish';
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MACD Calculation
// ─────────────────────────────────────────────────────────────────────────────

export function calculateMACD(
  candles: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  if (candles.length < slowPeriod + signalPeriod) {
    return {
      macd: 0,
      signal: 0,
      histogram: 0,
      signal_interpretation: 'insufficient_data',
      trend_strength: 'weak',
    };
  }

  const closes = candles.map(c => c.close);

  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);

  const macdLine = emaFast.map((fast, i) => fast - emaSlow[i]);
  const signalLine = calculateEMA(macdLine, signalPeriod);

  const currentMACD = macdLine[macdLine.length - 1];
  const currentSignal = signalLine[signalLine.length - 1];
  const histogram = currentMACD - currentSignal;

  // Determine interpretation
  let interpretation = 'neutral';
  if (currentMACD > currentSignal && histogram > 0) {
    interpretation = histogram > (macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2])
      ? 'bullish_accelerating'
      : 'bullish';
  } else if (currentMACD < currentSignal && histogram < 0) {
    interpretation = histogram < (macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2])
      ? 'bearish_accelerating'
      : 'bearish';
  } else if (currentMACD > currentSignal && histogram < 0) {
    interpretation = 'bullish_weakening';
  } else if (currentMACD < currentSignal && histogram > 0) {
    interpretation = 'bearish_weakening';
  }

  // Calculate trend strength based on histogram magnitude
  const histAbs = Math.abs(histogram);
  const maxHist = Math.max(...macdLine.map((m, i) => Math.abs(m - (signalLine[i] || 0))));
  const normalizedStrength = maxHist > 0 ? histAbs / maxHist : 0;

  return {
    macd: Math.round(currentMACD * 100) / 100,
    signal: Math.round(currentSignal * 100) / 100,
    histogram: Math.round(histogram * 100) / 100,
    signal_interpretation: interpretation,
    trend_strength: normalizedStrength > 0.7 ? 'strong' : normalizedStrength > 0.4 ? 'moderate' : 'weak',
  };
}

function calculateEMA(values: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const ema: number[] = [];

  // Start with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  ema.push(sum / period);

  // Calculate EMA for rest
  for (let i = period; i < values.length; i++) {
    ema.push((values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
  }

  return ema;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bollinger Bands Calculation
// ─────────────────────────────────────────────────────────────────────────────

export function calculateBollingerBands(
  candles: Candle[],
  period: number = 20,
  multiplier: number = 2
): BollingerResult {
  if (candles.length < period) {
    const lastClose = candles[candles.length - 1]?.close || 0;
    return {
      upper: lastClose * 1.02,
      middle: lastClose,
      lower: lastClose * 0.98,
      bandwidth: 0,
      position: 'middle',
      squeeze: false,
    };
  }

  const closes = candles.slice(-period).map(c => c.close);
  const sma = closes.reduce((a, b) => a + b, 0) / period;

  const squaredDiffs = closes.map(c => Math.pow(c - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = sma + stdDev * multiplier;
  const lower = sma - stdDev * multiplier;
  const currentPrice = candles[candles.length - 1].close;

  // Determine position
  let position: BollingerResult['position'];
  if (currentPrice > upper) position = 'above_upper';
  else if (currentPrice > sma + stdDev * 0.5) position = 'near_upper';
  else if (currentPrice < lower) position = 'below_lower';
  else if (currentPrice < sma - stdDev * 0.5) position = 'near_lower';
  else position = 'middle';

  // Squeeze detection (low bandwidth = consolidation)
  const bandwidth = ((upper - lower) / sma) * 100;
  const avgBandwidth = 5; // Historical average approximation
  const squeeze = bandwidth < avgBandwidth * 0.4;

  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(sma * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    bandwidth: Math.round(bandwidth * 100) / 100,
    position,
    squeeze,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADX (Average Directional Index) Calculation
// ─────────────────────────────────────────────────────────────────────────────

export function calculateADX(candles: Candle[], period: number = 14): ADXResult {
  if (candles.length < period * 2) {
    return { adx: 25, plusDI: 20, minusDI: 20, trend_strength: 'weak', direction: 'neutral' };
  }

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;

    // True Range
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    tr.push(Math.max(tr1, tr2, tr3));

    // Directional Movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    if (upMove > downMove && upMove > 0) plusDM.push(upMove);
    else plusDM.push(0);

    if (downMove > upMove && downMove > 0) minusDM.push(downMove);
    else minusDM.push(0);
  }

  // Smooth the TR, +DM, -DM
  const atr = calculateSmoothedAverage(tr, period);
  const smoothedPlusDM = calculateSmoothedAverage(plusDM, period);
  const smoothedMinusDM = calculateSmoothedAverage(minusDM, period);

  // Calculate DI
  const plusDI = (smoothedPlusDM[smoothedPlusDM.length - 1] / atr[atr.length - 1]) * 100;
  const minusDI = (smoothedMinusDM[smoothedMinusDM.length - 1] / atr[atr.length - 1]) * 100;

  // Calculate DX and ADX
  const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;

  // Smooth DX to get ADX
  const dxValues: number[] = [];
  for (let i = period - 1; i < smoothedPlusDM.length; i++) {
    const pDI = (smoothedPlusDM[i] / atr[i]) * 100;
    const mDI = (smoothedMinusDM[i] / atr[i]) * 100;
    // Avoid division by zero
    const diSum = pDI + mDI;
    dxValues.push(diSum > 0 ? (Math.abs(pDI - mDI) / diSum) * 100 : 0);
  }

  // Get last element of smoothed array (not dxValues)
  const smoothedADX = calculateSmoothedAverage(dxValues, period);
  const adx = smoothedADX.length > 0 ? smoothedADX[smoothedADX.length - 1] : 25;

  return {
    adx: isNaN(adx) ? 25 : Math.round(adx),
    plusDI: Math.round(plusDI),
    minusDI: Math.round(minusDI),
    trend_strength: adx > 40 ? 'strong' : adx > 25 ? 'moderate' : adx > 15 ? 'weak' : 'none',
    direction: plusDI > minusDI ? 'bullish' : minusDI > plusDI ? 'bearish' : 'neutral',
  };
}

function calculateSmoothedAverage(values: number[], period: number): number[] {
  const smoothed: number[] = [];
  let sum = 0;

  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  smoothed.push(sum);

  for (let i = period; i < values.length; i++) {
    smoothed.push(smoothed[smoothed.length - 1] - smoothed[smoothed.length - 1] / period + values[i]);
  }

  return smoothed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume Analysis
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeVolume(candles: Candle[]): VolumeProfile {
  if (candles.length < 50) {
    return {
      current: candles[candles.length - 1]?.volume || 0,
      average20: 0,
      average50: 0,
      surge: false,
      trend: 'neutral',
      confirmation: false,
    };
  }

  const volumes = candles.map(c => c.volume);
  const current = volumes[volumes.length - 1];
  const avg20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const avg50 = volumes.slice(-50).reduce((a, b) => a + b, 0) / 50;

  // Volume trend
  const recentAvg = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const prevAvg = volumes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;

  let trend: VolumeProfile['trend'] = 'neutral';
  if (recentAvg > prevAvg * 1.1) trend = 'increasing';
  else if (recentAvg < prevAvg * 0.9) trend = 'decreasing';

  // Surge detection
  const surge = current > avg20 * 1.5;

  // Volume confirmation for momentum
  // Volume should be above average AND trending up for bullish momentum
  const confirmation = current > avg20 && trend === 'increasing';

  return {
    current,
    average20: Math.round(avg20),
    average50: Math.round(avg50),
    surge,
    trend,
    confirmation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Momentum Score Calculation
// ─────────────────────────────────────────────────────────────────────────────

export function calculateMomentumScore(
  rsi: RSIResult,
  macd: MACDResult,
  bb: BollingerResult,
  adx: ADXResult,
  volume: VolumeProfile
): MomentumResult {
  let score = 0;
  const weights = {
    rsi: 0.15,
    macd: 0.25,
    bb: 0.15,
    adx: 0.20,
    volume: 0.25,
  };

  // RSI contribution (0-30 oversold = bullish, 70-100 overbought = bearish)
  if (rsi.signal === 'oversold') score += 50 * weights.rsi;
  else if (rsi.signal === 'overbought') score -= 50 * weights.rsi;
  else score += (50 - rsi.value) * weights.rsi;

  // MACD contribution
  if (macd.signal_interpretation.includes('bullish')) score += 50 * weights.macd;
  else if (macd.signal_interpretation.includes('bearish')) score -= 50 * weights.macd;

  if (macd.trend_strength === 'strong') score *= 1.2;
  else if (macd.trend_strength === 'weak') score *= 0.8;

  // Bollinger Bands contribution
  if (bb.position === 'below_lower') score += 40 * weights.bb;
  else if (bb.position === 'near_lower') score += 20 * weights.bb;
  else if (bb.position === 'above_upper') score -= 40 * weights.bb;
  else if (bb.position === 'near_upper') score -= 20 * weights.bb;

  // ADX contribution
  const adxStrength = adx.adx / 100;
  if (adx.direction === 'bullish') score += 50 * adxStrength * weights.adx;
  else if (adx.direction === 'bearish') score -= 50 * adxStrength * weights.adx;

  // Volume contribution
  if (volume.confirmation) {
    score += (volume.trend === 'increasing' ? 30 : 15) * weights.volume;
  } else {
    score *= 0.7; // Reduce confidence without volume
  }

  // Normalize to -100 to 100
  score = Math.max(-100, Math.min(100, score));

  return {
    score: Math.round(score),
    direction: score > 20 ? 'bullish' : score < -20 ? 'bearish' : 'neutral',
    strength: Math.abs(score) > 60 ? 'strong' : Math.abs(score) > 30 ? 'moderate' : 'weak',
    confidence: calculateConfidence(rsi, macd, adx, volume),
  };
}

function calculateConfidence(
  rsi: RSIResult,
  macd: MACDResult,
  adx: ADXResult,
  volume: VolumeProfile
): number {
  let confidence = 0.5;

  // Increase confidence with trend strength
  if (adx.trend_strength === 'strong') confidence += 0.15;
  else if (adx.trend_strength === 'moderate') confidence += 0.05;

  // Increase confidence with MACD strength
  if (macd.trend_strength === 'strong') confidence += 0.1;

  // Increase confidence with volume
  if (volume.confirmation) confidence += 0.15;
  if (volume.surge) confidence += 0.1;

  // Decrease confidence with divergence
  if (rsi.divergence) confidence -= 0.2;

  return Math.max(0, Math.min(1, confidence));
}

// ─────────────────────────────────────────────────────────────────────────────
// Support and Resistance Levels
// ─────────────────────────────────────────────────────────────────────────────

export interface SupportResistance {
  support: number;
  resistance: number;
  pivot: number;
  levels: { level: number; strength: number; type: 'support' | 'resistance' }[];
}

export function calculateSupportResistance(candles: Candle[]): SupportResistance {
  if (candles.length < 20) {
    const lastClose = candles[candles.length - 1]?.close || 0;
    return {
      support: lastClose * 0.98,
      resistance: lastClose * 1.02,
      pivot: lastClose,
      levels: [],
    };
  }

  // Find swing highs and lows
  const swings: { price: number; type: 'high' | 'low'; index: number }[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const prev2 = candles[i - 2].high;
    const prev1 = candles[i - 1].high;
    const curr = candles[i].high;
    const next1 = candles[i + 1].high;
    const next2 = candles[i + 2].high;

    if (curr > prev1 && curr > prev2 && curr > next1 && curr > next2) {
      swings.push({ price: curr, type: 'high', index: i });
    }

    const prev2L = candles[i - 2].low;
    const prev1L = candles[i - 1].low;
    const currL = candles[i].low;
    const next1L = candles[i + 1].low;
    const next2L = candles[i + 2].low;

    if (currL < prev1L && currL < prev2L && currL < next1L && currL < next2L) {
      swings.push({ price: currL, type: 'low', index: i });
    }
  }

  // Cluster levels
  const clusters: { price: number; touches: number; type: 'support' | 'resistance' }[] = [];
  const tolerance = 0.01; // 1%

  for (const swing of swings) {
    let added = false;
    for (const cluster of clusters) {
      if (Math.abs(swing.price - cluster.price) / cluster.price < tolerance) {
        cluster.price = (cluster.price * cluster.touches + swing.price) / (cluster.touches + 1);
        cluster.touches++;
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({
        price: swing.price,
        touches: 1,
        type: swing.type === 'high' ? 'resistance' : 'support',
      });
    }
  }

  // Sort by strength (touches) and proximity to current price
  const currentPrice = candles[candles.length - 1].close;
  clusters.sort((a, b) => {
    const distA = Math.abs(a.price - currentPrice);
    const distB = Math.abs(b.price - currentPrice);
    return b.touches - a.touches || distA - distB;
  });

  const supportCluster = clusters.find(c => c.type === 'support' && c.price < currentPrice);
  const resistanceCluster = clusters.find(c => c.type === 'resistance' && c.price > currentPrice);

  const previousDay = candles[candles.length - 2];
  const pivot = (previousDay.high + previousDay.low + previousDay.close) / 3;

  return {
    support: Math.round((supportCluster?.price || currentPrice * 0.98) * 100) / 100,
    resistance: Math.round((resistanceCluster?.price || currentPrice * 1.02) * 100) / 100,
    pivot: Math.round(pivot * 100) / 100,
    levels: clusters.map(c => ({
      level: Math.round(c.price * 100) / 100,
      strength: c.touches,
      type: c.type,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// All Indicators Combined
// ─────────────────────────────────────────────────────────────────────────────

export interface FullIndicatorSet {
  rsi: RSIResult;
  macd: MACDResult;
  bollinger: BollingerResult;
  adx: ADXResult;
  volume: VolumeProfile;
  momentum: MomentumResult;
  supportResistance: SupportResistance;
  overallSignal: 'BUY' | 'SELL' | 'HOLD';
  falseBreakoutRisk: 'high' | 'medium' | 'low';
}

export function calculateAllIndicators(candles: Candle[]): FullIndicatorSet {
  const rsi = calculateRSI(candles);
  const macd = calculateMACD(candles);
  const bollinger = calculateBollingerBands(candles);
  const adx = calculateADX(candles);
  const volume = analyzeVolume(candles);
  const momentum = calculateMomentumScore(rsi, macd, bollinger, adx, volume);
  const supportResistance = calculateSupportResistance(candles);

  // Determine overall signal
  let overallSignal: FullIndicatorSet['overallSignal'] = 'HOLD';
  let falseBreakoutRisk: FullIndicatorSet['falseBreakoutRisk'] = 'low';

  // False breakout detection
  const falseBreakoutConditions = [
    rsi.divergence !== null,
    adx.trend_strength === 'weak',
    !volume.confirmation,
    macd.trend_strength === 'weak',
    bollinger.squeeze,
  ];

  const falseBreakoutCount = falseBreakoutConditions.filter(Boolean).length;
  falseBreakoutRisk = falseBreakoutCount >= 3 ? 'high' : falseBreakoutCount >= 2 ? 'medium' : 'low';

  // Entry signals only with low/medium false breakout risk
  if (falseBreakoutRisk !== 'high') {
    if (momentum.direction === 'bullish' && momentum.strength !== 'weak') {
      // Additional confirmation
      if (macd.signal_interpretation.includes('bullish') && adx.direction === 'bullish') {
        overallSignal = 'BUY';
      }
    } else if (momentum.direction === 'bearish' && momentum.strength !== 'weak') {
      if (macd.signal_interpretation.includes('bearish') && adx.direction === 'bearish') {
        overallSignal = 'SELL';
      }
    }
  }

  return {
    rsi,
    macd,
    bollinger,
    adx,
    volume,
    momentum,
    supportResistance,
    overallSignal,
    falseBreakoutRisk,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-timeframe Analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface MultiTimeframeAnalysis {
  '30min': FullIndicatorSet;
  '1hr': FullIndicatorSet;
  '4hr': FullIndicatorSet;
  alignment: 'bullish' | 'bearish' | 'mixed' | 'neutral';
  confidence: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
}

export function analyzeMultipleTimeframes(
  candles30m: Candle[],
  candles1h: Candle[],
  candles4h: Candle[]
): MultiTimeframeAnalysis {
  const analysis30m = calculateAllIndicators(candles30m);
  const analysis1h = calculateAllIndicators(candles1h);
  const analysis4h = calculateAllIndicators(candles4h);

  // Determine alignment
  const signals = [analysis30m.momentum.direction, analysis1h.momentum.direction, analysis4h.momentum.direction];
  const bullishCount = signals.filter(s => s === 'bullish').length;
  const bearishCount = signals.filter(s => s === 'bearish').length;

  let alignment: MultiTimeframeAnalysis['alignment'] = 'neutral';
  if (bullishCount >= 2 && bearishCount === 0) alignment = 'bullish';
  else if (bearishCount >= 2 && bullishCount === 0) alignment = 'bearish';
  else if (bullishCount > 0 || bearishCount > 0) alignment = 'mixed';

  // Calculate confidence based on agreement
  const confidenceScores = [analysis30m, analysis1h, analysis4h].map(a => a.momentum.confidence);
  const avgConfidence = confidenceScores.reduce((a, b) => a + b, 0) / 3;

  // Alignment boost
  const alignmentConfidence = alignment === 'bullish' || alignment === 'bearish'
    ? avgConfidence * 1.3
    : avgConfidence * 0.7;

  // Generate recommendation
  let recommendation: MultiTimeframeAnalysis['recommendation'] = 'hold';

  if (alignment === 'bullish' && alignmentConfidence > 0.6) {
    recommendation = alignmentConfidence > 0.8 ? 'strong_buy' : 'buy';
  } else if (alignment === 'bearish' && alignmentConfidence > 0.6) {
    recommendation = alignmentConfidence > 0.8 ? 'strong_sell' : 'sell';
  }

  return {
    '30min': analysis30m,
    '1hr': analysis1h,
    '4hr': analysis4h,
    alignment,
    confidence: Math.min(1, alignmentConfidence),
    recommendation,
  };
}
