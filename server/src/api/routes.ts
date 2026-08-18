// ============================================================
// مسیرهای API — پیاده‌سازی کامل قرارداد بخش ۷ سند
// ============================================================
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  botConfigSchema,
  saveProfileSchema,
  duplicateProfileSchema,
  startBotSchema,
  stopBotSchema,
  openChartSchema,
  symbolGroupsSchema,
  runBacktestSchema,
  analyzeRequestSchema,
} from "./schemas.js";
import { profilesRepo } from "../store/profiles-repo.js";
import { symbolGroupsRepo } from "../store/symbol-groups-repo.js";
import { botManager } from "../live/bot-manager.js";
import { startBacktestJob, getBacktestJob } from "../backtest/job-store.js";
import { backtestTradesToCsv } from "../backtest/csv-export.js";
import { startTraining, getTrainingJob, getAIEngineStatus, getCurrentModel, predictNext } from "../ai/service.js";
import {
  DEFAULT_CONFIG,
  RISK_PROFILES,
  DEFAULT_SYMBOL_GROUPS,
  TIMEFRAMES,
  BACKTEST_PERIODS,
  STRATEGY_MODES,
} from "./meta-constants.js";
import { EXIT_REASON_LABELS } from "../backtest/exit-reasons.js";

function badRequest(reply: any, message: string) {
  return reply.code(400).send({ error: message });
}

