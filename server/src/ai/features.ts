// ============================================================
// موتور هوش مصنوعی کمکی — استخراج ویژگی
// طبق بخش ۴.۹: فاصله‌ی EMA، RSI، ATR، عرض بولینگر، نسبت بدنه‌ی کندل
// ============================================================
import { computeIndicators, type Candle } from "../indicators/engine.js";

export interface FeatureRow {
  features: number[];
  label: 0 | 1; // 1 = کندل بعدی صعودی بود، 0 = نزولی/خنثی
}

export const FEATURE_NAMES = [
  "ema_distance_pct", // فاصله‌ی EMA سریع از EMA کند (درصدی از قیمت)
  "rsi_normalized", // RSI نرمال‌شده به بازه‌ی -1..1
  "atr_pct", // ATR به‌عنوان درصدی از قیمت (نوسان نسبی)
  "bb_width_pct", // عرض باند بولینگر به‌عنوان درصدی از قیمت
  "candle_body_ratio", // نسبت بدنه به کل دامنه‌ی کندل (جهت‌دار: مثبت=صعودی)
];

/** استخراج ماتریس ویژگی + برچسب از یک سری کندل. آخرین ردیف بدون برچسب (برای پیش‌بینی) قابل استفاده است. */
export function extractFeatures(candles: Candle[]): FeatureRow[] {
  const series = computeIndicators(candles);
  const rows: FeatureRow[] = [];

  for (let i = 0; i < series.length - 1; i++) {
    const c = series[i];
    if (
      c.ema_fast == null ||
      c.ema_slow == null ||
      c.rsi == null ||
      c.atr == null ||
      c.bb_upper == null ||
      c.bb_lower == null
    ) {
      continue;
    }
    const emaDistPct = ((c.ema_fast - c.ema_slow) / c.close) * 100;
    const rsiNorm = (c.rsi - 50) / 50;
    const atrPct = (c.atr / c.close) * 100;
    const bbWidthPct = ((c.bb_upper - c.bb_lower) / c.close) * 100;
    const bodyRatio = (c.close - c.open) / (c.high - c.low || 1e-9);

    const nextClose = series[i + 1].close;
    const label: 0 | 1 = nextClose > c.close ? 1 : 0;

    rows.push({ features: [emaDistPct, rsiNorm, atrPct, bbWidthPct, bodyRatio], label });
  }

  return rows;
}

/** استخراج بردار ویژگی آخرین کندل (بدون برچسب) برای پیش‌بینی لحظه‌ای. */
export function extractLatestFeatureVector(candles: Candle[]): number[] | null {
  const series = computeIndicators(candles);
  const c = series[series.length - 1];
  if (c.ema_fast == null || c.ema_slow == null || c.rsi == null || c.atr == null || c.bb_upper == null || c.bb_lower == null) {
    return null;
  }
  return [
    ((c.ema_fast - c.ema_slow) / c.close) * 100,
    (c.rsi - 50) / 50,
    (c.atr / c.close) * 100,
    ((c.bb_upper - c.bb_lower) / c.close) * 100,
    (c.close - c.open) / (c.high - c.low || 1e-9),
  ];
}
