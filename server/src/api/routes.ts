// ============================================================
// مسیرهای API — نسخه‌ی ساده‌شده
//
// تفاوت اصلی با نسخه‌ی قبلی: این فایل دیگر هیچ منطق معاملاتی اجرا
// نمی‌کند (analyze/indicators/signals/risk/backtest-engine/ai حذف
// شدند). به‌جایش، هر عملیاتی که نیاز به MT5 واقعی دارد (start/stop،
// گزارش، بک‌تست، آموزش AI) به‌صورت یک "دستور" در صف localState
// گذاشته می‌شود؛ local_service.py (روی PC خودِ آتا) آن را می‌خواند،
// واقعاً اجرا می‌کند، و نتیجه را برمی‌گرداند.
//
// قرارداد بیرونی (URLها) نسبت به نسخه‌ی قبلی طوری حفظ شده که فرانت‌اند
// Next.js فعلی (src/lib/api.ts) بدون تغییر کار کند — فقط پیاده‌سازی
// پشت‌صحنه‌اش عوض شده.
// ============================================================
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  saveProfileSchema,
  duplicateProfileSchema,
  startBotSchema,
  stopBotSchema,
  openChartSchema,
  symbolGroupsSchema,
  runBacktestSchema,
  localStatusPushSchema,
  localLogsPushSchema,
  commandDoneSchema,
} from "./schemas.js";
import { profilesRepo } from "../store/profiles-repo.js";
import { symbolGroupsRepo } from "../store/symbol-groups-repo.js";
import { localState } from "../store/local-state.js";
import { requireLocalAuth } from "./local-auth.js";
import { computeDashboardStats, computeGroupedPositions, computeAllStatuses } from "./derived.js";
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

