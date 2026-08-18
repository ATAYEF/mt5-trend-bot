// ============================================================
// موتور سیگنال اسکلپ (Mean-Reversion / برگشت‌ازحد)
// طبق بخش ۴.۳: ورود وقتی قیمت به باند بیرونی بولینگر می‌رسد،
// با تأیید RSI سریع در اشباع خرید/فروش، و در صورت فعال بودن،
// نیاز به کندل رد شدن (فتیله‌دار) قبل از ورود.
// ============================================================
import type { IndicatorCandle } from "../indicators/engine.js";
import type { BotConfig } from "../types.js";
import type { Direction } from "./trend.js";

export interface ScalpSignalResult {
  direction: Direction;
  reason: string;
  meta: {
    touched_band: "upper" | "lower" | "none";
    rsi_fast: number | null;
    rsi_ok: boolean;
    rejection_ok: boolean;
    wick_ratio: number | null;
    spread_ok: boolean;
  };
}

/** نسبت فتیله (wick) به بدنه‌ی کندل برای تشخیص کندل رد شدن. */
function wickRejectionRatio(c: IndicatorCandle, side: "upper" | "lower"): number {
  const body = Math.abs(c.close - c.open) || 1e-9;
  if (side === "upper") {
    const upperWick = c.high - Math.max(c.close, c.open);
    return upperWick / body;
  }
  const lowerWick = Math.min(c.close, c.open) - c.low;
  return lowerWick / body;
}

export function computeScalpSignal(
  series: IndicatorCandle[],
  config: BotConfig,
  currentSpreadPoints = 0
): ScalpSignalResult {
  const cur = series[series.length - 1];

  const spreadOk = currentSpreadPoints <= config.SCALP_MAX_SPREAD_POINTS;

  if (cur.bb_upper == null || cur.bb_lower == null) {
    return {
      direction: "none",
      reason: "باند بولینگر هنوز محاسبه نشده",
      meta: { touched_band: "none", rsi_fast: cur.rsi_fast, rsi_ok: false, rejection_ok: false, wick_ratio: null, spread_ok: spreadOk },
    };
  }

  let touchedBand: "upper" | "lower" | "none" = "none";
  if (cur.high >= cur.bb_upper) touchedBand = "upper";
  else if (cur.low <= cur.bb_lower) touchedBand = "lower";

  if (touchedBand === "none") {
    return {
      direction: "none",
      reason: "قیمت به باند بیرونی بولینگر نرسیده",
      meta: { touched_band: "none", rsi_fast: cur.rsi_fast, rsi_ok: false, rejection_ok: false, wick_ratio: null, spread_ok: spreadOk },
    };
  }

  // touchedBand === upper -> اشباع خرید -> سیگنال فروش (برگشت به میانه)
  // touchedBand === lower -> اشباع فروش -> سیگنال خرید
  const candidateDirection: Direction = touchedBand === "upper" ? "sell" : "buy";

  const rsiFast = cur.rsi_fast;
  let rsiOk = false;
  if (rsiFast != null) {
    rsiOk =
      touchedBand === "upper"
        ? rsiFast >= config.SCALP_RSI_OVERBOUGHT
        : rsiFast <= config.SCALP_RSI_OVERSOLD;
  }

  let rejectionOk = true;
  let wickRatio: number | null = null;
  if (config.SCALP_REQUIRE_REJECTION) {
    wickRatio = wickRejectionRatio(cur, touchedBand);
    rejectionOk = wickRatio >= config.SCALP_REJECTION_WICK_RATIO;
  }

  const meta = {
    touched_band: touchedBand,
    rsi_fast: rsiFast,
    rsi_ok: rsiOk,
    rejection_ok: rejectionOk,
    wick_ratio: wickRatio,
    spread_ok: spreadOk,
  };

  if (!rsiOk) {
    return { direction: "none", reason: `RSI سریع (${rsiFast?.toFixed(1)}) هنوز در اشباع نیست`, meta };
  }
  if (!rejectionOk) {
    return { direction: "none", reason: "کندل رد شدن (فتیله‌دار) تأیید نشد", meta };
  }
  if (!spreadOk) {
    return { direction: "none", reason: "اسپرد فعلی بیشتر از حد مجاز اسکلپ است", meta };
  }

  return {
    direction: candidateDirection,
    reason: `برگشت‌ازحد از باند ${touchedBand === "upper" ? "بالایی" : "پایینی"} بولینگر با تأیید RSI سریع`,
    meta,
  };
}

/** محاسبه‌ی حد ضرر اسکلپ — بر اساس ضریب ATR (SCALP_ATR_SL_MULTIPLIER)، نه درصد ثابت. */
export function computeScalpStopLoss(
  cur: IndicatorCandle,
  direction: Direction,
  config: BotConfig
): number | null {
  if (cur.atr == null) return null;
  const dist = cur.atr * config.SCALP_ATR_SL_MULTIPLIER;
  return direction === "buy" ? cur.close - dist : cur.close + dist;
}

/**
 * محاسبه‌ی هدف خروج اسکلپ (TP) طبق SCALP_TP_MODE — کدهای مورد استفاده در فرم UI:
 * "atr" (بر اساس ضریب ATR — خودکار بر اساس قدرت حرکت) |
 * "structure" (ساختار — میانه/باند مقابل بولینگر) |
 * "rr" (نسبت ریسک/ریوارد ثابت — نسبت به SL محاسبه می‌شود، اینجا فقط میانه‌ی باند به‌عنوان پایه برگردانده می‌شود
 *       و نسبت واقعی در محاسبه‌ی نهایی SL/TP در موتور تصمیم اعمال می‌شود)
 */
export function computeScalpTakeProfit(
  cur: IndicatorCandle,
  direction: Direction,
  config: BotConfig
): number | null {
  const mode = config.SCALP_TP_MODE;

  if (mode === "structure") {
    // باند مقابل بولینگر — هدف برگشت کامل به سمت دیگر باند
    if (direction === "buy" && cur.bb_upper != null) return cur.bb_upper;
    if (direction === "sell" && cur.bb_lower != null) return cur.bb_lower;
    return cur.bb_mid;
  }

  if (mode === "atr" && cur.atr != null) {
    const dist = cur.atr * config.SCALP_TP_ATR_FALLBACK;
    return direction === "buy" ? cur.close + dist : cur.close - dist;
  }

  // mode === "rr" یا حالت پیش‌فرض: میانه‌ی باند به‌عنوان پایه (نسبت R/R در موتور تصمیم اعمال می‌شود)
  return cur.bb_mid ?? null;
}
