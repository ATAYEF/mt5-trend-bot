// ============================================================
// هسته‌ی تصمیم‌گیری مشترک
// نکته‌ی حیاتی سند (بخش ۴.۸): این ماژول باید دقیقاً همان منطقی
// باشد که هم در اجرای زنده (endpoint analyze) و هم در بکتست
// استفاده می‌شود — یک پیاده‌سازی، نه دو پیاده‌سازی که ممکن است
// ناهم‌خوان شوند.
// ============================================================
import { computeIndicators, type Candle, type IndicatorCandle } from "../indicators/engine.js";
import { computeTrendSignal, type Direction } from "../signals/trend.js";
import { computeScalpSignal, computeScalpTakeProfit, computeScalpStopLoss } from "../signals/scalp.js";
import { detectMarketRegime, type MarketRegime } from "../signals/regime.js";
import { computeStopLevels, computeVolume, checkPortfolioRiskCap, checkDailyLossLimit, type AccountSnapshot } from "../risk/risk.js";
import {
  evaluateTrailingStop,
  evaluateMaxDuration,
  evaluateWeekendClose,
  isInCooldown,
  canOpenNewConcurrentTrade,
  type OpenTradeState,
} from "../risk/position-management.js";
import type { BotConfig } from "../types.js";

export type TradeOrder = "buy" | "sell" | "close" | "hold";

export interface DecisionInput {
  config: BotConfig;
  candles: Candle[]; // کندل‌های تایم‌فریم اصلی (آخرین کندل = جاری)
  htfCandles?: Candle[]; // کندل‌های تایم‌فریم بالاتر، در صورت فعال بودن HTF
  account: AccountSnapshot;
  contractSize: number;
  currentSpreadPoints?: number;
  openTradesForSymbol: OpenTradeState[]; // پوزیشن‌های باز فعلی همین نماد/پروفایل
  openTradesCountForProfile: number; // تعداد کل پوزیشن‌های باز پروفایل (برای MAX_CONCURRENT_TRADES)
  barsSinceLastTradeForSymbol: number | null;
  dailyPnlPercent: number;
  nowUnix: number;
}

export interface DecisionOutput {
  order: TradeOrder;
  direction: Direction;
  regime: MarketRegime | null;
  reason: string;
  sl?: number;
  tp?: number;
  volume?: number;
  indicatorSnapshot: IndicatorCandle;
  positionManagementActions: { ticket: number; action: string; newSl?: number; reason: string }[];
  rejectionCode?: string;
}

/**
 * تصمیم نهایی را برای یک نماد/پروفایل در یک لحظه محاسبه می‌کند.
 * این تابع هم توسط endpoint زنده‌ی /api/v1/analyze و هم توسط موتور بکتست فراخوانی می‌شود.
 */
