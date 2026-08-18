import { runBacktest } from "../backtest/engine.js";
import type { BotConfig } from "../types.js";

const config: BotConfig = {
  MT5_LOGIN: 1, MT5_PASSWORD: "x", MT5_SERVER: "Demo", MT5_PATH: null,
  SYMBOLS: ["EURUSD", "XAUUSD"], TIMEFRAME: 15, STRATEGY_MODE: "خودکار (تشخیص رژیم بازار)",
  REGIME_ADX_MAX: 35, REGIME_BB_SLOPE_LOOKBACK: 6, REGIME_BB_SLOPE_MAX_PERCENT: 0.5,
  REGIME_EFFICIENCY_LOOKBACK: 24, REGIME_EFFICIENCY_MAX: 0.9, REGIME_ATR_LOOKBACK: 96,
  REGIME_ATR_MIN_PERCENTILE: 0, REGIME_ATR_MAX_PERCENTILE: 100,
  SCALP_BB_PERIOD: 20, SCALP_BB_STD: 2.1, SCALP_RSI_PERIOD: 7, SCALP_RSI_OVERSOLD: 30,
  SCALP_RSI_OVERBOUGHT: 70, SCALP_REQUIRE_REJECTION: false, SCALP_REJECTION_WICK_RATIO: 0.4,
  SCALP_STRUCTURE_LOOKBACK: 14, SCALP_STRUCTURE_BUFFER_ATR: 0.22, SCALP_ATR_SL_MULTIPLIER: 1.15,
  SCALP_TP_MODE: "atr", SCALP_TP_ATR_FALLBACK: 1.4, SCALP_MIN_RR: 1.0, SCALP_MAX_SPREAD_POINTS: 50,
  SCALP_SESSION_FILTER_ENABLED: false, SCALP_SESSION_START_HOUR_UTC: 0, SCALP_SESSION_END_HOUR_UTC: 23,
  RISK_PERCENT_PER_TRADE: 1.0, SL_PERCENT: 0.5, TP_PERCENT: 1.0,
  ENABLE_LEVERAGE_AWARE_PERCENT_STOPS: false, ENABLE_SR_STOPS: false, SR_LOOKBACK_BARS: 30,
  SR_BUFFER_ATR_MULTIPLIER: 0.15, ENABLE_DONCHIAN_SL: false, DONCHIAN_PERIOD: 20,
  DONCHIAN_ATR_MULTIPLIER: 1.0, RISK_TOLERANCE_PROFILE: "متعادل",
  ADX_TREND_THRESHOLD: 18, COOLDOWN_BARS: 2, MAX_CONCURRENT_TRADES: 3, MAX_TOTAL_RISK_PERCENT: 20,
  ENABLE_DAILY_LOSS_LIMIT: false, DAILY_LOSS_LIMIT_PERCENT: 5, ENABLE_HTF_CONFIRMATION: false,
  HTF_TIMEFRAME: null, ENABLE_TRAILING_STOP: true, TRAILING_ACTIVATION_ATR_MULTIPLIER: 0.8,
  TRAILING_DISTANCE_ATR_MULTIPLIER: 1.2, ENABLE_MAX_TRADE_DURATION: true, MAX_TRADE_DURATION_HOURS: 48,
  ENABLE_WEEKEND_CLOSE: true, WEEKEND_CLOSE_HOUR_UTC: 20, REQUIRE_DEMO_ACCOUNT: true,
  PROFILE_NAME: "bt-test", MAGIC_NUMBER: 2001, INITIAL_BALANCE: 10000,
};

const now = Math.floor(Date.now() / 1000);
const start = now - 30 * 86400;

const result = await runBacktest({ config, symbols: config.SYMBOLS, startUnix: start, endUnix: now });

console.log("تعداد معاملات:", result.trades.length);
console.log("سود کل:", result.total_profit.toFixed(2));
console.log("Win rate:", result.win_rate.toFixed(1) + "%");
console.log("Max DD%:", result.max_dd_pct.toFixed(2));
console.log("per_symbol:", result.per_symbol.map(s => `${s.symbol}: ${s.total_trades} trades`).join(", "));
console.log("نمونه معامله:", JSON.stringify(result.trades[0], null, 2));
console.log("tips:", result.tips);

let ok = true;
if (result.per_symbol.length !== 2) { console.error("FAIL: per_symbol length"); ok = false; }
if (result.trades.some(t => !t.exit_reason_fa)) { console.error("FAIL: missing exit_reason_fa"); ok = false; }
if (result.advanced.equity_curve.length === 0) { console.error("FAIL: empty equity curve"); ok = false; }

console.log(ok ? "PASS: backtest.test.ts" : "FAILED: backtest.test.ts");
if (!ok) process.exit(1);
