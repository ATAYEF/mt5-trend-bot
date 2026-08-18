// ============================================================
// مدیریت پوزیشن باز
// طبق بخش ۴.۶: Trailing Stop (فعال‌سازی و فاصله بر اساس ضریب ATR)،
// بستن اجباری بعد از مدت مشخص، بستن همه‌ی پوزیشن‌ها قبل از تعطیلی
// آخر هفته، و kill-switch وقتی ضرر روزانه از سقف مشخصی بگذرد.
// ============================================================
import type { BotConfig } from "../types.js";

export interface OpenTradeState {
  ticket: number;
  symbol: string;
  direction: "buy" | "sell";
  entryPrice: number;
  sl: number;
  tp: number;
  openTime: number; // unix seconds
  trailingActivated: boolean;
}

export interface PositionManagementAction {
  action: "hold" | "update_sl" | "close";
  newSl?: number;
  reason: string;
}

/**
 * بررسی Trailing Stop برای یک پوزیشن باز. باید هر بار که کندل/تیک جدید می‌رسد صدا زده شود.
 * atr: مقدار فعلی ATR روی تایم‌فریم اجرای معامله.
 */
export function evaluateTrailingStop(
  trade: OpenTradeState,
  currentPrice: number,
  atr: number,
  config: BotConfig
): PositionManagementAction {
  if (!config.ENABLE_TRAILING_STOP || atr <= 0) {
    return { action: "hold", reason: "Trailing Stop غیرفعال است" };
  }

  const activationDistance = atr * config.TRAILING_ACTIVATION_ATR_MULTIPLIER;
  const trailingDistance = atr * config.TRAILING_DISTANCE_ATR_MULTIPLIER;

  const profitDistance =
    trade.direction === "buy" ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice;

  if (!trade.trailingActivated && profitDistance < activationDistance) {
    return { action: "hold", reason: "سود کافی برای فعال‌سازی Trailing Stop وجود ندارد" };
  }

  const candidateSl =
    trade.direction === "buy" ? currentPrice - trailingDistance : currentPrice + trailingDistance;

  const improves =
    trade.direction === "buy" ? candidateSl > trade.sl : candidateSl < trade.sl;

  if (!improves) {
    return { action: "hold", reason: "SL فعلی از سطح ترایلینگ جدید بهتر است" };
  }

  return {
    action: "update_sl",
    newSl: candidateSl,
    reason: `Trailing Stop به‌روزرسانی شد (فاصله ${config.TRAILING_DISTANCE_ATR_MULTIPLIER}×ATR)`,
  };
}

/** بستن اجباری بعد از گذشت حداکثر مدت معامله. */
export function evaluateMaxDuration(
  trade: OpenTradeState,
  nowUnix: number,
  config: BotConfig
): PositionManagementAction {
  if (!config.ENABLE_MAX_TRADE_DURATION) {
    return { action: "hold", reason: "محدودیت حداکثر مدت معامله غیرفعال است" };
  }
  const hoursOpen = (nowUnix - trade.openTime) / 3600;
  if (hoursOpen >= config.MAX_TRADE_DURATION_HOURS) {
    return { action: "close", reason: `معامله بیش از ${config.MAX_TRADE_DURATION_HOURS} ساعت باز بوده — بسته شد` };
  }
  return { action: "hold", reason: "هنوز به حداکثر مدت مجاز نرسیده" };
}

/** بستن همه‌ی پوزیشن‌ها قبل از تعطیلی آخر هفته. */
export function evaluateWeekendClose(
  nowUtc: Date,
  config: BotConfig
): PositionManagementAction {
  if (!config.ENABLE_WEEKEND_CLOSE) {
    return { action: "hold", reason: "بستن آخر هفته غیرفعال است" };
  }
  const day = nowUtc.getUTCDay(); // 5 = جمعه, 6 = شنبه
  const hour = nowUtc.getUTCHours();
  const isFridayPastClose = day === 5 && hour >= config.WEEKEND_CLOSE_HOUR_UTC;
  const isWeekend = day === 6 || day === 0;
  if (isFridayPastClose || isWeekend) {
    return { action: "close", reason: "نزدیک/در تعطیلی آخر هفته — پوزیشن بسته شد" };
  }
  return { action: "hold", reason: "هنوز به ساعت بستن آخر هفته نرسیده" };
}

/** بررسی کول‌داون بین معاملات (بر اساس تعداد کندل از آخرین معامله‌ی همان نماد/پروفایل). */
export function isInCooldown(barsSinceLastTrade: number | null, config: BotConfig): boolean {
  if (barsSinceLastTrade == null) return false;
  return barsSinceLastTrade < config.COOLDOWN_BARS;
}

/** بررسی سقف تعداد معاملات هم‌زمان برای یک پروفایل. */
export function canOpenNewConcurrentTrade(currentOpenCount: number, config: BotConfig): boolean {
  return currentOpenCount < config.MAX_CONCURRENT_TRADES;
}
