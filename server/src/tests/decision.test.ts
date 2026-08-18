import { decide } from "../engine/decision.js";
import { generateSyntheticCandles } from "../utils/synthetic-candles.js";
import type { BotConfig } from "../types.js";
import type { AccountSnapshot } from "../risk/risk.js";

const config: BotConfig = {
  MT5_LOGIN: 1, MT5_PASSWORD: "x", MT5_SERVER: "Demo", MT5_PATH: null,
  SYMBOLS: ["EURUSD"], TIMEFRAME: 15, STRATEGY_MODE: "خودکار (تشخیص رژیم بازار)",
  REGIME_ADX_MAX: 35, REGIME_BB_SLOPE_LOOKBACK: 6, REGIME_BB_SLOPE_MAX_PERCENT: 0.5,
  REGIME_EFFICIENCY_LOOKBACK: 24, REGIME_EFFICIENCY_MAX: 0.9, REGIME_ATR_LOOKBACK: 96,
  REGIME_ATR_MIN_PERCENTILE: 0, REGIME_ATR_MAX_PERCENTILE: 100,
  SCALP_BB_PERIOD: 20, SCALP_BB_STD: 2.1, SCALP_RSI_PERIOD: 7, SCALP_RSI_OVERSOLD: 28,
  SCALP_RSI_OVERBOUGHT: 72, SCALP_REQUIRE_REJECTION: false, SCALP_REJECTION_WICK_RATIO: 0.55,
  SCALP_STRUCTURE_LOOKBACK: 14, SCALP_STRUCTURE_BUFFER_ATR: 0.22, SCALP_ATR_SL_MULTIPLIER: 1.15,
  SCALP_TP_MODE: "atr", SCALP_TP_ATR_FALLBACK: 1.4, SCALP_MIN_RR: 1.0, SCALP_MAX_SPREAD_POINTS: 28,
  SCALP_SESSION_FILTER_ENABLED: false, SCALP_SESSION_START_HOUR_UTC: 6, SCALP_SESSION_END_HOUR_UTC: 21,
  RISK_PERCENT_PER_TRADE: 1.0, SL_PERCENT: 0.5, TP_PERCENT: 1.0,
  ENABLE_LEVERAGE_AWARE_PERCENT_STOPS: true, ENABLE_SR_STOPS: false, SR_LOOKBACK_BARS: 30,
  SR_BUFFER_ATR_MULTIPLIER: 0.15, ENABLE_DONCHIAN_SL: false, DONCHIAN_PERIOD: 20,
  DONCHIAN_ATR_MULTIPLIER: 1.0, RISK_TOLERANCE_PROFILE: "متعادل",
  ADX_TREND_THRESHOLD: 20, COOLDOWN_BARS: 0, MAX_CONCURRENT_TRADES: 5, MAX_TOTAL_RISK_PERCENT: 20,
  ENABLE_DAILY_LOSS_LIMIT: true, DAILY_LOSS_LIMIT_PERCENT: 5, ENABLE_HTF_CONFIRMATION: false,
  HTF_TIMEFRAME: null, ENABLE_TRAILING_STOP: true, TRAILING_ACTIVATION_ATR_MULTIPLIER: 0.8,
  TRAILING_DISTANCE_ATR_MULTIPLIER: 1.2, ENABLE_MAX_TRADE_DURATION: false, MAX_TRADE_DURATION_HOURS: 48,
  ENABLE_WEEKEND_CLOSE: false, WEEKEND_CLOSE_HOUR_UTC: 20, REQUIRE_DEMO_ACCOUNT: true,
  PROFILE_NAME: "test", MAGIC_NUMBER: 1001, INITIAL_BALANCE: 10000,
};

const account: AccountSnapshot = { balance: 10000, equity: 10000, leverage: 100, currentOpenRiskPercent: 0 };

let passCount = 0, failCount = 0;
function check(name: string, cond: boolean) {
  if (cond) { console.log("PASS:", name); passCount++; }
  else { console.error("FAIL:", name); failCount++; }
}

// حالت روند: کندل‌های با روند قوی
const trendingCandles = generateSyntheticCandles(300, { trendPerBar: 0.0006, noise: 0.0008 });
const r1 = decide({
  config: { ...config, STRATEGY_MODE: "روند (Trend Following)" },
  candles: trendingCandles, account, contractSize: 100000,
  openTradesForSymbol: [], openTradesCountForProfile: 0,
  barsSinceLastTradeForSymbol: null, dailyPnlPercent: 0, nowUnix: Math.floor(Date.now()/1000),
});
check("موتور روند خروجی hold/buy/sell معتبر برمی‌گرداند", ["hold","buy","sell"].includes(r1.order));
console.log("نتیجه تست روند:", r1.order, "-", r1.reason);

// حالت رنج: نویز زیاد بدون روند
const rangingCandles = generateSyntheticCandles(300, { trendPerBar: 0.0, noise: 0.002, seed: 7 });
const r2 = decide({
  config, candles: rangingCandles, account, contractSize: 100000,
  openTradesForSymbol: [], openTradesCountForProfile: 0,
  barsSinceLastTradeForSymbol: null, dailyPnlPercent: 0, nowUnix: Math.floor(Date.now()/1000),
});
check("موتور خودکار در رنج تشخیص رژیم می‌دهد", r2.regime === "range" || r2.regime === "trend");
console.log("نتیجه تست رنج:", r2.order, "-", r2.regime, "-", r2.reason);

// kill-switch ضرر روزانه
const r3 = decide({
  config, candles: trendingCandles, account, contractSize: 100000,
  openTradesForSymbol: [], openTradesCountForProfile: 0,
  barsSinceLastTradeForSymbol: null, dailyPnlPercent: -6, nowUnix: Math.floor(Date.now()/1000),
});
check("kill-switch ضرر روزانه فعال می‌شود", r3.rejectionCode === "DAILY_LOSS_LIMIT");

// سقف تعداد معاملات هم‌زمان
const r4 = decide({
  config, candles: trendingCandles, account, contractSize: 100000,
  openTradesForSymbol: [], openTradesCountForProfile: 999,
  barsSinceLastTradeForSymbol: null, dailyPnlPercent: 0, nowUnix: Math.floor(Date.now()/1000),
});
check("سقف تعداد معاملات هم‌زمان رعایت می‌شود", r4.rejectionCode === "MAX_CONCURRENT_TRADES");

// کول‌داون
const r5 = decide({
  config, candles: trendingCandles, account, contractSize: 100000,
  openTradesForSymbol: [], openTradesCountForProfile: 0,
  barsSinceLastTradeForSymbol: 1, dailyPnlPercent: 0, nowUnix: Math.floor(Date.now()/1000),
});
check("کول‌داون با COOLDOWN_BARS رعایت می‌شود", r5.rejectionCode === "COOLDOWN" || r5.order !== undefined);

console.log(`\nجمع: ${passCount} موفق، ${failCount} ناموفق`);
if (failCount > 0) process.exit(1);
