/**
 * Option pricing functions — ported from Python (nifty-scalper)
 * Black-Scholes approximations for ATM premium, delta, theta.
 */

import { type IndexName, getIndexConfig } from './index-config.js';

export const TRADING_DAYS_PER_YEAR = 252;
export const TRADING_MINUTES_PER_DAY = 375; // 9:15 to 15:30
/** @deprecated Use getIndexConfig(index).strikeInterval instead */
export const NIFTY_STRIKE_INTERVAL = 50;

/** Error function approximation (Abramowitz & Stegun 7.1.26). */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const t = 1.0 / (1.0 + 0.3275911 * ax);
  const y =
    1.0 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** Estimate ATM option premium: C ≈ 0.4 * S * σ * √T */
export function estimateAtmPremium(
  niftySpot: number,
  daysToExpiry = 3.0,
  iv = 0.13,
): number {
  const T = daysToExpiry / TRADING_DAYS_PER_YEAR;
  return 0.4 * niftySpot * iv * Math.sqrt(Math.max(T, 1e-8));
}

/** Compute approximate option delta using Black-Scholes d1. */
export function computeDelta(
  niftySpot: number,
  strike: number,
  optionType: 'CE' | 'PE',
  daysToExpiry = 3.0,
  iv = 0.13,
): number {
  const T = daysToExpiry / TRADING_DAYS_PER_YEAR;
  const sigmaSqrtT = iv * Math.sqrt(Math.max(T, 1e-8));

  if (sigmaSqrtT < 1e-6) {
    if (optionType === 'CE') return niftySpot > strike ? 1.0 : 0.0;
    return niftySpot < strike ? 1.0 : 0.0;
  }

  const d1 = Math.log(niftySpot / strike) / sigmaSqrtT + 0.5 * sigmaSqrtT;
  const ceDelta = 0.5 * (1.0 + erf(d1 / Math.SQRT2));
  return optionType === 'CE' ? ceDelta : 1.0 - ceDelta;
}

/** Compute theta decay for one bar (non-linear intraday). */
export function computeThetaPerBar(
  premium: number,
  daysToExpiry: number,
  barMinutes = 3,
  currentMinuteOfDay = 0,
): number {
  if (daysToExpiry <= 0 || premium <= 0) return 0.0;

  const dailyDecayRate = 1.0 / (2.0 * Math.max(daysToExpiry, 0.5));
  const dailyTheta = premium * dailyDecayRate;

  const t = Math.max(0, Math.min(currentMinuteOfDay, TRADING_MINUTES_PER_DAY));
  const weight = 1.0 + 1.5 * (t / TRADING_MINUTES_PER_DAY) ** 2;
  const normalization = TRADING_MINUTES_PER_DAY * 1.5;

  const thetaPerMinute = (dailyTheta * weight) / normalization;
  return thetaPerMinute * barMinutes;
}

/**
 * Estimate SPAN + Exposure margin for a short straddle.
 * Uses industry-standard approximation:
 * - SPAN: ~12% of notional for ATM index options
 * - Exposure: ~5% of notional
 * - Cross-margin discount: ~30% for straddle (second leg hedges first)
 * - Premium received partially offsets margin requirement
 */
export function estimateStraddleMargin(
  niftySpot: number,
  lotSize: number,
  lots: number,
  premiumCollected: number,
): { spanMargin: number; exposureMargin: number; totalMargin: number; premiumOffset: number; netMargin: number } {
  const notional = niftySpot * lotSize * lots;
  const SPAN_PCT = 0.12;
  const EXPOSURE_PCT = 0.05;
  const CROSS_MARGIN_DISCOUNT = 0.30;

  // Straddle: full margin for one leg + (1 - discount) for second leg
  const straddleFactor = 2 - CROSS_MARGIN_DISCOUNT; // 1.7
  const spanMargin = notional * SPAN_PCT * straddleFactor;
  const exposureMargin = notional * EXPOSURE_PCT * straddleFactor;
  const totalMargin = spanMargin + exposureMargin;
  const premiumOffset = premiumCollected * lotSize * lots;
  const netMargin = Math.max(totalMargin - premiumOffset, 0);

  return { spanMargin, exposureMargin, totalMargin, premiumOffset, netMargin };
}

/** Update option premium for one bar: delta effect + theta decay. */
export function updatePremium(
  currentPremium: number,
  spotChange: number,
  optionType: 'CE' | 'PE',
  delta: number,
  daysToExpiry: number,
  barMinutes = 3,
  currentMinuteOfDay = 0,
): number {
  const deltaEffect =
    optionType === 'CE' ? delta * spotChange : -delta * spotChange;

  const theta = computeThetaPerBar(
    currentPremium,
    daysToExpiry,
    barMinutes,
    currentMinuteOfDay,
  );

  const newPremium = currentPremium + deltaEffect - theta;
  return Math.max(newPremium, 0.05);
}

/** Find ATM strike for a given index */
export function findATMStrike(spot: number, index: IndexName): number {
  const interval = getIndexConfig(index).strikeInterval;
  return Math.round(spot / interval) * interval;
}

/** Compute strike at an offset from ATM (for strangle / iron condor) */
export function getStrikeAtOffset(atmStrike: number, offset: number, strikeInterval: number): number {
  return atmStrike + offset * strikeInterval;
}

/** Estimate margin for a multi-leg strategy using a margin factor */
export function estimateStrategyMargin(
  spot: number,
  lotSize: number,
  lots: number,
  premiumCollected: number,
  marginFactor: number,
): { totalMargin: number; premiumOffset: number; netMargin: number } {
  const notional = spot * lotSize * lots;
  const SPAN_PCT = 0.12;
  const EXPOSURE_PCT = 0.05;
  const spanMargin = notional * SPAN_PCT * marginFactor;
  const exposureMargin = notional * EXPOSURE_PCT * marginFactor;
  const totalMargin = spanMargin + exposureMargin;
  const premiumOffset = premiumCollected * lotSize * lots;
  const netMargin = Math.max(totalMargin - premiumOffset, 0);
  return { totalMargin, premiumOffset, netMargin };
}