export function decide(input: DecisionInput): DecisionOutput {
  const {
    config,
    candles,
    htfCandles,
    account,
    contractSize,
    currentSpreadPoints = 0,
    openTradesForSymbol,
    openTradesCountForProfile,
    barsSinceLastTradeForSymbol,
    dailyPnlPercent,
    nowUnix,
  } = input;

  const series = computeIndicators(candles);
  const cur = series[series.length - 1];
  const htfSeries = htfCandles ? computeIndicators(htfCandles) : undefined;

  // ۱) مدیریت پوزیشن‌های باز موجود (اولویت بالاتر از سیگنال ورود جدید)
  const pmActions: DecisionOutput["positionManagementActions"] = [];
  for (const trade of openTradesForSymbol) {
    const weekend = evaluateWeekendClose(new Date(nowUnix * 1000), config);
    if (weekend.action === "close") {
      pmActions.push({ ticket: trade.ticket, action: "close", reason: weekend.reason });
      continue;
    }
    const maxDur = evaluateMaxDuration(trade, nowUnix, config);
    if (maxDur.action === "close") {
      pmActions.push({ ticket: trade.ticket, action: "close", reason: maxDur.reason });
      continue;
    }
    if (cur.atr != null) {
      const trailing = evaluateTrailingStop(trade, cur.close, cur.atr, config);
      if (trailing.action === "update_sl") {
        pmActions.push({ ticket: trade.ticket, action: "update_sl", newSl: trailing.newSl, reason: trailing.reason });
      }
    }
  }

  // ۲) kill-switch ضرر روزانه — اگر فعال شده باشد، هیچ ورود جدیدی مجاز نیست
  const dailyLoss = checkDailyLossLimit(dailyPnlPercent, config);
  if (dailyLoss.triggered) {
    return {
      order: "hold",
      direction: "none",
      regime: null,
      reason: dailyLoss.reason,
      indicatorSnapshot: cur,
      positionManagementActions: pmActions,
      rejectionCode: "DAILY_LOSS_LIMIT",
    };
  }

  // ۳) کول‌داون
  if (isInCooldown(barsSinceLastTradeForSymbol, config)) {
    return {
      order: "hold",
      direction: "none",
      regime: null,
      reason: "در بازه‌ی کول‌داون بعد از آخرین معامله",
      indicatorSnapshot: cur,
      positionManagementActions: pmActions,
      rejectionCode: "COOLDOWN",
    };
  }

  // ۴) سقف تعداد معاملات هم‌زمان پروفایل
  if (!canOpenNewConcurrentTrade(openTradesCountForProfile, config)) {
    return {
      order: "hold",
      direction: "none",
      regime: null,
      reason: "سقف تعداد معاملات هم‌زمان پروفایل پر است",
      indicatorSnapshot: cur,
      positionManagementActions: pmActions,
      rejectionCode: "MAX_CONCURRENT_TRADES",
    };
  }

  // ۵) تشخیص رژیم بازار + انتخاب موتور سیگنال بر اساس STRATEGY_MODE
  let regime: MarketRegime | null = null;
  let direction: Direction = "none";
  let reason = "";
  let usedEngine: "trend" | "scalp" = "trend";

  if (config.STRATEGY_MODE.includes("خودکار")) {
    const regimeResult = detectMarketRegime(series, config);
    regime = regimeResult.regime;
    if (regime === "range") {
      const scalp = computeScalpSignal(series, config, currentSpreadPoints);
      direction = scalp.direction;
      reason = scalp.reason;
      usedEngine = "scalp";
    } else {
      const trend = computeTrendSignal(series, config, htfSeries);
      direction = trend.direction;
      reason = trend.reason;
      usedEngine = "trend";
    }
  } else if (config.STRATEGY_MODE.includes("اسکلپ")) {
    const scalp = computeScalpSignal(series, config, currentSpreadPoints);
    direction = scalp.direction;
    reason = scalp.reason;
    usedEngine = "scalp";
  } else {
    const trend = computeTrendSignal(series, config, htfSeries);
    direction = trend.direction;
    reason = trend.reason;
    usedEngine = "trend";
  }

  if (direction === "none") {
    return {
      order: "hold",
      direction: "none",
      regime,
      reason: reason || "سیگنالی صادر نشد",
      indicatorSnapshot: cur,
      positionManagementActions: pmActions,
      rejectionCode: "NO_SIGNAL",
    };
  }

  // ۶) محاسبه‌ی SL/TP
  const entryPrice = cur.close;
  let stopLevels = computeStopLevels(series, direction, entryPrice, config);
  if (usedEngine === "scalp") {
    // موتور اسکلپ SL/TP اختصاصی خودش را دارد (بر اساس ATR)، نه سطوح روند/درصدی
    const scalpSl = computeScalpStopLoss(cur, direction, config);
    const scalpTp = computeScalpTakeProfit(cur, direction, config);
    if (scalpSl != null) stopLevels = { ...stopLevels, sl: scalpSl, method: `اسکلپ (${config.SCALP_ATR_SL_MULTIPLIER}×ATR)` };
    if (scalpTp != null) stopLevels = { ...stopLevels, tp: scalpTp };
    // حداقل نسبت ریسک به ریوارد اسکلپ
    const slDist = Math.abs(entryPrice - stopLevels.sl);
    const tpDist = Math.abs(stopLevels.tp - entryPrice);
    if (slDist > 0 && tpDist / slDist < config.SCALP_MIN_RR) {
      return {
        order: "hold",
        direction: "none",
        regime,
        reason: `نسبت ریسک/ریوارد (${(tpDist / slDist).toFixed(2)}) کمتر از حداقل مجاز اسکلپ است`,
        indicatorSnapshot: cur,
        positionManagementActions: pmActions,
        rejectionCode: "MIN_RR",
      };
    }
  }

  // ۷) محاسبه‌ی حجم بر اساس ریسک
  const volumeResult = computeVolume(entryPrice, stopLevels.sl, account, config, contractSize);
  if (volumeResult.volume <= 0) {
    return {
      order: "hold",
      direction: "none",
      regime,
      reason: volumeResult.reason,
      indicatorSnapshot: cur,
      positionManagementActions: pmActions,
      rejectionCode: "INVALID_VOLUME",
    };
  }

  // ۸) بررسی سقف ریسک کل پرتفوی (سطح کل حساب، نه فقط این پروفایل)
  const tradeRiskPercent = (volumeResult.riskAmount / account.balance) * 100;
  const portfolioCheck = checkPortfolioRiskCap(account, tradeRiskPercent, config);
  if (!portfolioCheck.allowed) {
    return {
      order: "hold",
      direction: "none",
      regime,
      reason: portfolioCheck.reason,
      indicatorSnapshot: cur,
      positionManagementActions: pmActions,
      rejectionCode: "PORTFOLIO_RISK_CAP",
    };
  }

  return {
    order: direction,
    direction,
    regime,
    reason,
    sl: stopLevels.sl,
    tp: stopLevels.tp,
    volume: volumeResult.volume,
    indicatorSnapshot: cur,
    positionManagementActions: pmActions,
  };
}
