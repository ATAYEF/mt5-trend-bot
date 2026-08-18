// ============================================================
// تشخیص رژیم بازار (برای حالت «خودکار»)
// طبق بخش ۴.۴: بر اساس ADX پایین، شیب کم میانه‌ی بولینگر،
// ضریب کارایی کافمن پایین، و ATR در بازه‌ی صدکی میانی،
// بازار «رنج» تشخیص داده می‌شود؛ در غیر این صورت «روند».
// ============================================================
import type { IndicatorCandle } from "../indicators/engine.js";
import type { BotConfig } from "../types.js";

export type MarketRegime = "range" | "trend";

export interface RegimeResult {
  regime: MarketRegime;
  reasons: string[];
  meta: {
    adx: number | null;
    adx_low: boolean;
    bb_mid_slope_percent: number | null;
    bb_slope_low: boolean;
    kaufman_er: number | null;
    efficiency_low: boolean;
    atr_percentile: number | null;
    atr_in_mid_band: boolean;
  };
}

/** شیب درصدی میانه‌ی بولینگر روی lookback کندل اخیر. */
function bbMidSlopePercent(series: IndicatorCandle[], lookback: number): number | null {
  const n = series.length;
  if (n < lookback + 1) return null;
  const cur = series[n - 1].bb_mid;
  const past = series[n - 1 - lookback].bb_mid;
  if (cur == null || past == null || past === 0) return null;
  return (Math.abs(cur - past) / Math.abs(past)) * 100;
}

export function detectMarketRegime(series: IndicatorCandle[], config: BotConfig): RegimeResult {
  const cur = series[series.length - 1];
  const reasons: string[] = [];

  const adx = cur.adx;
  const adxLow = adx != null && adx <= config.REGIME_ADX_MAX;
  reasons.push(adxLow ? `ADX (${adx?.toFixed(1)}) پایین است` : `ADX (${adx?.toFixed(1)}) بالاست`);

  const slope = bbMidSlopePercent(series, config.REGIME_BB_SLOPE_LOOKBACK);
  const bbSlopeLow = slope != null && slope <= config.REGIME_BB_SLOPE_MAX_PERCENT;
  reasons.push(
    bbSlopeLow ? `شیب میانه‌ی بولینگر (${slope?.toFixed(2)}%) کم است` : `شیب میانه‌ی بولینگر (${slope?.toFixed(2)}%) زیاد است`
  );

  const ker = cur.kaufman_er;
  const efficiencyLow = ker != null && ker <= config.REGIME_EFFICIENCY_MAX;
  reasons.push(
    efficiencyLow ? `ضریب کارایی کافمن (${ker?.toFixed(2)}) پایین است` : `ضریب کارایی کافمن (${ker?.toFixed(2)}) بالاست`
  );

  const atrPct = cur.atr_percentile;
  const atrInMidBand =
    atrPct != null &&
    atrPct >= config.REGIME_ATR_MIN_PERCENTILE &&
    atrPct <= config.REGIME_ATR_MAX_PERCENTILE;
  reasons.push(
    atrInMidBand
      ? `صدک ATR (${atrPct?.toFixed(0)}) در بازه‌ی میانی است`
      : `صدک ATR (${atrPct?.toFixed(0)}) خارج از بازه‌ی میانی است`
  );

  const isRange = adxLow && bbSlopeLow && efficiencyLow && atrInMidBand;

  return {
    regime: isRange ? "range" : "trend",
    reasons,
    meta: {
      adx,
      adx_low: adxLow,
      bb_mid_slope_percent: slope,
      bb_slope_low: bbSlopeLow,
      kaufman_er: ker,
      efficiency_low: efficiencyLow,
      atr_percentile: atrPct,
      atr_in_mid_band: atrInMidBand,
    },
  };
}
