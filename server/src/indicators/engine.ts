// ============================================================
// موتور اندیکاتور — کاملاً خالص (Pure)
// طبق سند بخش ۴.۱: هیچ وابستگی به MT5 یا منبع داده‌ی خاصی ندارد.
// فقط روی آرایه‌ای از کندل‌های OHLC کار می‌کند و قابل تست با
// داده‌ی مصنوعی است.
// ============================================================

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** یک کندل به همراه مقادیر اندیکاتور محاسبه‌شده برای همان کندل. */
export interface IndicatorCandle extends Candle {
  ema_fast: number | null;
  ema_slow: number | null;
  rsi: number | null;
  rsi_fast: number | null;
  atr: number | null;
  adx: number | null;
  plus_di: number | null;
  minus_di: number | null;
  donchian_upper: number | null;
  donchian_lower: number | null;
  donchian_mid: number | null;
  bb_upper: number | null;
  bb_mid: number | null;
  bb_lower: number | null;
  kaufman_er: number | null;
  atr_percentile: number | null;
}

export interface IndicatorOptions {
  emaFastPeriod?: number; // پیش‌فرض ۲۰
  emaSlowPeriod?: number; // پیش‌فرض ۵۰
  rsiPeriod?: number; // پیش‌فرض ۱۴
  rsiFastPeriod?: number; // برای اسکلپ — پیش‌فرض ۷
  atrPeriod?: number; // پیش‌فرض ۱۴
  adxPeriod?: number; // پیش‌فرض ۱۴
  donchianPeriod?: number; // پیش‌فرض ۲۰
  bbPeriod?: number; // پیش‌فرض ۲۰
  bbStd?: number; // پیش‌فرض ۲
  kaufmanPeriod?: number; // پیش‌فرض ۱۰
  atrPercentileLookback?: number; // پیش‌فرض ۱۰۰
}

const DEFAULTS: Required<IndicatorOptions> = {
  emaFastPeriod: 20,
  emaSlowPeriod: 50,
  rsiPeriod: 14,
  rsiFastPeriod: 7,
  atrPeriod: 14,
  adxPeriod: 14,
  donchianPeriod: 20,
  bbPeriod: 20,
  bbStd: 2,
  kaufmanPeriod: 10,
  atrPercentileLookback: 100,
};

/** EMA ساده روی آرایه‌ی بسته‌شدن قیمت‌ها. خروجی هم‌طول ورودی، ابتدا null تا رسیدن به period. */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length === 0 || period <= 0) return out;
  const k = 2 / (period + 1);
  let seeded = false;
  let prev = 0;
  for (let i = 0; i < values.length; i++) {
    if (!seeded) {
      if (i + 1 < period) continue;
      // seed با میانگین ساده‌ی period اول
      const slice = values.slice(i + 1 - period, i + 1);
      prev = slice.reduce((a, b) => a + b, 0) / period;
      out[i] = prev;
      seeded = true;
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** RSI با صاف‌سازی وایلدر (Wilder Smoothing). */
export function rsiWilder(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    avgGain += Math.max(diff, 0);
    avgLoss += Math.max(-diff, 0);
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = rsiFromAvg(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFromAvg(avgGain, avgLoss);
  }
  return out;
}

function rsiFromAvg(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** True Range برای هر کندل. */
export function trueRange(candles: Candle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
  });
}

/** ATR با صاف‌سازی وایلدر. */
export function atrWilder(candles: Candle[], period: number): (number | null)[] {
  const tr = trueRange(candles);
  return wilderSmooth(tr, period);
}

function wilderSmooth(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (prev * (period - 1) + values[i]) / period;
    out[i] = prev;
  }
  return out;
}

export interface ADXResult {
  adx: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
}

/** ADX / +DI / -DI با صاف‌سازی وایلدر. */
export function adxWilder(candles: Candle[], period: number): ADXResult {
  const n = candles.length;
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);
  const tr = trueRange(candles);

  for (let i = 1; i < n; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  const smoothedTR = wilderSmooth(tr, period);
  const smoothedPlusDM = wilderSmooth(plusDM, period);
  const smoothedMinusDM = wilderSmooth(minusDM, period);

  const plusDI: (number | null)[] = new Array(n).fill(null);
  const minusDI: (number | null)[] = new Array(n).fill(null);
  const dx: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const trv = smoothedTR[i];
    const pdm = smoothedPlusDM[i];
    const mdm = smoothedMinusDM[i];
    if (trv == null || pdm == null || mdm == null || trv === 0) continue;
    const pdi = (pdm / trv) * 100;
    const mdi = (mdm / trv) * 100;
    plusDI[i] = pdi;
    minusDI[i] = mdi;
    const sum = pdi + mdi;
    dx[i] = sum === 0 ? 0 : (Math.abs(pdi - mdi) / sum) * 100;
  }

  // ADX = میانگین وایلدر روی DX
  const validDx: number[] = [];
  const dxIndexMap: number[] = [];
  dx.forEach((v, i) => {
    if (v != null) {
      validDx.push(v);
      dxIndexMap.push(i);
    }
  });
  const adxSmoothed = wilderSmooth(validDx, period);
  const adx: (number | null)[] = new Array(n).fill(null);
  adxSmoothed.forEach((v, idx) => {
    if (v != null) adx[dxIndexMap[idx]] = v;
  });

  return { adx, plusDI, minusDI };
}

