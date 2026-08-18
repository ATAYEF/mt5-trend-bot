import { computeIndicators } from "../indicators/engine.js";
import { generateSyntheticCandles } from "../utils/synthetic-candles.js";

const candles = generateSyntheticCandles(300);
const withInd = computeIndicators(candles);
const last = withInd[withInd.length - 1];

console.log("تعداد کندل:", withInd.length);
console.log("آخرین کندل با اندیکاتور:", JSON.stringify(last, null, 2));

let ok = true;
if (last.ema_fast == null || last.ema_slow == null) { console.error("FAIL: EMA null"); ok = false; }
if (last.rsi == null || last.rsi < 0 || last.rsi > 100) { console.error("FAIL: RSI out of range"); ok = false; }
if (last.atr == null || last.atr < 0) { console.error("FAIL: ATR invalid"); ok = false; }
if (last.adx == null || last.adx < 0 || last.adx > 100) { console.error("FAIL: ADX out of range"); ok = false; }
if (last.donchian_upper == null || last.donchian_lower == null) { console.error("FAIL: Donchian null"); ok = false; }
if (last.bb_upper == null || last.bb_lower == null) { console.error("FAIL: BB null"); ok = false; }
if (last.kaufman_er == null || last.kaufman_er < 0 || last.kaufman_er > 1) { console.error("FAIL: KER out of range"); ok = false; }
if (last.atr_percentile == null || last.atr_percentile < 0 || last.atr_percentile > 100) { console.error("FAIL: ATR pct out of range"); ok = false; }

console.log(ok ? "PASS: indicators.test.ts" : "FAILED: indicators.test.ts");
if (!ok) process.exit(1);
