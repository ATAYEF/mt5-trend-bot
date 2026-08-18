import { historicalDataProvider } from "../backtest/data-provider.js";
import { extractFeatures } from "../ai/features.js";
import { trainLogisticRegression, predictWithModel } from "../ai/model.js";

const now = Math.floor(Date.now() / 1000);
const start = now - 3000 * 15 * 60;
const candles = await historicalDataProvider.getCandles("EURUSD", 15, start, now);
const rows = extractFeatures(candles);
console.log("تعداد نمونه‌ها:", rows.length);

const model = trainLogisticRegression(rows, "EURUSD", 15);
console.log("دقت مدل روی holdout:", model.accuracy.toFixed(2) + "%");
console.log("وزن‌ها:", model.weights);

const pred = predictWithModel(model, rows[rows.length - 1].features);
console.log("پیش‌بینی نمونه:", pred);

let ok = true;
if (rows.length < 100) { console.error("FAIL: too few feature rows"); ok = false; }
if (model.accuracy < 0 || model.accuracy > 100) { console.error("FAIL: accuracy out of range"); ok = false; }
if (!["up","down"].includes(pred.direction)) { console.error("FAIL: invalid prediction direction"); ok = false; }
console.log(ok ? "PASS: ai.test.ts" : "FAILED: ai.test.ts");
if (!ok) process.exit(1);