export async function registerRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------
  // GET /api/health
  // ---------------------------------------------------------
  app.get("/api/health", async () => ({ status: "ok", time: new Date().toISOString() }));

  // ---------------------------------------------------------
  // GET /api/meta
  // ---------------------------------------------------------
  app.get("/api/meta", async () => {
    const symbolGroups = await symbolGroupsRepo.get();
    return {
      default_config: DEFAULT_CONFIG,
      risk_profiles: RISK_PROFILES,
      symbol_groups: Object.keys(symbolGroups).length ? symbolGroups : DEFAULT_SYMBOL_GROUPS,
      exit_reason_labels: EXIT_REASON_LABELS,
      timeframes: TIMEFRAMES,
      backtest_periods: BACKTEST_PERIODS,
      strategy_modes: STRATEGY_MODES,
    };
  });

  // ---------------------------------------------------------
  // پروفایل‌ها
  // ---------------------------------------------------------
  app.get("/api/profiles", async () => ({ profiles: await profilesRepo.list() }));

  app.put("/api/profiles/:name", async (req, reply) => {
    const { name } = req.params as { name: string };
    const parsed = saveProfileSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    const saved = await profilesRepo.save(name, parsed.data.config);
    return { ok: true, profile: saved };
  });

  app.post("/api/profiles/:name/duplicate", async (req, reply) => {
    const { name } = req.params as { name: string };
    const parsed = duplicateProfileSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    try {
      const copy = await profilesRepo.duplicate(name, parsed.data.new_name);
      return { ok: true, profile: copy };
    } catch (err: any) {
      return badRequest(reply, err.message);
    }
  });

  app.delete("/api/profiles/:name", async (req) => {
    const { name } = req.params as { name: string };
    await profilesRepo.remove(name);
    return { ok: true };
  });

  // ---------------------------------------------------------
  // گروه‌های نماد
  // ---------------------------------------------------------
  app.get("/api/symbol-groups", async () => symbolGroupsRepo.get());

  app.put("/api/symbol-groups", async (req, reply) => {
    const parsed = symbolGroupsSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    return symbolGroupsRepo.save(parsed.data);
  });

  // ---------------------------------------------------------
  // کنترل ربات
  // ---------------------------------------------------------
  app.post("/api/bot/start", async (req, reply) => {
    const parsed = startBotSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    // پروفایل را هم روی دیسک ذخیره کن تا با استارت بعدی سرور هم‌خوان بماند
    await profilesRepo.save(parsed.data.profile_name, parsed.data.config);
    const result = await botManager.start(parsed.data.profile_name, parsed.data.config);
    return result;
  });

  app.post("/api/bot/stop", async (req, reply) => {
    const parsed = stopBotSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    return botManager.stop(parsed.data.profile_name);
  });

  app.get("/api/bot/status", async () => ({ bots: botManager.getAllStatuses() }));

  app.post("/api/bot/chart/open", async (req, reply) => {
    const parsed = openChartSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    botManager.openChartRequested(parsed.data.profile_name, parsed.data.symbol);
    return { ok: true };
  });

  // ---------------------------------------------------------
  // گزارش عملکرد
  // ---------------------------------------------------------
  app.get("/api/report", async (req, reply) => {
    const query = req.query as { profile_name?: string; days?: string; start_date?: string; end_date?: string };
    if (!query.profile_name) return badRequest(reply, "profile_name الزامی است");
    const days = query.days ? Number(query.days) : 30;
    return botManager.getReport(query.profile_name, days, query.start_date, query.end_date);
  });

  // ---------------------------------------------------------
  // بکتست
  // ---------------------------------------------------------
  app.post("/api/backtest/run", async (req, reply) => {
    const parsed = runBacktestSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    const jobId = startBacktestJob(parsed.data);
    return { job_id: jobId };
  });

  app.get("/api/backtest/job/:job_id", async (req, reply) => {
    const { job_id } = req.params as { job_id: string };
    const job = getBacktestJob(job_id);
    if (!job) return reply.code(404).send({ error: "Job یافت نشد" });
    return job;
  });

  app.post("/api/backtest/export/:job_id", async (req, reply) => {
    const { job_id } = req.params as { job_id: string };
    const job = getBacktestJob(job_id);
    if (!job || job.status !== "done" || !job.result) {
      return reply.code(404).send({ error: "نتیجه‌ی بکتست آماده نیست" });
    }
    const csv = backtestTradesToCsv(job.result.trades as unknown as Record<string, unknown>[]);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="backtest-${job_id}.csv"`);
    return csv;
  });

  // ---------------------------------------------------------
  // لاگ
  // ---------------------------------------------------------
  app.get("/api/log", async (req) => {
    const query = req.query as { since?: string };
    const since = query.since ? Number(query.since) : 0;
    return botManager.getLogsSince(since);
  });

  // ---------------------------------------------------------
  // داشبورد
  // ---------------------------------------------------------
  app.get("/api/dashboard/stats", async () => botManager.getDashboardStats());

  // ---------------------------------------------------------
  // پوزیشن‌ها
  // ---------------------------------------------------------
  app.get("/api/positions/grouped", async () => botManager.getPositionsGrouped());

  // ---------------------------------------------------------
  // موتور هوش مصنوعی
  // ---------------------------------------------------------
  app.get("/api/ai-engine/status", async (req) => {
    const query = req.query as { symbol?: string; timeframe?: string };
    return getAIEngineStatus(query.symbol, query.timeframe ? Number(query.timeframe) : undefined);
  });

  app.post("/api/ai-engine/train", async (req, reply) => {
    const schema = z.object({ symbol: z.string(), timeframe: z.number(), bars: z.number() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    const jobKey = startTraining(parsed.data.symbol, parsed.data.timeframe, parsed.data.bars);
    return { job_key: jobKey, status: "running" };
  });

  app.get("/api/ai-engine/train/status", async (req, reply) => {
    const query = req.query as { symbol?: string; timeframe?: string };
    if (!query.symbol || !query.timeframe) return badRequest(reply, "symbol و timeframe الزامی است");
    const job = getTrainingJob(query.symbol, Number(query.timeframe));
    if (!job) return reply.code(404).send({ error: "Job یافت نشد" });
    return job;
  });

  app.post("/api/ai-engine/predict", async (req, reply) => {
    const schema = z.object({ candles: z.array(z.any()).min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    const model = await getCurrentModel();
    if (!model) return reply.code(400).send({ error: "هنوز مدلی آموزش داده نشده" });
    const prediction = predictNext(model, parsed.data.candles as any);
    if (!prediction) return reply.code(400).send({ error: "داده‌ی کافی برای استخراج ویژگی وجود ندارد" });
    return prediction;
  });

  // ---------------------------------------------------------
  // endpoint داخلی پل MT5 — تنها endpointی که پل سمت MT5 صدا می‌زند
  // ---------------------------------------------------------
  app.post("/api/v1/analyze", async (req, reply) => {
    const parsed = analyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    const { profile_name, symbol, timeframeMinutes, candles } = parsed.data;
    try {
      const result = await botManager.analyze(profile_name, symbol, timeframeMinutes, candles);
      return result;
    } catch (err: any) {
      return reply.code(500).send({ error: err?.message ?? "خطای داخلی در تحلیل" });
    }
  });
}
