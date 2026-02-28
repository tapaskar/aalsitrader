/**
 * DhanHQ v2 REST API wrapper.
 * Supports per-user credentials passed at call-time,
 * falling back to process.env for backward compatibility.
 */

const DHAN_BASE = 'https://api.dhan.co/v2';
const NIFTY_SECURITY_ID = 13;

export interface DhanCredentials {
  accessToken: string;
  clientId: string;
}

function getHeaders(creds?: DhanCredentials): Record<string, string> {
  return {
    'access-token': creds?.accessToken || process.env.DHAN_ACCESS_TOKEN || '',
    'client-id': creds?.clientId || process.env.DHAN_CLIENT_ID || '',
    'Content-Type': 'application/json',
  };
}

function hasToken(creds?: DhanCredentials): boolean {
  return !!(creds?.accessToken || process.env.DHAN_ACCESS_TOKEN);
}

/**
 * Renew a DhanHQ access token before it expires.
 * POST /v2/RenewToken — only works while the current token is still active.
 * Returns the new access token string, or null if renewal fails.
 */
export async function renewDhanToken(creds: DhanCredentials): Promise<{ accessToken: string; expiryTime: string } | null> {
  if (!creds.accessToken || !creds.clientId) return null;
  try {
    const res = await fetch(`${DHAN_BASE}/RenewToken`, {
      method: 'POST',
      headers: {
        'access-token': creds.accessToken,
        'dhanClientId': creds.clientId,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 400 || res.status === 401) {
        console.warn(`[DhanHQ] Token renewal failed (token likely expired) — user must generate a fresh token from web.dhan.co. HTTP ${res.status}: ${text.slice(0, 200)}`);
      } else {
        console.error(`[DhanHQ] Token renewal failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
      }
      return null;
    }
    const data = await res.json();
    if (data.accessToken) {
      console.log(`[DhanHQ] Token renewed successfully, expires: ${data.expiryTime}`);
      return { accessToken: data.accessToken, expiryTime: data.expiryTime || '' };
    }
    console.error(`[DhanHQ] Token renewal returned no accessToken:`, JSON.stringify(data).slice(0, 200));
    return null;
  } catch (err: any) {
    console.error(`[DhanHQ] Token renewal error:`, err.message);
    return null;
  }
}

/**
 * Generate a fresh DhanHQ access token using TOTP (2FA).
 * Works even when the current token is expired.
 * Requires: clientId, 6-digit trading PIN, and TOTP secret.
 */
export async function generateDhanToken(clientId: string, pin: string, totpSecret: string): Promise<string | null> {
  const MAX_TOTP_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_TOTP_ATTEMPTS; attempt++) {
    try {
      const { authenticator } = await import('otplib');
      const totp = authenticator.generate(totpSecret);

      console.log(`[DhanHQ] TOTP attempt ${attempt}/${MAX_TOTP_ATTEMPTS}: clientId=${clientId}, pin=${pin.length}chars, totpCode=${totp} (secret=${totpSecret.length}chars)`);

      const url = `https://auth.dhan.co/app/generateAccessToken?dhanClientId=${encodeURIComponent(clientId)}&pin=${encodeURIComponent(pin)}&totp=${encodeURIComponent(totp)}`;

      const res = await fetch(url, { method: 'POST' });
      const text = await res.text();
      console.log(`[DhanHQ] TOTP response: HTTP ${res.status} — ${text.slice(0, 500)}`);

      let data: any;
      try { data = JSON.parse(text); } catch { return null; }

      if (data.accessToken) {
        console.log(`[DhanHQ] Fresh token generated via TOTP for client ${clientId}`);
        return data.accessToken;
      }

      // If "Invalid TOTP", wait for next 30s time window and retry
      if (attempt < MAX_TOTP_ATTEMPTS && data.message === 'Invalid TOTP') {
        console.log(`[DhanHQ] Invalid TOTP — waiting 31s for next time window before retry...`);
        await new Promise(r => setTimeout(r, 31_000));
        continue;
      }

      console.error(`[DhanHQ] TOTP token generation failed:`, JSON.stringify(data).slice(0, 500));
      return null;
    } catch (err: any) {
      console.error(`[DhanHQ] TOTP token generation error:`, err.message);
      return null;
    }
  }
  return null;
}

// ── Paper mode functions ─────────────────────────────────────

export async function checkConnectivity(creds?: DhanCredentials): Promise<{ connected: boolean; error: string | null }> {
  if (!hasToken(creds)) {
    return { connected: false, error: 'DHAN_ACCESS_TOKEN not configured' };
  }
  try {
    const res = await fetch(`${DHAN_BASE}/fundlimit`, { headers: getHeaders(creds) });
    if (res.ok) return { connected: true, error: null };
    const text = await res.text();
    return { connected: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  } catch (e: any) {
    return { connected: false, error: e.message };
  }
}

export async function getNiftySpot(creds?: DhanCredentials): Promise<{ price: number; timestamp: Date } | null> {
  if (!hasToken(creds)) return null;
  try {
    const res = await fetch(`${DHAN_BASE}/marketfeed/ltp`, {
      method: 'POST',
      headers: getHeaders(creds),
      body: JSON.stringify({ IDX_I: [NIFTY_SECURITY_ID] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const idx = data?.data?.IDX_I;
    if (idx && idx[String(NIFTY_SECURITY_ID)]) {
      const info = idx[String(NIFTY_SECURITY_ID)];
      return { price: info.last_price || info.LTP || info.ltp, timestamp: new Date() };
    }
    if (data?.data?.last_price) {
      return { price: data.data.last_price, timestamp: new Date() };
    }
    return null;
  } catch (e: any) {
    console.error('getNiftySpot error:', e.message);
    return null;
  }
}

export interface MarketStatus {
  isOpen: boolean;
  istHour: number;
  istMinute: number;
  istTime: string;
}

export function isMarketOpen(): MarketStatus {
  const now = new Date();
  const istStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const ist = new Date(istStr);
  const day = ist.getDay();
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && totalMinutes >= 555 && totalMinutes <= 930;
  return {
    isOpen,
    istHour: hours,
    istMinute: minutes,
    istTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

export function getMinutesSinceOpen(): number {
  const { istHour, istMinute } = isMarketOpen();
  return Math.max(0, Math.min((istHour - 9) * 60 + istMinute - 15, 375));
}

// ── Live mode functions ──────────────────────────────────────

export interface OptionChainStrike {
  strikePrice: number;
  ceSecurityId: number;
  peSecurityId: number;
  ceLtp: number;
  peLtp: number;
  ceOi: number;
  peOi: number;
}

/** Map symbol name to DhanHQ security ID */
const SYMBOL_TO_SCRIP: Record<string, number> = { NIFTY: 13, BANKNIFTY: 25 };

export async function getNearestExpiry(creds?: DhanCredentials, symbolName = 'NIFTY'): Promise<string | null> {
  if (!hasToken(creds)) return null;
  const scrip = SYMBOL_TO_SCRIP[symbolName] ?? NIFTY_SECURITY_ID;
  try {
    const res = await fetch(`${DHAN_BASE}/optionchain/expirylist`, {
      method: 'POST',
      headers: getHeaders(creds),
      body: JSON.stringify({ UnderlyingScrip: scrip, UnderlyingSeg: 'IDX_I' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const expiries: string[] = data?.data || [];
    if (expiries.length === 0) return null;
    // Return the nearest expiry (first in sorted list)
    return expiries[0];
  } catch (e: any) {
    console.error('getNearestExpiry error:', e.message);
    return null;
  }
}

export async function getOptionChain(expiry: string, creds?: DhanCredentials, symbolName = 'NIFTY'): Promise<OptionChainStrike[]> {
  if (!hasToken(creds)) return [];
  const scrip = SYMBOL_TO_SCRIP[symbolName] ?? NIFTY_SECURITY_ID;
  try {
    const res = await fetch(`${DHAN_BASE}/optionchain`, {
      method: 'POST',
      headers: getHeaders(creds),
      body: JSON.stringify({
        UnderlyingScrip: scrip,
        UnderlyingSeg: 'IDX_I',
        Expiry: expiry,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const chain = data?.data || {};
    const strikes: OptionChainStrike[] = [];

    // Parse the option chain response - keyed by strike price
    for (const [strikeStr, strikeData] of Object.entries(chain)) {
      const sd = strikeData as any;
      if (!sd.ce && !sd.pe) continue;
      strikes.push({
        strikePrice: parseFloat(strikeStr),
        ceSecurityId: sd.ce?.security_id || 0,
        peSecurityId: sd.pe?.security_id || 0,
        ceLtp: sd.ce?.last_price || sd.ce?.ltp || 0,
        peLtp: sd.pe?.last_price || sd.pe?.ltp || 0,
        ceOi: sd.ce?.oi || 0,
        peOi: sd.pe?.oi || 0,
      });
    }
    return strikes;
  } catch (e: any) {
    console.error('getOptionChain error:', e.message);
    return [];
  }
}

export interface OrderResult {
  orderId: string;
  orderStatus: string;
}

export async function placeOrder(params: {
  securityId: number;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  orderType?: 'MARKET' | 'LIMIT';
  price?: number;
  productType?: 'INTRADAY' | 'MARGIN' | 'CNC';
  exchangeSegment?: string;
}, creds?: DhanCredentials): Promise<OrderResult | null> {
  if (!hasToken(creds)) return null;
  try {
    const clientId = creds?.clientId || process.env.DHAN_CLIENT_ID || '';
    const body = {
      dhanClientId: clientId,
      transactionType: params.transactionType,
      exchangeSegment: params.exchangeSegment || 'NSE_FNO',
      productType: params.productType || 'INTRADAY',
      orderType: params.orderType || 'MARKET',
      validity: 'DAY',
      securityId: String(params.securityId),
      quantity: params.quantity,
      price: params.price || 0,
      triggerPrice: 0,
      disclosedQuantity: 0,
      afterMarketOrder: false,
    };

    const res = await fetch(`${DHAN_BASE}/orders`, {
      method: 'POST',
      headers: getHeaders(creds),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('placeOrder error:', JSON.stringify(data));
      return null;
    }
    return { orderId: data.orderId || '', orderStatus: data.orderStatus || '' };
  } catch (e: any) {
    console.error('placeOrder exception:', e.message);
    return null;
  }
}

export async function getOrderStatus(orderId: string, creds?: DhanCredentials): Promise<any> {
  if (!hasToken(creds)) return null;
  try {
    const res = await fetch(`${DHAN_BASE}/orders/${orderId}`, { headers: getHeaders(creds) });
    if (!res.ok) return null;
    return res.json();
  } catch (e: any) {
    console.error('getOrderStatus error:', e.message);
    return null;
  }
}

export async function getPositions(creds?: DhanCredentials): Promise<any[]> {
  if (!hasToken(creds)) return [];
  try {
    const res = await fetch(`${DHAN_BASE}/positions`, { headers: getHeaders(creds) });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data || [];
  } catch (e: any) {
    console.error('getPositions error:', e.message);
    return [];
  }
}
