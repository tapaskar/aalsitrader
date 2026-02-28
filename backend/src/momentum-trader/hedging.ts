/**
 * Hedging Engine for Momentum Trading
 * Calculates ATM options strikes, Greeks, and hedge sizing
 */

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface OptionContract {
  strike: number;
  optionType: 'CE' | 'PE'; // Call or Put
  expiry: string;
  price: number;
  greeks: Greeks;
  lotSize: number;
}

export interface FuturesContract {
  symbol: string;
  price: number;
  lotSize: number;
  marginRequired: number;
}

export interface HedgePosition {
  futures: FuturesContract;
  options: OptionContract;
  futuresQuantity: number;
  optionsQuantity: number;
  hedgeRatio: number;
  maxLoss: number;
  hedgeCost: number;
  netDelta: number;
  protectionLevel: number; // Percentage of futures value protected
}

// F&O Lot Sizes (NSE India) - All 185 F&O Stocks
export const LOT_SIZES: Record<string, number> = {
  // Indices
  'NIFTY': 50,
  'BANKNIFTY': 15,
  'SENSEX': 10,
  'FINNIFTY': 40,

  // Nifty 50
  'RELIANCE': 250,
  'TCS': 150,
  'HDFCBANK': 550,
  'INFY': 250,
  'ICICIBANK': 1375,
  'HINDUNILVR': 300,
  'SBIN': 1500,
  'BHARTIARTL': 425,
  'ITC': 1600,
  'KOTAKBANK': 200,
  'LT': 300,
  'AXISBANK': 625,
  'ASIANPAINT': 150,
  'MARUTI': 100,
  'SUNPHARMA': 550,
  'TITAN': 175,
  'BAJFINANCE': 125,
  'DMART': 75,
  'ULTRACEMCO': 100,
  'WIPRO': 500,
  'NESTLEIND': 25,
  'HCLTECH': 350,
  'M&M': 700,
  'NTPC': 5700,
  'POWERGRID': 2700,
  'TATASTEEL': 850,
  'JSWSTEEL': 700,
  'TECHM': 600,
  'INDUSINDBK': 500,
  'ADANIENT': 400,
  'BAJAJFINSV': 250,
  'ONGC': 3850,
  'COALINDIA': 4200,
  'HINDALCO': 2150,
  'GRASIM': 250,
  'DRREDDY': 125,
  'CIPLA': 650,
  'DIVISLAB': 150,
  'APOLLOHOSP': 125,
  'BPCL': 1800,
  'EICHERMOT': 70,
  'BRITANNIA': 150,
  'TATACONSUM': 350,
  'HEROMOTOCO': 200,
  'SBILIFE': 375,
  'ADANIPORTS': 1250,
  'BAJAJ-AUTO': 250,
  'HDFCLIFE': 650,
  'TATAMOTORS': 1425,
  'UPL': 1300,

  // Nifty Next 50
  'BANKBARODA': 8200,
  'NAUKRI': 100,
  'HAVELLS': 400,
  'GODREJCP': 325,
  'DLF': 650,
  'PIDILITIND': 125,
  'DABUR': 925,
  'SIEMENS': 75,
  'AMBUJACEM': 925,
  'ICICIPRULI': 750,
  'SBICARD': 550,
  'INDIGO': 275,
  'MARICO': 800,
  'BOSCHLTD': 25,
  'BERGEPAINT': 550,
  'COLPAL': 175,
  'MCDOWELL-N': 250,
  'LUPIN': 425,
  'GAIL': 6100,
  'TORNTPHARM': 125,
  'PEL': 250,
  'ACC': 250,
  'ABBOTINDIA': 25,
  'BALKRISIND': 125,
  'BIOCON': 900,
  'CHOLAFIN': 625,
  'CONCOR': 775,
  'CUMMINSIND': 200,
  'GLAND': 250,
  'INDUSTOWER': 2100,
  'JINDALSTEL': 625,
  'LICI': 700,
  'MPHASIS': 150,
  'OFSS': 100,
  'PAGEIND': 15,
  'PFC': 3200,
  'PIIND': 175,
  'RECLTD': 2250,
  'SHREECEM': 25,
  'TATAPOWER': 2700,
  'TRENT': 125,
  'VEDL': 1700,
  'ZOMATO': 2100,
  'ZYDUSLIFE': 775,

  // Other F&O Stocks
  'AARTIIND': 700,
  'ABCAPITAL': 3100,
  'ABFRL': 1900,
  'ADANIGREEN': 350,
  'ALKEM': 125,
  'AMARAJABAT': 500,
  'APLAPOLLO': 350,
  'ASHOKLEY': 3500,
  'ASTRAL': 200,
  'ATUL': 75,
  'AUBANK': 625,
  'AUROPHARMA': 650,
  'BANDHANBNK': 1800,
  'BEL': 4950,
  'BHEL': 5700,
  'BLUEDART': 25,
  'CANBK': 2700,
  'CANFINHOME': 975,
  'CGPOWER': 1525,
  'CHAMBLFERT': 1500,
  'COFORGE': 100,
  'COROMANDEL': 350,
  'CROMPTON': 2000,
  'CUB': 3000,
  'DEEPAKNTR': 250,
  'DELTACORP': 2850,
  'DEVYANI': 3000,
  'DIXON': 75,
  'ESCORTS': 200,
  'EXIDEIND': 1800,
  'FEDERALBNK': 4000,
  'FSL': 4650,
  'GLENMARK': 725,
  'GMRINFRA': 10000,
  'GNFC': 1150,
  'GODREJPROP': 325,
  'GRANULES': 1600,
  'GSPL': 1550,
  'GUJGASLTD': 1250,
  'HAL': 475,
  'HDFCAMC': 200,
  'HINDCOPPER': 2650,
  'HINDPETRO': 2025,
  'HONAUT': 15,
  'IBULHSGFIN': 3800,
  'IDFCFIRSTB': 7500,
  'IEX': 3750,
  'IIFL': 1000,
  'INDIANB': 2000,
  'INDHOTEL': 1350,
  'IOC': 9750,
  'IPCALAB': 500,
  'IRCTC': 575,
  'IGL': 1375,
  'JKCEMENT': 175,
  'JSWENERGY': 1250,
  'JUBLFOOD': 125,
  'KAJARIACER': 375,
  'KPITTECH': 350,
  'L&TFH': 4350,
  'LALPATHLAB': 200,
  'LAURUSLABS': 1100,
  'LICHSGFIN': 1000,
  'LTIM': 150,
  'LTTS': 125,
  'MANAPPURAM': 4000,
  'MANYAVAR': 350,
  'MAXHEALTH': 700,
  'MCX': 400,
  'METROPOLIS': 200,
  'MFSL': 500,
  'MGL': 450,
  'MOTHERSON': 5700,
  'MUTHOOTFIN': 375,
  'NAM-INDIA': 1000,
  'NATIONALUM': 4250,
  'NAVINFLUOR': 150,
  'NIACL': 2500,
  'NMDC': 3350,
  'OBEROIRLTY': 425,
  'OIL': 2150,
  'PAYTM': 800,
  'PERSISTENT': 100,
  'PETRONET': 3000,
  'POLYCAB': 100,
  'POONAWALLA': 1500,
  'PNB': 8000,
  'PVRINOX': 325,
  'RAIN': 2450,
  'RAMCOCEM': 500,
  'RBLBANK': 2900,
  'SAIL': 5550,
  'SANOFI': 50,
  'SRF': 125,
  'STAR': 500,
  'SUNTV': 1000,
  'SYNGENE': 775,
  'TATACHEM': 500,
  'TATACOMM': 250,
  'TATAELXSI': 75,
  'TATAMTRDVR': 550,
  'TVSMOTOR': 350,
  'UBL': 350,
  'UNIONBANK': 3500,
  'UNITDSPR': 250,
  'VOLTAS': 500,
  'WHIRLPOOL': 300,
  'YESBANK': 22000,
  'BDL': 475,
  'UCOBANK': 8200,
};

