// ============================================================
// تأمین‌کننده‌ی داده‌ی تاریخی OHLC برای بکتست
//
// نکته‌ی مهم: سند فقط یک لایه‌ی پل تعریف می‌کند که کندل‌های *زنده*
// را از MT5 به سرور می‌فرستد (بخش ۵) — منبع داده‌ی *تاریخی* برای
// بکتست در سند مشخص نشده. تا وقتی یک منبع واقعی (تاریخچه‌ی بروکر از
// طریق MT5، یا یک ارائه‌دهنده‌ی داده‌ی بازار) وصل شود، از یک تولیدکننده‌ی
// داده‌ی مصنوعیِ قطعی (deterministic) استفاده می‌شود تا موتور بکتست
// کاملاً قابل تست و نمایش باشد. جایگزین کردن این ماژول با یک fetch
// واقعی به هیچ تغییری در موتور بکتست نیاز ندارد.
// ============================================================
import type { Candle } from "../indicators/engine.js";
import { generateSyntheticCandles } from "../utils/synthetic-candles.js";

export interface HistoricalDataProvider {
  getCandles(symbol: string, timeframeMinutes: number, startUnix: number, endUnix: number): Promise<Candle[]>;
}

function symbolSeed(symbol: string): number {
  let h = 0;
  for (const ch of symbol) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h || 1;
}

function basePriceFor(symbol: string): number {
  if (symbol.startsWith("XAU")) return 2350;
  if (symbol.startsWith("XAG")) return 28;
  if (symbol.includes("BTC")) return 62000;
  if (symbol.includes("ETH")) return 3400;
  if (symbol.includes("JPY")) return 155;
  if (symbol.startsWith("US30") || symbol.startsWith("NAS") || symbol.startsWith("GER")) return 18000;
  return 1.08;
}

export class SyntheticHistoricalDataProvider implements HistoricalDataProvider {
  async getCandles(symbol: string, timeframeMinutes: number, startUnix: number, endUnix: number): Promise<Candle[]> {
    const barSeconds = timeframeMinutes * 60;
    const count = Math.max(50, Math.min(20000, Math.floor((endUnix - startUnix) / barSeconds)));
    const seed = symbolSeed(symbol);
    const base = basePriceFor(symbol);
    // مقیاس نویز/روند بر اساس قیمت پایه، تا رفتار واقع‌گرایانه بماند
    const scale = base > 1000 ? base * 0.00025 : base * 0.001;
    const candles = generateSyntheticCandles(count, {
      startPrice: base,
      trendPerBar: scale * 0.15 * (((seed % 5) - 2) / 2),
      noise: scale,
      seed,
    });
    // زمان کندل‌ها را با بازه‌ی درخواستی هم‌تراز کن
    return candles.map((c, i) => ({ ...c, time: startUnix + i * barSeconds }));
  }
}

export const historicalDataProvider: HistoricalDataProvider = new SyntheticHistoricalDataProvider();

/** تبدیل برچسب دوره (مثل «۳ ماه اخیر») به بازه‌ی start/end یونیکس. */
export function resolvePeriodLabel(label: string, now: number = Math.floor(Date.now() / 1000)): { start: number; end: number } {
  const day = 86400;
  if (label.includes("۳ ماه") || label.includes("3")) return { start: now - 90 * day, end: now };
  if (label.includes("۶ ماه") || label.includes("6")) return { start: now - 180 * day, end: now };
  if (label.includes("۱ سال") || label.includes("1")) return { start: now - 365 * day, end: now };
  return { start: now - 90 * day, end: now };
}
