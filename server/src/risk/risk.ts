// ============================================================
// مدیریت ریسک
// طبق بخش ۴.۵: محاسبه‌ی حجم معامله بر اساس درصد ریسک و فاصله‌ی SL؛
// سه روش تعیین TP/SL (درصدی ساده / ساختاری S-R / کانال دانچیان)؛
// در نظر گرفتن اهرم حساب اگر «ریسک آگاه از اهرم» فعال باشد.
// ============================================================
import type { IndicatorCandle } from "../indicators/engine.js";
import type { BotConfig } from "../types.js";
import type { Direction } from "../signals/trend.js";

export interface StopLevels {
  sl: number;
  tp: number;
  method: string;
}

export interface VolumeResult {
  volume: number;
  riskAmount: number;
  slDistance: number;
  reason: string;
}

/**
 * سطوح حمایت/مقاومت اخیر — برای روش SR_STOPS.
 * ساده‌سازی: بالاترین سقف / پایین‌ترین کف در lookback کندل اخیر (بدون کندل جاری).
 */
function recentSupportResistance(
  series: IndicatorCandle[],
  lookback: number
): { support: number; resistance: number } {
  const n = series.length;
  const start = Math.max(0, n - 1 - lookback);
  const windowCandles = series.slice(start, n - 1);
  let resistance = -Infinity;
  let support = Infinity;
  for (const c of windowCandles) {
    resistance = Math.max(resistance, c.high);
    support = Math.min(support, c.low);
  }
  return { support, resistance };
}

/** محاسبه‌ی SL/TP بر اساس تنظیمات فعال در BotConfig — اولویت: دانچیان > SR ساختاری > درصدی ساده. */
export function computeStopLevels(
  series: IndicatorCandle[],
  direction: Direction,
  entryPrice: number,
  config: BotConfig
): StopLevels {
  const cur = series[series.length - 1];

  if (config.ENABLE_DONCHIAN_SL && cur.donchian_upper != null && cur.donchian_lower != null) {
    const atr = cur.atr ?? 0;
    const buffer = atr * config.DONCHIAN_ATR_MULTIPLIER;
    const sl = direction === "buy" ? cur.donchian_lower - buffer : cur.donchian_upper + buffer;
    const slDist = Math.abs(entryPrice - sl);
    const tp = direction === "buy" ? entryPrice + slDist * 1.5 : entryPrice - slDist * 1.5;
    return { sl, tp, method: "دانچیان" };
  }

  if (config.ENABLE_SR_STOPS) {
    const { support, resistance } = recentSupportResistance(series, config.SR_LOOKBACK_BARS);
    const atr = cur.atr ?? 0;
    const buffer = atr * config.SR_BUFFER_ATR_MULTIPLIER;
    if (Number.isFinite(support) && Number.isFinite(resistance)) {
      const sl = direction === "buy" ? support - buffer : resistance + buffer;
      const slDist = Math.abs(entryPrice - sl);
      const tp = direction === "buy" ? entryPrice + slDist * 1.5 : entryPrice - slDist * 1.5;
      return { sl, tp, method: "ساختاری (حمایت/مقاومت)" };
    }
  }

  // پیش‌فرض: درصدی ساده
  const slPct = config.SL_PERCENT / 100;
  const tpPct = config.TP_PERCENT / 100;
  const sl = direction === "buy" ? entryPrice * (1 - slPct) : entryPrice * (1 + slPct);
  const tp = direction === "buy" ? entryPrice * (1 + tpPct) : entryPrice * (1 - tpPct);
  return { sl, tp, method: "درصدی ساده" };
}

export interface AccountSnapshot {
  balance: number;
  equity: number;
  leverage: number;
  currentOpenRiskPercent: number; // مجموع درصد ریسک باز شده روی کل حساب
}

/**
 * محاسبه‌ی حجم معامله (لات) بر اساس درصد ریسک انتخابی و فاصله‌ی SL.
 * contractSize: اندازه‌ی قرارداد نماد (مثلا ۱۰۰۰۰۰ برای فارکس، ۱۰۰ برای فلزات، ۱ برای کریپتو).
 */
export function computeVolume(
  entryPrice: number,
  sl: number,
  account: AccountSnapshot,
  config: BotConfig,
  contractSize: number
): VolumeResult {
  const riskPercent = config.RISK_PERCENT_PER_TRADE;
  let riskAmount = account.balance * (riskPercent / 100);

  if (config.ENABLE_LEVERAGE_AWARE_PERCENT_STOPS && account.leverage > 0) {
    // با اهرم بالاتر، حجم مجاز کمی محافظه‌کارانه‌تر تعدیل می‌شود تا مارجین کال دیرتر برسد
    const leverageFactor = Math.min(1, 100 / account.leverage);
    riskAmount *= Math.max(0.25, leverageFactor);
  }

  const slDistance = Math.abs(entryPrice - sl);
  if (slDistance <= 0) {
    return { volume: 0, riskAmount, slDistance: 0, reason: "فاصله‌ی SL نامعتبر است" };
  }

  const rawVolume = riskAmount / (slDistance * contractSize);
  // رند به ۰.۰۱ لات (حداقل حجم استاندارد بروکرها)
  const volume = Math.max(0.01, Math.floor(rawVolume * 100) / 100);

  return { volume, riskAmount, slDistance, reason: "محاسبه بر اساس درصد ریسک و فاصله‌ی SL" };
}

/** بررسی سقف ریسک کل پرتفوی — قبل از باز کردن معامله‌ی جدید باید صدا زده شود. */
export function checkPortfolioRiskCap(
  account: AccountSnapshot,
  newTradeRiskPercent: number,
  config: BotConfig
): { allowed: boolean; reason: string } {
  const projected = account.currentOpenRiskPercent + newTradeRiskPercent;
  if (projected > config.MAX_TOTAL_RISK_PERCENT) {
    return {
      allowed: false,
      reason: `سقف ریسک کل پرتفوی رد می‌شود (${projected.toFixed(2)}% > ${config.MAX_TOTAL_RISK_PERCENT}%)`,
    };
  }
  return { allowed: true, reason: "در محدوده‌ی سقف ریسک پرتفوی" };
}

/** بررسی سقف ضرر روزانه — اگر فعال باشد و از سقف گذشته باشد، معامله‌ی جدید مجاز نیست (kill-switch). */
export function checkDailyLossLimit(
  dailyPnlPercent: number,
  config: BotConfig
): { triggered: boolean; reason: string } {
  if (!config.ENABLE_DAILY_LOSS_LIMIT) {
    return { triggered: false, reason: "محدودیت ضرر روزانه غیرفعال است" };
  }
  const triggered = dailyPnlPercent <= -Math.abs(config.DAILY_LOSS_LIMIT_PERCENT);
  return {
    triggered,
    reason: triggered
      ? `ضرر روزانه (${dailyPnlPercent.toFixed(2)}%) به سقف مجاز رسید — kill-switch فعال شد`
      : "ضرر روزانه در محدوده‌ی مجاز است",
  };
}