// ─────────────────────────────────────────────────────────────────────────────
// ATM Strike Selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate the nearest ATM strike price for options
 */
export function calculateATMStrike(
  spotPrice: number,
  strikeInterval: number = 100
): number {
  // Round to nearest strike interval
  const remainder = spotPrice % strikeInterval;
  const lowerStrike = spotPrice - remainder;
  const upperStrike = lowerStrike + strikeInterval;

  // Return the closer strike
  return (spotPrice - lowerStrike) < (upperStrike - spotPrice)
    ? Math.round(lowerStrike)
    : Math.round(upperStrike);
}

/**
 * Get strike interval based on stock price range
 */
export function getStrikeInterval(spotPrice: number): number {
  if (spotPrice >= 20000) return 100;
  if (spotPrice >= 10000) return 100;
  if (spotPrice >= 5000) return 50;
  if (spotPrice >= 2000) return 20;
  if (spotPrice >= 1000) return 10;
  if (spotPrice >= 500) return 10;
  if (spotPrice >= 200) return 5;
  if (spotPrice >= 100) return 5;
  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Greeks Calculation (Approximation using Black-Scholes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard normal cumulative distribution function
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.31938153 + t * (-0.35656378 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/**
 * Standard normal probability density function
 */
function normalPDF(x: number): number {
  return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
}

/**
 * Calculate option price and Greeks using Black-Scholes model
 */
export function calculateGreeks(
  spotPrice: number,
  strike: number,
  timeToExpiry: number, // in years
  volatility: number, // annualized (e.g., 0.30 for 30%)
  riskFreeRate: number, // annualized (e.g., 0.06 for 6%)
  optionType: 'CE' | 'PE'
): { price: number; greeks: Greeks } {
  const d1 = (Math.log(spotPrice / strike) + (riskFreeRate + 0.5 * volatility * volatility) * timeToExpiry)
    / (volatility * Math.sqrt(timeToExpiry));
  const d2 = d1 - volatility * Math.sqrt(timeToExpiry);

  let price: number;
  let delta: number;
  let theta: number;

  const gamma = normalPDF(d1) / (spotPrice * volatility * Math.sqrt(timeToExpiry));
  const vega = spotPrice * normalPDF(d1) * Math.sqrt(timeToExpiry) / 100; // per 1% change

  if (optionType === 'CE') {
    price = spotPrice * normalCDF(d1) - strike * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2);
    delta = normalCDF(d1);
    theta = (-spotPrice * normalPDF(d1) * volatility / (2 * Math.sqrt(timeToExpiry))
      - riskFreeRate * strike * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(d2)) / 365;
  } else {
    price = strike * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(-d2) - spotPrice * normalCDF(-d1);
    delta = normalCDF(d1) - 1;
    theta = (-spotPrice * normalPDF(d1) * volatility / (2 * Math.sqrt(timeToExpiry))
      + riskFreeRate * strike * Math.exp(-riskFreeRate * timeToExpiry) * normalCDF(-d2)) / 365;
  }

  return {
    price: Math.max(0, price),
    greeks: {
      delta: Math.round(delta * 100) / 100,
      gamma: Math.round(gamma * 10000) / 10000,
      theta: Math.round(theta * 100) / 100,
      vega: Math.round(vega * 100) / 100,
    },
  };
}

/**
 * Estimate implied volatility (simplified method)
 * In production, this should be derived from actual market prices
 */
export function estimateVolatility(
  spotPrice: number,
  historicalPrices: number[],
  period: number = 20
): number {
  if (historicalPrices.length < period) return 0.25; // Default 25%

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < historicalPrices.length; i++) {
    returns.push(Math.log(historicalPrices[i] / historicalPrices[i - 1]));
  }

  // Calculate standard deviation of returns
  const recentReturns = returns.slice(-period);
  const mean = recentReturns.reduce((a, b) => a + b, 0) / period;
  const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / period;
  const dailyVol = Math.sqrt(variance);

  // Annualize (252 trading days)
  const annualVol = dailyVol * Math.sqrt(252);

  return Math.max(0.10, Math.min(0.60, annualVol)); // Cap between 10% and 60%
}

// ─────────────────────────────────────────────────────────────────────────────
// Hedge Position Management
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Hedging Strategy Types
// ─────────────────────────────────────────────────────────────────────────────

export type HedgeStrategyType =
  | 'protective_option'     // Long Futures + Buy ATM Put (BUY) / Short Futures + Buy ATM Call (SELL)
  | 'bull_call_spread'      // Buy ATM Call + Sell OTM Call — bullish, lower cost, capped profit
  | 'bear_put_spread'       // Buy ATM Put + Sell OTM Put — bearish, lower cost, capped profit
  | 'iron_condor'           // Sell OTM Call + Buy far OTM Call + Sell OTM Put + Buy far OTM Put — range-bound
  | 'collar'                // Long Futures + Buy OTM Put + Sell OTM Call — near zero-cost protection
  | 'straddle';             // Buy ATM Call + ATM Put — high volatility play

export interface SpreadPosition {
  strategy: HedgeStrategyType;
  legs: Array<{
    optionType: 'CE' | 'PE';
    strike: number;
    action: 'buy' | 'sell';
    price: number;
    greeks: Greeks;
    lotSize: number;
    expiry: string;
  }>;
  futuresLeg?: FuturesContract;
  futuresAction?: 'buy' | 'sell';
  maxProfit: number;
  maxLoss: number;
  breakeven: number[];
  netPremium: number; // Positive = credit received, negative = debit paid
  marginRequired: number;
  hedgeCost: number;
  netDelta: number;
  protectionLevel: number;
  description: string;
}

export interface HedgeConfig {
  spotPrice: number;
  symbol: string;
  futuresEntry: number;
  signal: 'BUY' | 'SELL';
  daysToExpiry: number;
  lotSize?: number;
  volatility?: number;
  riskFreeRate?: number;
  strategy?: HedgeStrategyType;
}

/**
 * Select optimal hedging strategy based on market conditions and conviction
 */
export function selectHedgeStrategy(params: {
  signal: 'BUY' | 'SELL';
  conviction: 'HIGH' | 'MEDIUM' | 'LOW';
  volatility: number; // 0-1 scale
  trendStrength: string; // 'strong', 'moderate', 'weak'
  rsi: number;
}): HedgeStrategyType {
  const { signal, conviction, volatility, trendStrength, rsi } = params;

  // High conviction + strong trend → protective option (max upside, defined risk)
  if (conviction === 'HIGH' && trendStrength === 'strong') {
    return 'protective_option';
  }

  // Medium conviction → spread (lower cost, capped risk & profit)
  if (conviction === 'MEDIUM') {
    return signal === 'BUY' ? 'bull_call_spread' : 'bear_put_spread';
  }

  // Range-bound (RSI 40-60, weak trend) → iron condor
  if (trendStrength === 'weak' && rsi >= 40 && rsi <= 60) {
    return 'iron_condor';
  }

  // High volatility environment → collar for protection
  if (volatility > 0.35) {
    return 'collar';
  }

  // Extreme RSI near events → straddle
  if (rsi > 75 || rsi < 25) {
    return 'straddle';
  }

  // Default: protective option
  return 'protective_option';
}

/**
 * Calculate a spread-based hedge position based on strategy
 */
export function calculateSpreadPosition(config: HedgeConfig): SpreadPosition {
  const {
    spotPrice, symbol, futuresEntry, signal, daysToExpiry,
    lotSize: customLotSize, volatility: customVolatility, riskFreeRate = 0.06,
    strategy = 'protective_option',
  } = config;

  const lotSize = customLotSize || LOT_SIZES[symbol.toUpperCase()] || 100;
  const timeToExpiry = daysToExpiry / 365;
  const vol = customVolatility || 0.25;
  const strikeInterval = getStrikeInterval(spotPrice);
  const atmStrike = calculateATMStrike(spotPrice, strikeInterval);
  const expiry = new Date(Date.now() + daysToExpiry * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const calc = (strike: number, type: 'CE' | 'PE') =>
    calculateGreeks(spotPrice, strike, timeToExpiry, vol, riskFreeRate, type);

  switch (strategy) {
    case 'bull_call_spread': {
      const buyStrike = atmStrike;
      const sellStrike = atmStrike + strikeInterval * 3; // 3 strikes OTM
      const buyCalc = calc(buyStrike, 'CE');
      const sellCalc = calc(sellStrike, 'CE');
      const netDebit = buyCalc.price - sellCalc.price;
      const maxProfit = (sellStrike - buyStrike) * lotSize - netDebit * lotSize;
      const maxLoss = netDebit * lotSize;

      return {
        strategy,
        legs: [
          { optionType: 'CE', strike: buyStrike, action: 'buy', price: buyCalc.price, greeks: buyCalc.greeks, lotSize, expiry },
          { optionType: 'CE', strike: sellStrike, action: 'sell', price: sellCalc.price, greeks: sellCalc.greeks, lotSize, expiry },
        ],
        maxProfit: Math.round(maxProfit),
        maxLoss: Math.round(maxLoss),
        breakeven: [buyStrike + netDebit],
        netPremium: -Math.round(netDebit * lotSize),
        marginRequired: Math.round(maxLoss * 1.2),
        hedgeCost: Math.round(netDebit * lotSize),
        netDelta: Math.round((buyCalc.greeks.delta - sellCalc.greeks.delta) * 100) / 100,
        protectionLevel: Math.round((1 - maxLoss / (spotPrice * lotSize)) * 100),
        description: `Bull Call Spread: Buy ${buyStrike}CE + Sell ${sellStrike}CE | Max Profit ₹${Math.round(maxProfit).toLocaleString()} | Max Loss ₹${Math.round(maxLoss).toLocaleString()}`,
      };
    }

    case 'bear_put_spread': {
      const buyStrike = atmStrike;
      const sellStrike = atmStrike - strikeInterval * 3;
      const buyCalc = calc(buyStrike, 'PE');
      const sellCalc = calc(sellStrike, 'PE');
      const netDebit = buyCalc.price - sellCalc.price;
      const maxProfit = (buyStrike - sellStrike) * lotSize - netDebit * lotSize;
      const maxLoss = netDebit * lotSize;

      return {
        strategy,
        legs: [
          { optionType: 'PE', strike: buyStrike, action: 'buy', price: buyCalc.price, greeks: buyCalc.greeks, lotSize, expiry },
          { optionType: 'PE', strike: sellStrike, action: 'sell', price: sellCalc.price, greeks: sellCalc.greeks, lotSize, expiry },
        ],
        maxProfit: Math.round(maxProfit),
        maxLoss: Math.round(maxLoss),
        breakeven: [buyStrike - netDebit],
        netPremium: -Math.round(netDebit * lotSize),
        marginRequired: Math.round(maxLoss * 1.2),
        hedgeCost: Math.round(netDebit * lotSize),
        netDelta: Math.round((buyCalc.greeks.delta - sellCalc.greeks.delta) * 100) / 100,
        protectionLevel: Math.round((1 - maxLoss / (spotPrice * lotSize)) * 100),
        description: `Bear Put Spread: Buy ${buyStrike}PE + Sell ${sellStrike}PE | Max Profit ₹${Math.round(maxProfit).toLocaleString()} | Max Loss ₹${Math.round(maxLoss).toLocaleString()}`,
      };
    }

    case 'iron_condor': {
      const sellCallStrike = atmStrike + strikeInterval * 2;
      const buyCallStrike = atmStrike + strikeInterval * 4;
      const sellPutStrike = atmStrike - strikeInterval * 2;
      const buyPutStrike = atmStrike - strikeInterval * 4;
      const sellCallCalc = calc(sellCallStrike, 'CE');
      const buyCallCalc = calc(buyCallStrike, 'CE');
      const sellPutCalc = calc(sellPutStrike, 'PE');
      const buyPutCalc = calc(buyPutStrike, 'PE');
      const netCredit = (sellCallCalc.price - buyCallCalc.price) + (sellPutCalc.price - buyPutCalc.price);
      const wingWidth = (buyCallStrike - sellCallStrike) * lotSize;
      const maxLoss = wingWidth - netCredit * lotSize;
      const maxProfit = netCredit * lotSize;

      return {
        strategy,
        legs: [
          { optionType: 'CE', strike: sellCallStrike, action: 'sell', price: sellCallCalc.price, greeks: sellCallCalc.greeks, lotSize, expiry },
          { optionType: 'CE', strike: buyCallStrike, action: 'buy', price: buyCallCalc.price, greeks: buyCallCalc.greeks, lotSize, expiry },
          { optionType: 'PE', strike: sellPutStrike, action: 'sell', price: sellPutCalc.price, greeks: sellPutCalc.greeks, lotSize, expiry },
          { optionType: 'PE', strike: buyPutStrike, action: 'buy', price: buyPutCalc.price, greeks: buyPutCalc.greeks, lotSize, expiry },
        ],
        maxProfit: Math.round(maxProfit),
        maxLoss: Math.round(maxLoss),
        breakeven: [sellPutStrike - netCredit, sellCallStrike + netCredit],
        netPremium: Math.round(netCredit * lotSize),
        marginRequired: Math.round(maxLoss * 1.5),
        hedgeCost: 0, // Credit strategy
        netDelta: Math.round((sellCallCalc.greeks.delta + buyCallCalc.greeks.delta + sellPutCalc.greeks.delta + buyPutCalc.greeks.delta) * 100) / 100,
        protectionLevel: Math.round((netCredit / (sellCallStrike - atmStrike)) * 100),
        description: `Iron Condor: Sell ${sellPutStrike}PE/${sellCallStrike}CE + Buy ${buyPutStrike}PE/${buyCallStrike}CE | Max Profit ₹${Math.round(maxProfit).toLocaleString()} | Max Loss ₹${Math.round(maxLoss).toLocaleString()}`,
      };
    }

    case 'collar': {
      const putStrike = atmStrike - strikeInterval * 2; // OTM put
      const callStrike = atmStrike + strikeInterval * 2; // OTM call
      const putCalc = calc(putStrike, 'PE');
      const callCalc = calc(callStrike, 'CE');
      const netCost = putCalc.price - callCalc.price; // Often near zero
      const futuresMargin = Math.round(futuresEntry * lotSize * 0.15);
      const maxLoss = (futuresEntry - putStrike + Math.max(0, netCost)) * lotSize;
      const maxProfit = (callStrike - futuresEntry - Math.max(0, netCost)) * lotSize;

      return {
        strategy,
        legs: [
          { optionType: 'PE', strike: putStrike, action: 'buy', price: putCalc.price, greeks: putCalc.greeks, lotSize, expiry },
          { optionType: 'CE', strike: callStrike, action: 'sell', price: callCalc.price, greeks: callCalc.greeks, lotSize, expiry },
        ],
        futuresLeg: { symbol, price: futuresEntry, lotSize, marginRequired: futuresMargin },
        futuresAction: 'buy',
        maxProfit: Math.round(maxProfit),
        maxLoss: Math.round(maxLoss),
        breakeven: [futuresEntry + netCost],
        netPremium: -Math.round(netCost * lotSize),
        marginRequired: Math.round(futuresMargin + Math.max(0, netCost * lotSize)),
        hedgeCost: Math.round(Math.max(0, netCost * lotSize)),
        netDelta: Math.round((1 + putCalc.greeks.delta - callCalc.greeks.delta) * 100) / 100,
        protectionLevel: Math.round((1 - maxLoss / (futuresEntry * lotSize)) * 100),
        description: `Collar: Long Futures + Buy ${putStrike}PE + Sell ${callStrike}CE | Max Profit ₹${Math.round(maxProfit).toLocaleString()} | Max Loss ₹${Math.round(maxLoss).toLocaleString()} | Net Cost ₹${Math.round(netCost * lotSize).toLocaleString()}`,
      };
    }

    case 'straddle': {
      const callCalc = calc(atmStrike, 'CE');
      const putCalc = calc(atmStrike, 'PE');
      const totalPremium = callCalc.price + putCalc.price;
      const maxLoss = totalPremium * lotSize;

      return {
        strategy,
        legs: [
          { optionType: 'CE', strike: atmStrike, action: 'buy', price: callCalc.price, greeks: callCalc.greeks, lotSize, expiry },
          { optionType: 'PE', strike: atmStrike, action: 'buy', price: putCalc.price, greeks: putCalc.greeks, lotSize, expiry },
        ],
        maxProfit: Infinity, // Unlimited in either direction
        maxLoss: Math.round(maxLoss),
        breakeven: [atmStrike - totalPremium, atmStrike + totalPremium],
        netPremium: -Math.round(totalPremium * lotSize),
        marginRequired: Math.round(maxLoss * 1.3),
        hedgeCost: Math.round(totalPremium * lotSize),
        netDelta: Math.round((callCalc.greeks.delta + putCalc.greeks.delta) * 100) / 100,
        protectionLevel: 100, // Protected in both directions
        description: `Straddle: Buy ${atmStrike}CE + ${atmStrike}PE | Break-even: ₹${(atmStrike - totalPremium).toFixed(0)} / ₹${(atmStrike + totalPremium).toFixed(0)} | Cost ₹${Math.round(totalPremium * lotSize).toLocaleString()}`,
      };
    }

    case 'protective_option':
    default: {
      // Existing logic - futures + protective option
      const optionType: 'CE' | 'PE' = signal === 'BUY' ? 'PE' : 'CE';
      const optionCalc = calc(atmStrike, optionType);
      const futuresMargin = Math.round(futuresEntry * lotSize * 0.15);
      const hedgeCost = optionCalc.price * lotSize;
      let maxLossPoints: number;
      if (signal === 'BUY') {
        maxLossPoints = Math.max(0, futuresEntry - atmStrike) + optionCalc.price;
      } else {
        maxLossPoints = Math.max(0, atmStrike - futuresEntry) + optionCalc.price;
      }
      const maxLoss = maxLossPoints * lotSize;
      const futuresDelta = signal === 'BUY' ? 1 : -1;

      return {
        strategy: 'protective_option',
        legs: [
          { optionType, strike: atmStrike, action: 'buy', price: optionCalc.price, greeks: optionCalc.greeks, lotSize, expiry },
        ],
        futuresLeg: { symbol, price: futuresEntry, lotSize, marginRequired: futuresMargin },
        futuresAction: signal === 'BUY' ? 'buy' : 'sell',
        maxProfit: Infinity,
        maxLoss: Math.round(maxLoss),
        breakeven: signal === 'BUY' ? [futuresEntry + optionCalc.price] : [futuresEntry - optionCalc.price],
        netPremium: -Math.round(hedgeCost),
        marginRequired: Math.round(futuresMargin + hedgeCost),
        hedgeCost: Math.round(hedgeCost),
        netDelta: Math.round((futuresDelta + optionCalc.greeks.delta) * 100) / 100,
        protectionLevel: Math.min(100, Math.round((futuresEntry * lotSize - maxLoss) / (futuresEntry * lotSize) * 100)),
        description: `Protective ${optionType === 'PE' ? 'Put' : 'Call'}: ${signal} Futures + Buy ${atmStrike}${optionType} | Max Loss ₹${Math.round(maxLoss).toLocaleString()} | Unlimited profit potential`,
      };
    }
  }
}

/**
 * Calculate complete hedge position for a futures trade
 */
export function calculateHedgePosition(config: HedgeConfig): HedgePosition {
  const {
    spotPrice,
    symbol,
    futuresEntry,
    signal,
    daysToExpiry,
    lotSize: customLotSize,
    volatility: customVolatility,
    riskFreeRate = 0.06,
  } = config;

  // Get lot size
  const lotSize = customLotSize || LOT_SIZES[symbol.toUpperCase()] || 100;

  // Determine option type based on futures direction
  // Long futures → Buy Put for protection
  // Short futures → Buy Call for protection
  const optionType: 'CE' | 'PE' = signal === 'BUY' ? 'PE' : 'CE';

  // Calculate ATM strike
  const strikeInterval = getStrikeInterval(spotPrice);
  const atmStrike = calculateATMStrike(spotPrice, strikeInterval);

  // Calculate Greeks
  const timeToExpiry = daysToExpiry / 365;
  const volatility = customVolatility || 0.25;

  const optionCalc = calculateGreeks(spotPrice, atmStrike, timeToExpiry, volatility, riskFreeRate, optionType);

  const optionContract: OptionContract = {
    strike: atmStrike,
    optionType,
    expiry: new Date(Date.now() + daysToExpiry * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    price: Math.round(optionCalc.price * 100) / 100,
    greeks: optionCalc.greeks,
    lotSize,
  };

  const futuresContract: FuturesContract = {
    symbol,
    price: futuresEntry,
    lotSize,
    marginRequired: Math.round(futuresEntry * lotSize * 0.15), // Approx 15% margin
  };

  // 1:1 hedge ratio initially
  const futuresQuantity = 1;
  const optionsQuantity = 1;
  const hedgeRatio = 1.0;

  // Calculate costs
  const hedgeCost = optionContract.price * lotSize;
  const futuresValue = futuresEntry * lotSize;

  // Calculate protection
  // For long futures with put: max loss = (futures entry - put strike) + put premium
  // For short futures with call: max loss = (call strike - futures entry) + call premium
  let maxLossPoints: number;
  if (signal === 'BUY') {
    // Long futures + Put
    maxLossPoints = Math.max(0, futuresEntry - atmStrike) + optionContract.price;
  } else {
    // Short futures + Call
    maxLossPoints = Math.max(0, atmStrike - futuresEntry) + optionContract.price;
  }

  const maxLoss = maxLossPoints * lotSize;

  // Net delta
  // Futures delta = 1, Option delta varies
  const futuresDelta = signal === 'BUY' ? 1 : -1;
  const optionDelta = optionCalc.greeks.delta;
  const netDelta = futuresDelta + optionDelta;

  // Protection level
  const protectionLevel = Math.min(100, Math.round((futuresValue - maxLoss) / futuresValue * 100));

  return {
    futures: futuresContract,
    options: optionContract,
    futuresQuantity,
    optionsQuantity,
    hedgeRatio,
    maxLoss,
    hedgeCost,
    netDelta,
    protectionLevel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Hedge Adjustment
// ─────────────────────────────────────────────────────────────────────────────

export interface HedgeAdjustment {
  action: 'add' | 'reduce' | 'rollover' | 'hold';
  reason: string;
  newOptions?: OptionContract;
  adjustmentCost: number;
  updatedMaxLoss: number;
}

/**
 * Analyze hedge effectiveness and suggest adjustments
 */
export function analyzeHedge(
  position: HedgePosition,
  currentSpotPrice: number,
  daysRemaining: number,
  currentPnl: number
): HedgeAdjustment {
  const { futures, options } = position;
  const optionPrice = options.price * options.lotSize;
  const currentOptionValue = estimateCurrentOptionValue(position, currentSpotPrice, daysRemaining);

  // Check if hedge is still effective
  const deltaDrift = Math.abs(position.netDelta);
  const timeDecay = options.greeks.theta * position.optionsQuantity * options.lotSize;
  const optionPnl = currentOptionValue - optionPrice;

  // Decision rules
  if (daysRemaining <= 2) {
    return {
      action: 'rollover',
      reason: 'Option expiry approaching - time decay accelerating',
      adjustmentCost: optionPrice * 0.5, // Estimate for rolling
      updatedMaxLoss: position.maxLoss,
    };
  }

  if (deltaDrift > 0.3) {
    return {
      action: 'add',
      reason: `Delta drift too high (${deltaDrift.toFixed(2)}), hedge effectiveness reduced`,
      adjustmentCost: optionPrice * 0.5,
      updatedMaxLoss: position.maxLoss * 0.8,
    };
  }

  if (currentPnl > position.futures.price * futures.lotSize * 0.05) {
    return {
      action: 'reduce',
      reason: 'Trade is profitable (>5%), can reduce hedge size to lower cost',
      adjustmentCost: -currentOptionValue * 0.5, // Release some capital
      updatedMaxLoss: position.maxLoss * 1.2,
    };
  }

  if (timeDecay > optionPrice * 0.02) {
    return {
      action: 'rollover',
      reason: 'High theta decay - consider rolling to later expiry',
      adjustmentCost: optionPrice * 0.3,
      updatedMaxLoss: position.maxLoss,
    };
  }

  return {
    action: 'hold',
    reason: 'Hedge is effective within acceptable parameters',
    adjustmentCost: 0,
    updatedMaxLoss: position.maxLoss,
  };
}

/**
 * Estimate current option value based on price movement
 */
function estimateCurrentOptionValue(
  position: HedgePosition,
  currentSpot: number,
  daysRemaining: number
): number {
  const { options } = position;
  const timeToExpiry = daysRemaining / 365;

  const newCalc = calculateGreeks(
    currentSpot,
    options.strike,
    timeToExpiry,
    0.25, // Assume same vol for simplicity
    0.06,
    options.optionType
  );

  return newCalc.price * options.lotSize * position.optionsQuantity;
}

// ─────────────────────────────────────────────────────────────────────────────
// Position Sizing Based on Risk
// ─────────────────────────────────────────────────────────────────────────────

export interface PositionSizeResult {
  futuresLots: number;
  optionLots: number;
  totalCapitalRequired: number;
  maxRiskAmount: number;
  riskPercentageOfCapital: number;
}

/**
 * Calculate position size based on portfolio risk limits
 */
export function calculatePositionSize(
  capital: number,
  maxRiskPercent: number,
  hedgePosition: HedgePosition
): PositionSizeResult {
  const maxRiskAmount = capital * (maxRiskPercent / 100);
  const riskPerLot = hedgePosition.maxLoss;

  // Calculate maximum lots we can take
  const maxLotsByRisk = Math.floor(maxRiskAmount / riskPerLot);

  // Calculate capital required per lot
  const capitalPerLot = hedgePosition.futures.marginRequired + hedgePosition.hedgeCost;
  const maxLotsByCapital = Math.floor(capital / capitalPerLot);

  // Take the more conservative position
  const optimalLots = Math.max(1, Math.min(maxLotsByRisk, maxLotsByCapital));

  return {
    futuresLots: optimalLots,
    optionLots: optimalLots, // 1:1 ratio
    totalCapitalRequired: capitalPerLot * optimalLots,
    maxRiskAmount: riskPerLot * optimalLots,
    riskPercentageOfCapital: (riskPerLot * optimalLots / capital) * 100,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// P&L Calculation with Hedge
// ─────────────────────────────────────────────────────────────────────────────

export interface HedgedPnL {
  futuresPnL: number;
  optionsPnL: number;
  netPnL: number;
  unhedgedRisk: number; // What PnL would be without hedge
  hedgeBenefit: number; // How much hedge saved/lost
}

/**
 * Calculate P&L for hedged position
 */
export function calculateHedgedPnL(
  position: HedgePosition,
  exitPrice: number,
  optionMarketPrice: number
): HedgedPnL {
  const { futures, options, futuresQuantity, optionsQuantity } = position;

  // Futures P&L
  const direction = position.futures.price < exitPrice ? 1 : -1; // Simplified
  const futuresPnL = (exitPrice - futures.price) * futures.lotSize * futuresQuantity * direction;

  // Options P&L (always inverse to protect)
  const optionEntryCost = options.price * options.lotSize * optionsQuantity;
  const optionExitValue = optionMarketPrice * options.lotSize * optionsQuantity;
  const optionsPnL = optionExitValue - optionEntryCost;

  // Net P&L
  const netPnL = futuresPnL + optionsPnL;

  // What would PnL be without hedge
  const unhedgedRisk = futuresPnL;

  // Hedge benefit (positive = hedge helped, negative = hedge cost)
  const hedgeBenefit = optionsPnL;

  return {
    futuresPnL: Math.round(futuresPnL),
    optionsPnL: Math.round(optionsPnL),
    netPnL: Math.round(netPnL),
    unhedgedRisk: Math.round(unhedgedRisk),
    hedgeBenefit: Math.round(hedgeBenefit),
  };
}
