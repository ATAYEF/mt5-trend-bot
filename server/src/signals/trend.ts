// ============================================================
// موتور سیگنال روند (Trend Following)
// طبق بخش ۴.۲: کراس EMA سریع/کند + تأیید ADX + فیلتر RSI +
// در صورت فعال بودن، تأیید تایم‌فریم بالاتر (HTF)
// ============================================================
import type { IndicatorCandle } from "../indicators/engine.js";
import type { BotConfig } from "../types.js";

export type Direction = "buy" | "sell" | "none";

export interface TrendSignalResult {
  direction: Direction;
  reason: string;
  meta: {
    ema_cross: Direction;
    adx: number | null;
    adx_ok: boolean;
    rsi: number | null;
    rsi_ok: boolean;
    htf_ok: boolean | null; // null یعنی تأیید HTF فعال نیست
  };
}

/**
 * تشخیص کراس EMA سریع/کند در آخرین کندل نسبت به کندل قبلی.
 * buy: EMA سریع از پایین به بالای EMA کند رد شده.
 * sell: برعکس.
 */
function detectEmaCross(series: IndicatorCandle[]): Direction {
  const n = series.length;
  if (n < 2) return "none";
  const cur = series[n - 1];
  const prev = series[n - 2];
  if (
    cur.ema_fast == null ||
    cur.ema_slow == null ||
    prev.ema_fast == null ||
    prev.ema_slow == null
  ) {
    return "none";
  }
  const wasBelow = prev.ema_fast <= prev.ema_slow;
  const isAbove = cur.ema_fast > cur.ema_slow;
  if (wasBelow && isAbove) return "buy";

  const wasAbove = prev.ema_fast >= prev.ema_slow;
  const isBelow = cur.ema_fast < cur.ema_slow;
  if (wasAbove && isBelow) return "sell";

  return "none";
}

/**
 * سیگنال روند را روی سری اندیکاتور تایم‌فریم اصلی محاسبه می‌کند.
 * htfSeries در صورت فعال بودن ENABLE_HTF_CONFIRMATION باید سری اندیکاتور
 * محاسبه‌شده روی تایم‌فریم بالاتر (HTF_TIMEFRAME) باشد.
 */
export function computeTrendSignal(
  series: IndicatorCandle[],
  config: BotConfig,
  htfSeries?: IndicatorCandle[]
): TrendSignalResult {
  const cur = series[series.length - 1];
  const cross = detectEmaCross(series);

  const adx = cur.adx;
  const adxOk = adx != null && adx >= config.ADX_TREND_THRESHOLD;

  const rsi = cur.rsi;
  // فیلتر RSI: برای خرید نباید در اشباع خرید افراطی باشیم، برای فروش نباید در اشباع فروش افراطی باشیم
  let rsiOk = false;
  if (rsi != null) {
    if (cross === "buy") rsiOk = rsi < 75;
    else if (cross === "sell") rsiOk = rsi > 25;
    else rsiOk = true;
  }

  let htfOk: boolean | null = null;
  if (config.ENABLE_HTF_CONFIRMATION) {
    htfOk = false;
    if (htfSeries && htfSeries.length > 0) {
      const htfCur = htfSeries[htfSeries.length - 1];
      if (htfCur.ema_fast != null && htfCur.ema_slow != null) {
        if (cross === "buy") htfOk = htfCur.ema_fast > htfCur.ema_slow;
        else if (cross === "sell") htfOk = htfCur.ema_fast < htfCur.ema_slow;
      }
    }
  }

  const meta = { ema_cross: cross, adx, adx_ok: adxOk, rsi, rsi_ok: rsiOk, htf_ok: htfOk };

  if (cross === "none") {
    return { direction: "none", reason: "کراس EMA رخ نداده", meta };
  }
  if (!adxOk) {
    return { direction: "none", reason: `ADX (${adx?.toFixed(1)}) زیر آستانه‌ی روند`, meta };
  }
  if (!rsiOk) {
    return { direction: "none", reason: `RSI (${rsi?.toFixed(1)}) فیلتر روند را رد کرد`, meta };
  }
  if (config.ENABLE_HTF_CONFIRMATION && !htfOk) {
    return { direction: "none", reason: "تأیید تایم‌فریم بالاتر (HTF) ناموفق", meta };
  }

  return {
    direction: cross,
    reason: `کراس EMA ${cross === "buy" ? "صعودی" : "نزولی"} با تأیید ADX${
      config.ENABLE_HTF_CONFIRMATION ? " و HTF" : ""
    }`,
    meta,
  };
}
