/**
 * Broker-agnostic market hours utilities.
 * Extracted from dhan-client.ts so all adapters can use them.
 */

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