/** کانال دانچیان (بالاترین سقف / پایین‌ترین کف در N کندل اخیر). */
export function donchian(
  candles: Candle[],
  period: number
): { upper: (number | null)[]; lower: (number | null)[]; mid: (number | null)[] } {
  const n = candles.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  const mid: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i + 1 < period) continue;
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i + 1 - period; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    upper[i] = hi;
    lower[i] = lo;
    mid[i] = (hi + lo) / 2;
  }
  return { upper, lower, mid };
}

/** باند بولینگر (میانگین متحرک ساده ± انحراف معیار). */
export function bollinger(
  values: number[],
  period: number,
  stdMultiplier: number
): { upper: (number | null)[]; mid: (number | null)[]; lower: (number | null)[] } {
  const n = values.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const mid: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i + 1 < period) continue;
    const slice = values.slice(i + 1 - period, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    mid[i] = mean;
    upper[i] = mean + stdMultiplier * std;
    lower[i] = mean - stdMultiplier * std;
  }
  return { upper, mid, lower };
}

/** ضریب کارایی کافمن (Kaufman Efficiency Ratio) — 0..1؛ عدد بالا یعنی روند تمیز، عدد پایین یعنی نویز/رنج. */
export function kaufmanEfficiencyRatio(values: number[], period: number): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i - period < 0) continue;
    const direction = Math.abs(values[i] - values[i - period]);
    let volatility = 0;
    for (let j = i - period + 1; j <= i; j++) {
      volatility += Math.abs(values[j] - values[j - 1]);
    }
    out[i] = volatility === 0 ? 0 : direction / volatility;
  }
  return out;
}

/** صدک فعلی ATR نسبت به N مقدار اخیر (۰..۱۰۰). برای فیلتر تشخیص رژیم بازار. */
export function atrPercentile(atrValues: (number | null)[], lookback: number): (number | null)[] {
  const n = atrValues.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const current = atrValues[i];
    if (current == null) continue;
    const start = Math.max(0, i - lookback + 1);
    const windowVals = atrValues.slice(start, i + 1).filter((v): v is number => v != null);
    if (windowVals.length < 2) continue;
    const countBelow = windowVals.filter((v) => v <= current).length;
    out[i] = (countBelow / windowVals.length) * 100;
  }
  return out;
}

/**
 * تابع اصلی موتور اندیکاتور: آرایه‌ای از کندل خام می‌گیرد،
 * آرایه‌ای هم‌طول از IndicatorCandle برمی‌گرداند (کندل + همه‌ی اندیکاتورها).
 */
export function computeIndicators(
  candles: Candle[],
  opts: IndicatorOptions = {}
): IndicatorCandle[] {
  const o = { ...DEFAULTS, ...opts };
  const closes = candles.map((c) => c.close);

  const emaFast = ema(closes, o.emaFastPeriod);
  const emaSlow = ema(closes, o.emaSlowPeriod);
  const rsi = rsiWilder(closes, o.rsiPeriod);
  const rsiFast = rsiWilder(closes, o.rsiFastPeriod);
  const atr = atrWilder(candles, o.atrPeriod);
  const { adx, plusDI, minusDI } = adxWilder(candles, o.adxPeriod);
  const dc = donchian(candles, o.donchianPeriod);
  const bb = bollinger(closes, o.bbPeriod, o.bbStd);
  const ker = kaufmanEfficiencyRatio(closes, o.kaufmanPeriod);
  const atrPct = atrPercentile(atr, o.atrPercentileLookback);

  return candles.map((c, i) => ({
    ...c,
    ema_fast: emaFast[i],
    ema_slow: emaSlow[i],
    rsi: rsi[i],
    rsi_fast: rsiFast[i],
    atr: atr[i],
    adx: adx[i],
    plus_di: plusDI[i],
    minus_di: minusDI[i],
    donchian_upper: dc.upper[i],
    donchian_lower: dc.lower[i],
    donchian_mid: dc.mid[i],
    bb_upper: bb.upper[i],
    bb_mid: bb.mid[i],
    bb_lower: bb.lower[i],
    kaufman_er: ker[i],
    atr_percentile: atrPct[i],
  }));
}
