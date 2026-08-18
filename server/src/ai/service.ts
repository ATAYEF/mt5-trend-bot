// ============================================================
// موتور هوش مصنوعی کمکی — سرویس اصلی
// طبق بخش ۴.۹: ذخیره/بارگذاری مدل + endpoint پیش‌بینی لحظه‌ای
// ============================================================
import { jsonStore } from "../store/json-store.js";
import { historicalDataProvider } from "../backtest/data-provider.js";
import { extractFeatures, extractLatestFeatureVector } from "./features.js";
import { trainLogisticRegression, predictWithModel, type LogisticModel } from "./model.js";

const MODEL_FILE = "ai-model.json";

interface TrainingJob {
  status: "running" | "done" | "error";
  model?: LogisticModel;
  error?: string;
}

const trainingJobs = new Map<string, TrainingJob>();

export async function getCurrentModel(): Promise<LogisticModel | null> {
  return jsonStore.readJsonFile<LogisticModel | null>(MODEL_FILE, null);
}

export async function getAIEngineStatus(symbol?: string, timeframe?: number) {
  const model = await getCurrentModel();
  if (!model) {
    return { trained: false, symbol: symbol ?? null, timeframe: timeframe ?? null, samples: 0, accuracy: 0, trained_at: null };
  }
  return {
    trained: true,
    symbol: model.symbol,
    timeframe: model.timeframe,
    samples: model.samples,
    accuracy: model.accuracy,
    trained_at: new Date(model.trainedAt).toISOString(),
  };
}

function jobKey(symbol: string, timeframe: number) {
  return `${symbol}:${timeframe}`;
}

/** شروع آموزش مدل به‌صورت غیرهم‌زمان (مثل بکتست — UI با پولینگ وضعیت را چک می‌کند). */
export function startTraining(symbol: string, timeframe: number, bars: number): string {
  const key = jobKey(symbol, timeframe);
  trainingJobs.set(key, { status: "running" });

  queueMicrotask(async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const start = now - bars * timeframe * 60;
      const candles = await historicalDataProvider.getCandles(symbol, timeframe, start, now);
      const rows = extractFeatures(candles);
      const model = trainLogisticRegression(rows, symbol, timeframe);
      await jsonStore.writeJsonFile(MODEL_FILE, model);
      trainingJobs.set(key, { status: "done", model });
    } catch (err: any) {
      trainingJobs.set(key, { status: "error", error: err?.message ?? "خطای ناشناخته در آموزش مدل" });
    }
  });

  return key;
}

export function getTrainingJob(symbol: string, timeframe: number): TrainingJob | null {
  return trainingJobs.get(jobKey(symbol, timeframe)) ?? null;
}

/** پیش‌بینی لحظه‌ای جهت حرکت بعدی بر اساس آخرین کندل‌های داده‌شده. */
export function predictNext(model: LogisticModel, recentCandles: Parameters<typeof extractLatestFeatureVector>[0]) {
  const vec = extractLatestFeatureVector(recentCandles);
  if (!vec) return null;
  return predictWithModel(model, vec);
}
