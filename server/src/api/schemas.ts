// ============================================================
// اسکیمای اعتبارسنجی ورودی (Zod) — طبق بخش ۶ (BotConfig) و بخش ۷ (قرارداد API)
// ============================================================
import { z } from "zod";

export const botConfigSchema = z.object({
  MT5_LOGIN: z.number(),
  MT5_PASSWORD: z.string(),
  MT5_SERVER: z.string(),
  MT5_PATH: z.string().nullable(),

  SYMBOLS: z.array(z.string()).min(1),
  TIMEFRAME: z.number(),
  STRATEGY_MODE: z.string(),

  REGIME_ADX_MAX: z.number(),
  REGIME_BB_SLOPE_LOOKBACK: z.number(),
  REGIME_BB_SLOPE_MAX_PERCENT: z.number(),
  REGIME_EFFICIENCY_LOOKBACK: z.number(),
  REGIME_EFFICIENCY_MAX: z.number(),
  REGIME_ATR_LOOKBACK: z.number(),
  REGIME_ATR_MIN_PERCENTILE: z.number(),
  REGIME_ATR_MAX_PERCENTILE: z.number(),

  SCALP_BB_PERIOD: z.number(),
  SCALP_BB_STD: z.number(),
  SCALP_RSI_PERIOD: z.number(),
  SCALP_RSI_OVERSOLD: z.number(),
  SCALP_RSI_OVERBOUGHT: z.number(),
  SCALP_REQUIRE_REJECTION: z.boolean(),
  SCALP_REJECTION_WICK_RATIO: z.number(),

  SCALP_STRUCTURE_LOOKBACK: z.number(),
  SCALP_STRUCTURE_BUFFER_ATR: z.number(),
  SCALP_ATR_SL_MULTIPLIER: z.number(),
  SCALP_TP_MODE: z.string(),
  SCALP_TP_ATR_FALLBACK: z.number(),
  SCALP_MIN_RR: z.number(),
  SCALP_MAX_SPREAD_POINTS: z.number(),
  SCALP_SESSION_FILTER_ENABLED: z.boolean(),
  SCALP_SESSION_START_HOUR_UTC: z.number(),
  SCALP_SESSION_END_HOUR_UTC: z.number(),

  RISK_PERCENT_PER_TRADE: z.number(),
  SL_PERCENT: z.number(),
  TP_PERCENT: z.number(),
  ENABLE_LEVERAGE_AWARE_PERCENT_STOPS: z.boolean(),
  ENABLE_SR_STOPS: z.boolean(),
  SR_LOOKBACK_BARS: z.number(),
  SR_BUFFER_ATR_MULTIPLIER: z.number(),
  ENABLE_DONCHIAN_SL: z.boolean(),
  DONCHIAN_PERIOD: z.number(),
  DONCHIAN_ATR_MULTIPLIER: z.number(),
  RISK_TOLERANCE_PROFILE: z.string(),

  ADX_TREND_THRESHOLD: z.number(),
  COOLDOWN_BARS: z.number(),
  MAX_CONCURRENT_TRADES: z.number(),
  MAX_TOTAL_RISK_PERCENT: z.number(),
  ENABLE_DAILY_LOSS_LIMIT: z.boolean(),
  DAILY_LOSS_LIMIT_PERCENT: z.number(),
  ENABLE_HTF_CONFIRMATION: z.boolean(),
  HTF_TIMEFRAME: z.number().nullable(),

  ENABLE_TRAILING_STOP: z.boolean(),
  TRAILING_ACTIVATION_ATR_MULTIPLIER: z.number(),
  TRAILING_DISTANCE_ATR_MULTIPLIER: z.number(),
  ENABLE_MAX_TRADE_DURATION: z.boolean(),
  MAX_TRADE_DURATION_HOURS: z.number(),
  ENABLE_WEEKEND_CLOSE: z.boolean(),
  WEEKEND_CLOSE_HOUR_UTC: z.number(),

  REQUIRE_DEMO_ACCOUNT: z.boolean(),
  PROFILE_NAME: z.string(),
  MAGIC_NUMBER: z.number(),
  INITIAL_BALANCE: z.number().optional(),
});

export const candleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().optional(),
});

// نکته: سند رسمی (بخش ۷) بدنه‌ی analyze را { symbol, timeframeMinutes, candles } تعریف کرده.
// برای این‌که چند-پروفایلی هم‌زمان معنا داشته باشد (هر پروفایل Magic Number/تنظیمات خودش را دارد)
// فیلد profile_name هم اضافه شده — این تنها انحراف کوچک از قرارداد اصلی است و در پاسخ نهایی
// به کاربر توضیح داده می‌شود.
export const analyzeRequestSchema = z.object({
  profile_name: z.string(),
  symbol: z.string(),
  timeframeMinutes: z.number(),
  candles: z.array(candleSchema).min(1),
  htf_candles: z.array(candleSchema).optional(),
});

export const saveProfileSchema = z.object({ config: botConfigSchema });
export const duplicateProfileSchema = z.object({ new_name: z.string().min(1) });
export const startBotSchema = z.object({ profile_name: z.string(), config: botConfigSchema });
export const stopBotSchema = z.object({ profile_name: z.string() });
export const openChartSchema = z.object({ profile_name: z.string(), symbol: z.string() });
export const symbolGroupsSchema = z.record(z.string(), z.array(z.string()));

export const runBacktestSchema = z.object({
  config: botConfigSchema,
  symbols: z.array(z.string()).min(1),
  period_label: z.string(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});
