/**
 * Strategy type definitions for the multi-strategy Nifty Scalper engine.
 * Each strategy defines its leg templates and exit rules.
 */

export type StrategyType = 'short_straddle' | 'short_strangle' | 'iron_condor';

export interface LegTemplate {
  /** Option side: CE (call) or PE (put) */
  side: 'CE' | 'PE';
  /** Order action: BUY or SELL */
  action: 'BUY' | 'SELL';
  /** Strike offset from ATM in multiples of strikeInterval. 0=ATM, +1=1 OTM, -1=1 ITM */
  strikeOffset: number;
}

export interface ExitRules {
  /** Per-leg stop loss (% increase from entry premium). Null = disabled. */
  perLegSlPct: number | null;
  /** Combined premium stop loss (% increase from total collected). */
  combinedSlPct: number;
  /** Profit target (% decrease from total collected / increase from total paid). */
  profitTargetPct: number;
}

export interface StrategyConfig {
  type: StrategyType;
  displayName: string;
  shortDescription: string;
  legs: LegTemplate[];
  exitRules: ExitRules;
  /** Margin multiplier vs naked single leg (approximate) */
  marginFactor: number;
}

/** Trade leg stored in DynamoDB */
export interface TradeLeg {
  side: 'CE' | 'PE';
  action: 'BUY' | 'SELL';
  strikePrice: number;
  instrumentId?: string;
  orderId?: string;
  entryPremium: number;
  exitPremium?: number;
  exitOrderId?: string;
}

export const STRATEGY_CONFIGS: Record<StrategyType, StrategyConfig> = {
  short_straddle: {
    type: 'short_straddle',
    displayName: 'Short Straddle',
    shortDescription: 'Sell ATM CE + PE. Max profit from theta decay.',
    legs: [
      { side: 'CE', action: 'SELL', strikeOffset: 0 },
      { side: 'PE', action: 'SELL', strikeOffset: 0 },
    ],
    exitRules: {
      perLegSlPct: 100,
      combinedSlPct: 70,
      profitTargetPct: 60,
    },
    marginFactor: 1.7, // Cross-margin discount for straddle
  },

  short_strangle: {
    type: 'short_strangle',
    displayName: 'Short Strangle',
    shortDescription: 'Sell OTM CE + PE. Wider range, lower premium.',
    legs: [
      { side: 'CE', action: 'SELL', strikeOffset: 2 },   // 2 strikes OTM (CE: higher strike)
      { side: 'PE', action: 'SELL', strikeOffset: -2 },   // 2 strikes OTM (PE: lower strike)
    ],
    exitRules: {
      perLegSlPct: 120,
      combinedSlPct: 80,
      profitTargetPct: 50,
    },
    marginFactor: 1.6,
  },

  iron_condor: {
    type: 'iron_condor',
    displayName: 'Iron Condor',
    shortDescription: 'Sell OTM CE+PE, buy further OTM as hedge. Defined risk.',
    legs: [
      { side: 'CE', action: 'SELL', strikeOffset: 1 },    // Sell 1 OTM CE
      { side: 'CE', action: 'BUY', strikeOffset: 3 },     // Buy 3 OTM CE (hedge)
      { side: 'PE', action: 'SELL', strikeOffset: -1 },    // Sell 1 OTM PE
      { side: 'PE', action: 'BUY', strikeOffset: -3 },     // Buy 3 OTM PE (hedge)
    ],
    exitRules: {
      perLegSlPct: null, // No per-leg SL for hedged strategies
      combinedSlPct: 100,
      profitTargetPct: 50,
    },
    marginFactor: 0.8, // Lower margin due to hedging
  },
};

export function getStrategyConfig(type: StrategyType): StrategyConfig {
  return STRATEGY_CONFIGS[type];
}

/** Compute the actual strike price for a leg template given ATM and strike interval */
export function computeLegStrike(atmStrike: number, leg: LegTemplate, strikeInterval: number): number {
  return atmStrike + leg.strikeOffset * strikeInterval;
}

/**
 * Autonomously select the best strategy based on market conditions.
 * Decision matrix:
 * - Expiry day (DTE 0-0.5): Short straddle — max theta decay, premiums melt fastest
 * - DTE 1: Short strangle — buffer for overnight gap risk
 * - DTE 2+: Iron condor — defined risk for longer exposure
 * - After 2:00 PM on any day: Prefer straddle (accelerated theta in final 90 min)
 * - After 3+ consecutive SL exits: Iron condor for protection
 */
export function autoSelectStrategy(
  dte: number,
  istHour: number,
  istMinute: number,
  recentExitReasons?: string[],
): { strategy: StrategyType; index: 'NIFTY'; reason: string } {
  // Always trade NIFTY (most liquid, tightest spreads)
  const index = 'NIFTY' as const;

  // Check recent performance: 3+ consecutive stop losses → go hedged
  if (recentExitReasons && recentExitReasons.length >= 3) {
    const lastThree = recentExitReasons.slice(-3);
    const allSL = lastThree.every(r => r.startsWith('sl_'));
    if (allSL) {
      return { strategy: 'iron_condor', index, reason: '3+ consecutive SL hits — switching to hedged strategy' };
    }
  }

  // Afternoon session (after 2 PM) — premium decay accelerates, go ATM
  const timeMinutes = istHour * 60 + istMinute;
  if (timeMinutes >= 840) { // 2:00 PM
    return { strategy: 'short_straddle', index, reason: 'Afternoon session — max theta decay at ATM' };
  }

  // DTE-based selection
  if (dte <= 0.5) {
    // Expiry day — premiums are tiny, straddle captures max decay
    return { strategy: 'short_straddle', index, reason: 'Expiry day — ATM straddle for max theta' };
  }

  if (dte <= 1.5) {
    // 1 day to expiry — strangle for wider safety margin
    return { strategy: 'short_strangle', index, reason: '1 DTE — strangle for wider range' };
  }

  // 2+ DTE — use iron condor for defined risk
  return { strategy: 'iron_condor', index, reason: '2+ DTE — iron condor for defined risk' };
}
