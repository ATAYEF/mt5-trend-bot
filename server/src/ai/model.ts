// ============================================================
// موتور هوش مصنوعی کمکی — مدل طبقه‌بندی
// طبق بخش ۴.۹: «آموزش یک مدل ساده‌ی طبقه‌بندی (مثل رگرسیون
// لجستیک یا یک شبکه‌ی کوچک) برای پیش‌بینی جهت حرکت بعدی»
//
// پیاده‌سازی: رگرسیون لجستیک با گرادیان کاهشی دستی (بدون نیاز به
// کتابخانه‌ی ML خارجی — سبک و قابل حمل روی هر هاست لینوکسی، طبق
// اصل طراحی سند که «سرور بتواند روی هر هاستی میزبانی شود»).
// ============================================================
import { FEATURE_NAMES, type FeatureRow } from "./features.js";

export interface LogisticModel {
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStds: number[];
  trainedAt: number;
  symbol: string;
  timeframe: number;
  samples: number;
  accuracy: number; // روی مجموعه‌ی نگه‌داشته‌شده (holdout)
}

function standardize(rows: FeatureRow[]): { means: number[]; stds: number[] } {
  const n = rows.length;
  const dim = FEATURE_NAMES.length;
  const means = new Array(dim).fill(0);
  for (const r of rows) for (let j = 0; j < dim; j++) means[j] += r.features[j] / n;
  const stds = new Array(dim).fill(0);
  for (const r of rows) for (let j = 0; j < dim; j++) stds[j] += (r.features[j] - means[j]) ** 2 / n;
  for (let j = 0; j < dim; j++) stds[j] = Math.sqrt(stds[j]) || 1;
  return { means, stds };
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

export function trainLogisticRegression(
  rows: FeatureRow[],
  symbol: string,
  timeframe: number,
  opts: { epochs?: number; learningRate?: number; holdoutRatio?: number } = {}
): LogisticModel {
  const { epochs = 300, learningRate = 0.1, holdoutRatio = 0.2 } = opts;
  if (rows.length < 30) {
    throw new Error("داده‌ی کافی برای آموزش مدل وجود ندارد (حداقل ۳۰ نمونه لازم است)");
  }

  const shuffled = [...rows];
  // shuffle قطعی (deterministic) بر اساس شاخص، برای تکرارپذیری نتایج
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (i * 2654435761) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const holdoutCount = Math.max(5, Math.floor(shuffled.length * holdoutRatio));
  const testSet = shuffled.slice(0, holdoutCount);
  const trainSet = shuffled.slice(holdoutCount);

  const { means, stds } = standardize(trainSet);
  const dim = FEATURE_NAMES.length;
  const weights = new Array(dim).fill(0);
  let bias = 0;

  const normalize = (features: number[]) => features.map((f, j) => (f - means[j]) / stds[j]);

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(dim).fill(0);
    let gradB = 0;
    for (const row of trainSet) {
      const x = normalize(row.features);
      const z = x.reduce((s, xi, j) => s + xi * weights[j], bias);
      const pred = sigmoid(z);
      const err = pred - row.label;
      for (let j = 0; j < dim; j++) gradW[j] += err * x[j];
      gradB += err;
    }
    const m = trainSet.length;
    for (let j = 0; j < dim; j++) weights[j] -= (learningRate * gradW[j]) / m;
    bias -= (learningRate * gradB) / m;
  }

  let correct = 0;
  for (const row of testSet) {
    const x = normalize(row.features);
    const z = x.reduce((s, xi, j) => s + xi * weights[j], bias);
    const pred = sigmoid(z) >= 0.5 ? 1 : 0;
    if (pred === row.label) correct++;
  }
  const accuracy = testSet.length ? (correct / testSet.length) * 100 : 0;

  return {
    weights,
    bias,
    featureMeans: means,
    featureStds: stds,
    trainedAt: Date.now(),
    symbol,
    timeframe,
    samples: rows.length,
    accuracy,
  };
}

export function predictWithModel(model: LogisticModel, featureVector: number[]): { direction: "up" | "down"; confidence: number } {
  const x = featureVector.map((f, j) => (f - model.featureMeans[j]) / model.featureStds[j]);
  const z = x.reduce((s, xi, j) => s + xi * model.weights[j], model.bias);
  const prob = sigmoid(z);
  return { direction: prob >= 0.5 ? "up" : "down", confidence: Math.max(prob, 1 - prob) * 100 };
}
