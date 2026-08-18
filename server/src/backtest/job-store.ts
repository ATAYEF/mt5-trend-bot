// ============================================================
// اجرای بکتست به‌صورت Job غیرهم‌زمان (بخش ۳.۴)
// ============================================================
import { randomUUID } from "node:crypto";
import { runBacktest } from "./engine.js";
import { resolvePeriodLabel } from "./data-provider.js";
import type { BotConfig } from "../types.js";

interface JobRecord {
  status: "running" | "done" | "error";
  result?: Awaited<ReturnType<typeof runBacktest>>;
  errors?: string[];
  config?: BotConfig;
}

const jobs = new Map<string, JobRecord>();

export interface RunBacktestRequest {
  config: BotConfig;
  symbols: string[];
  period_label: string;
  start_date?: string;
  end_date?: string;
}

export function startBacktestJob(req: RunBacktestRequest): string {
  const jobId = randomUUID();
  jobs.set(jobId, { status: "running", config: req.config });

  let startUnix: number;
  let endUnix: number;
  if (req.start_date && req.end_date) {
    startUnix = Math.floor(new Date(req.start_date).getTime() / 1000);
    endUnix = Math.floor(new Date(req.end_date).getTime() / 1000);
  } else {
    const resolved = resolvePeriodLabel(req.period_label);
    startUnix = resolved.start;
    endUnix = resolved.end;
  }

  // اجرای غیرهم‌زمان — کلاینت با پولینگ /api/backtest/job/{id} وضعیت را چک می‌کند
  queueMicrotask(async () => {
    try {
      const result = await runBacktest({ config: req.config, symbols: req.symbols, startUnix, endUnix });
      jobs.set(jobId, { status: "done", result, config: req.config });
    } catch (err: any) {
      jobs.set(jobId, { status: "error", errors: [err?.message ?? "خطای ناشناخته در اجرای بکتست"], config: req.config });
    }
  });

  return jobId;
}

export function getBacktestJob(jobId: string): JobRecord | null {
  return jobs.get(jobId) ?? null;
}