// دستورات نسبتاً سریع (استارت/گزارش) که فرانت‌اند پاسخ همزمان
// انتظار دارد را تا این مدت داخلی پول می‌کنیم؛ دستورات کند
// (بک‌تست/آموزش AI) با الگوی job جدا (پول از سمت فرانت) کار می‌کنند.
const SYNC_WAIT_TIMEOUT_MS = 12_000;

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
  // پروفایل‌ها — بدون تغییر نسبت به قبل (فقط فایل JSON روی سرور،
  // نیازی به رفتن سراغ PC ندارد چون فقط تنظیمات ذخیره می‌شود)
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
  // گروه‌های نماد — بدون تغییر
  // ---------------------------------------------------------
  app.get("/api/symbol-groups", async () => symbolGroupsRepo.get());

  app.put("/api/symbol-groups", async (req, reply) => {
    const parsed = symbolGroupsSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    return symbolGroupsRepo.save(parsed.data);
  });

  // ---------------------------------------------------------
  // کنترل ربات — دیگر مستقیم اجرا نمی‌شود، فقط صف می‌شود.
  // چون PC ممکن است آفلاین باشد، پاسخ فوری "queued" است؛ وضعیت
  // واقعی running با پولینگ /api/bot/status (که از localState
  // می‌خواند) به‌روز می‌شود.
  // ---------------------------------------------------------
  app.post("/api/bot/start", async (req, reply) => {
    const parsed = startBotSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    await profilesRepo.save(parsed.data.profile_name, parsed.data.config);
    localState.enqueue("start", { profile_name: parsed.data.profile_name });
    return { ok: true, queued: true };
  });

  app.post("/api/bot/stop", async (req, reply) => {
    const parsed = stopBotSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    localState.enqueue("stop", { profile_name: parsed.data.profile_name });
    return { ok: true, queued: true };
  });

  app.get("/api/bot/status", async () => {
    const { profiles } = localState.getStatus();
    return { bots: computeAllStatuses(profiles), online: localState.isOnline() };
  });

  app.post("/api/bot/chart/open", async (req, reply) => {
    const parsed = openChartSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    localState.enqueue("open_chart", { profile_name: parsed.data.profile_name, symbol: parsed.data.symbol });
    return { ok: true };
  });

  // ---------------------------------------------------------
  // گزارش عملکرد — دستور صف می‌شود، سرور تا SYNC_WAIT_TIMEOUT_MS
  // منتظر می‌ماند تا local_service.py جواب بدهد (پاسخ همزمان،
  // مثل قبل، برای این‌که فرانت‌اند نیاز به تغییر نداشته باشد)
  // ---------------------------------------------------------
  app.get("/api/report", async (req, reply) => {
    const query = req.query as { profile_name?: string; days?: string; start_date?: string; end_date?: string };
    if (!query.profile_name) return badRequest(reply, "profile_name الزامی است");
    if (!localState.isOnline()) {
      return reply.code(503).send({ error: "PC محلی در حال حاضر آفلاین است — بعداً دوباره امتحان کنید" });
    }
    const cmd = localState.enqueue("get_report", {
      profile_name: query.profile_name,
      days: query.days ? Number(query.days) : 7,
      start_date: query.start_date ?? null,
      end_date: query.end_date ?? null,
    });
    const done = await localState.waitFor(cmd.id, SYNC_WAIT_TIMEOUT_MS);
    if (!done || done.status !== "done") {
      return reply.code(504).send({ error: done?.error ?? "پاسخ به‌موقع از PC محلی نرسید" });
    }
    return done.result;
  });

  // ---------------------------------------------------------
  // بکتست — الگوی job (مثل قبل) چون ممکن است طول بکشد؛ فرانت‌اند
  // همان /api/backtest/job/:job_id را پول می‌کند (job_id = command id)
  // ---------------------------------------------------------
  app.post("/api/backtest/run", async (req, reply) => {
    const parsed = runBacktestSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    if (!localState.isOnline()) {
      return reply.code(503).send({ error: "PC محلی در حال حاضر آفلاین است — بک‌تست نیاز به اتصال زنده‌ی MT5 دارد" });
    }
    const cmd = localState.enqueue("run_backtest", {
      config: parsed.data.config,
      symbols: parsed.data.symbols,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
    });
    return { job_id: cmd.id };
  });

  app.get("/api/backtest/job/:job_id", async (req, reply) => {
    const { job_id } = req.params as { job_id: string };
    const cmd = localState.get(job_id);
    if (!cmd) return reply.code(404).send({ error: "Job یافت نشد" });
    if (cmd.status === "pending" || cmd.status === "sent") return { status: "running" };
    if (cmd.status === "failed") return { status: "error", errors: [cmd.error ?? "خطای نامشخص"] };
    return { status: "done", result: cmd.result };
  });

  // CSV export حذف شد چون به موتور TS وابسته بود — اگر لازم داری،
  // ساده‌ترین راه: خروجی /api/backtest/job/:id (که آرایه‌ی trades دارد)
  // را در خودِ فرانت‌اند با یک تابع کوچک به CSV تبدیل کن.

  // ---------------------------------------------------------
  // لاگ
  // ---------------------------------------------------------
  app.get("/api/log", async (req) => {
    const query = req.query as { since?: string };
    const since = query.since ? Number(query.since) : 0;
    return localState.getLogsSince(since);
  });

  // ---------------------------------------------------------
  // داشبورد و پوزیشن‌ها — از آخرین وضعیتِ push‌شده مشتق می‌شوند
  // ---------------------------------------------------------
  app.get("/api/dashboard/stats", async () => {
    const { profiles } = localState.getStatus();
    return computeDashboardStats(profiles);
  });

  app.get("/api/positions/grouped", async () => {
    const { profiles } = localState.getStatus();
    return computeGroupedPositions(profiles);
  });

  // ---------------------------------------------------------
  // موتور هوش مصنوعی — همان الگوی report/backtest
  // ---------------------------------------------------------
  app.get("/api/ai-engine/status", async (req, reply) => {
    const query = req.query as { symbol?: string; timeframe?: string };
    if (!query.symbol) return badRequest(reply, "symbol الزامی است");
    if (!localState.isOnline()) {
      return { trained: false, offline: true };
    }
    const cmd = localState.enqueue("ai_status", {
      symbol: query.symbol,
      timeframe_minutes: query.timeframe ? Number(query.timeframe) : 15,
    });
    const done = await localState.waitFor(cmd.id, SYNC_WAIT_TIMEOUT_MS);
    if (!done || done.status !== "done") return reply.code(504).send({ error: "پاسخ به‌موقع از PC محلی نرسید" });
    return done.result;
  });

  app.post("/api/ai-engine/train", async (req, reply) => {
    const schema = z.object({ symbol: z.string(), timeframe: z.number(), bars: z.number() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    if (!localState.isOnline()) {
      return reply.code(503).send({ error: "PC محلی آفلاین است — آموزش نیاز به داده‌ی واقعی MT5 دارد" });
    }
    const cmd = localState.enqueue("train_ai", {
      symbol: parsed.data.symbol,
      timeframe_minutes: parsed.data.timeframe,
      bars: parsed.data.bars,
    });
    return { job_key: cmd.id, status: "running" };
  });

  app.get("/api/ai-engine/train/status", async (req, reply) => {
    const query = req.query as { symbol?: string; timeframe?: string; job_key?: string };
    // ترجیحاً با job_key (که train برگردانده) چک کن؛ برای سازگاری با
    // فرانت قدیمی، اگر job_key نبود و symbol/timeframe بود هم قبول کن
    // (در آن حالت فقط آخرین وضعیت شناخته‌شده را با ai_status می‌گیریم)
    if (query.job_key) {
      const cmd = localState.get(query.job_key);
      if (!cmd) return reply.code(404).send({ error: "Job یافت نشد" });
      if (cmd.status === "pending" || cmd.status === "sent") return { status: "running" };
      if (cmd.status === "failed") return { status: "error", error: cmd.error };
      return { status: "done", result: cmd.result };
    }
    if (!query.symbol || !query.timeframe) return badRequest(reply, "job_key یا symbol+timeframe الزامی است");
    const cmd = localState.enqueue("ai_status", { symbol: query.symbol, timeframe_minutes: Number(query.timeframe) });
    const done = await localState.waitFor(cmd.id, SYNC_WAIT_TIMEOUT_MS);
    if (!done || done.status !== "done") return reply.code(504).send({ error: "پاسخ به‌موقع از PC محلی نرسید" });
    return { status: "done", result: done.result };
  });

  app.post("/api/ai-engine/predict", async (req, reply) => {
    // نکته: برخلاف نسخه‌ی قبلی (که کندل از فرانت می‌گرفت)، این نسخه
    // خودش مستقیماً از MT5 واقعی روی PC آخرین کندل‌ها را می‌خواند —
    // دقیق‌تر و نیازی به ارسال داده از مرورگر نیست.
    const schema = z.object({ symbol: z.string(), timeframe: z.number().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error.message);
    if (!localState.isOnline()) {
      return reply.code(503).send({ error: "PC محلی آفلاین است" });
    }
    const cmd = localState.enqueue("predict_ai", {
      symbol: parsed.data.symbol,
      timeframe_minutes: parsed.data.timeframe ?? 15,
    });
    const done = await localState.waitFor(cmd.id, SYNC_WAIT_TIMEOUT_MS);
    if (!done || done.status !== "done") return reply.code(504).send({ error: done?.error ?? "پاسخ به‌موقع نرسید" });
    return done.result;
  });

  // ===========================================================
  // Endpointهای داخلی — فقط local_service.py این‌ها را صدا می‌زند
  // ===========================================================
  app.register(async (local) => {
    local.addHook("preHandler", requireLocalAuth);

    local.post("/api/local/status", async (req, reply) => {
      const parsed = localStatusPushSchema.safeParse(req.body);
      if (!parsed.success) return badRequest(reply, parsed.error.message);
      localState.pushStatus(parsed.data);
      return { ok: true };
    });

    local.get("/api/local/commands", async () => {
      return localState.takePending();
    });

    local.post("/api/local/commands/:id/done", async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = commandDoneSchema.safeParse(req.body);
      if (!parsed.success) return badRequest(reply, parsed.error.message);
      localState.complete(id, parsed.data.status, parsed.data.result, parsed.data.error ?? undefined);
      return { ok: true };
    });

    local.post("/api/local/logs", async (req, reply) => {
      const parsed = localLogsPushSchema.safeParse(req.body);
      if (!parsed.success) return badRequest(reply, parsed.error.message);
      localState.pushLogs(parsed.data.lines);
      return { ok: true };
    });
  });
}
