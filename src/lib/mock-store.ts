// ============================================================
// TrendPilot Web — In-memory mock store for stateful operations
// (backtest jobs, log line append, AI training, profile CRUD, bot start/stop)
// ============================================================
import {
  AI_ENGINE_STATUS,
  DEFAULT_CONFIG,
  LOG_LINES_INITIAL,
  LOG_LINES_STREAM,
  PROFILES,
  makeBacktestResult,
} from "./mock-data";
import type {
  AIEngineStatus,
  BacktestJob,
  BotConfig,
  LogResponse,
  ProfilesResponse,
} from "./types";

// ----------------------------------------------------------------------------
// Latency simulator
// ----------------------------------------------------------------------------

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ----------------------------------------------------------------------------
// Profile store
// ----------------------------------------------------------------------------

class ProfileStore {
  private profiles: Record<string, BotConfig> = { ...PROFILES };

  list(): ProfilesResponse {
    return { profiles: { ...this.profiles } };
  }

  get(name: string): BotConfig | null {
    return this.profiles[name] ? { ...this.profiles[name] } : null;
  }

  save(name: string, config: BotConfig): BotConfig {
    const cfg: BotConfig = { ...config, PROFILE_NAME: name };
    this.profiles[name] = cfg;
    return cfg;
  }

  duplicate(srcName: string, newName: string): BotConfig {
    const src = this.profiles[srcName];
    if (!src) throw new Error(`پروفایل «${srcName}» یافت نشد.`);
    const copy: BotConfig = {
      ...src,
      PROFILE_NAME: newName,
      MAGIC_NUMBER: this.nextMagic(),
    };
    this.profiles[newName] = copy;
    return copy;
  }

  delete(name: string): void {
    delete this.profiles[name];
  }

  nextMagic(): number {
    const magics = Object.values(this.profiles).map((p) => p.MAGIC_NUMBER);
    const max = magics.length ? Math.max(...magics) : 100000;
    return max + 1;
  }
}

export const profileStore = new ProfileStore();

// ----------------------------------------------------------------------------
// Bot running state (mock)
// ----------------------------------------------------------------------------

class BotStore {
  private running: Set<string> = new Set(["TrendFollow-Conservative", "Scalp-Aggressive"]);

  start(name: string): { ok: boolean; already_running: boolean } {
    if (this.running.has(name)) {
      return { ok: true, already_running: true };
    }
    this.running.add(name);
    return { ok: true, already_running: false };
  }

  stop(name: string): void {
    this.running.delete(name);
  }

  isRunning(name: string): boolean {
    return this.running.has(name);
  }
}

export const botStore = new BotStore();

// ----------------------------------------------------------------------------
// Backtest job store
// ----------------------------------------------------------------------------

interface BacktestJobInternal extends BacktestJob {
  pollCount: number;
  startedAt: number;
}

class BacktestStore {
  private jobs: Map<string, BacktestJobInternal> = new Map();
  private counter = 0;

  run(config: BotConfig): string {
    const id = `bt-${Date.now()}-${++this.counter}`;
    this.jobs.set(id, {
      status: "running",
      pollCount: 0,
      startedAt: Date.now(),
      config,
    });
    return id;
  }

  get(id: string): BacktestJob {
    const job = this.jobs.get(id);
    if (!job) {
      return {
        status: "error",
        errors: ["شناسهٔ بکتست نامعتبر است."],
      };
    }

    // Simulate lifecycle: 3 polls = "running", 4th poll = "done"
    job.pollCount++;
    if (job.pollCount < 4) {
      return { status: "running", config: job.config };
    }
    if (job.status !== "done") {
      job.status = "done";
      job.result = makeBacktestResult();
    }
    return {
      status: job.status,
      result: job.result,
      config: job.config,
    };
  }

  exportData(id: string, format: "xlsx" | "csv"): string {
    const job = this.jobs.get(id);
    if (!job || !job.result) {
      throw new Error("نتیجهٔ بکتست برای خروجی در دسترس نیست.");
    }
    return format;
  }
}

export const backtestStore = new BacktestStore();

// ----------------------------------------------------------------------------
// Log store — append new lines as user polls
// ----------------------------------------------------------------------------

const LOG_TEMPLATES: Array<[string, string, string]> = [
  ["INFO", "Bot heartbeat: ${bots} bots running, ${pos} open positions", ""],
  ["DEBUG", "Tick ${sym} bid=${bid} ask=${ask} spread=${sp} points", ""],
  ["INFO", "Trailing stop: ticket=${tk} ${sym} → SL moved to ${sl}", ""],
  ["INFO", "Cooldown active on ${sym} (${done}/${total} bars elapsed)", ""],
  ["WARN", "${sym} spread=${sp} points exceeds SCALP_MAX_SPREAD_POINTS → signal rejected", ""],
  ["DEBUG", "ATR recalc: ${sym} ${tf}m = ${atr}", ""],
  ["INFO", "Equity snapshot: balance=${bal} equity=${eq} margin_used=${mgn} (${risk}%)", ""],
  ["INFO", "Daily P&L = ${pnl} USD (within daily_loss_limit=5%)", ""],
  ["DEBUG", "Regime detect: ${sym}=${rg}, ADX=${adx}", ""],
  ["INFO", "Signal ${side} ${sym} @${px} sl=${sl} tp=${tp} vol=${vol} magic=${mg}", ""],
];

class LogStore {
  private lines: string[] = [...LOG_LINES_INITIAL, ...LOG_LINES_STREAM];
  private cursor = 0;

  since(sinceN: number): LogResponse {
    if (sinceN === 0) {
      const next = this.lines.length;
      return { lines: [...this.lines], next };
    }
    // Generate 1-3 new lines if user is asking for fresh ones
    if (sinceN >= this.lines.length) {
      const add = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < add; i++) {
        this.lines.push(this.makeLine());
      }
    }
    const slice = this.lines.slice(sinceN);
    return { lines: slice, next: this.lines.length };
  }

  private makeLine(): string {
    const [lvl, tmpl] = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)];
    const sym = pick(["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "USDJPY"]);
    const tf = pick([5, 15, 60]);
    const bid =
      sym === "XAUUSD"
        ? (2400 + Math.random() * 80).toFixed(2)
        : sym === "BTCUSD"
        ? (60000 + Math.random() * 2000).toFixed(1)
        : (0.95 + Math.random() * 0.4).toFixed(5);
    const sp = Math.floor(Math.random() * 50) + 1;
    const ask = (
      parseFloat(bid) + sym === "XAUUSD" || sym === "BTCUSD"
        ? sp / 10
        : sp / 10000
    ).toString();
    const ctx: Record<string, string | number> = {
      sym,
      tf,
      bid,
      ask,
      sp,
      bots: 3,
      pos: 5,
      tk: 44000000 + Math.floor(Math.random() * 10),
      sl:
        sym === "XAUUSD"
          ? (2400 + Math.random() * 80).toFixed(1)
          : (0.95 + Math.random() * 0.4).toFixed(5),
      done: Math.floor(Math.random() * 4),
      total: 4,
      adx: (20 + Math.random() * 18).toFixed(1),
      rg: pick(["trend", "range", "volatile"]),
      bal: (10500 + Math.random() * 200).toFixed(2),
      eq: (10500 + Math.random() * 200).toFixed(2),
      mgn: (180 + Math.random() * 30).toFixed(2),
      risk: (1 + Math.random() * 2).toFixed(2),
      pnl: (-150 + Math.random() * 400).toFixed(2),
      side: pick(["BUY", "SELL"]),
      px: bid,
      tp: bid,
      vol: pick([0.1, 0.2, 0.3, 0.5, 1.0]),
      mg: pick([100001, 100002, 100003]),
      atr:
        sym === "XAUUSD"
          ? (1.2 + Math.random() * 3).toFixed(3)
          : (0.0008 + Math.random() * 0.002).toFixed(5),
    };
    const msg = tmpl.replace(/\$\{(\w+)\}/g, (_, k) => String(ctx[k] ?? ""));
    const ts = new Date().toISOString().replace("T", " ").replace(/\..+/, "");
    return `[${ts}] [${lvl}] ${msg}`;
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const logStore = new LogStore();

// ----------------------------------------------------------------------------
// AI engine store
// ----------------------------------------------------------------------------

class AIEngineStore {
  private status: AIEngineStatus = { ...AI_ENGINE_STATUS };
  private trainingJob: {
    symbol: string;
    timeframe: number;
    bars: number;
    pollCount: number;
  } | null = null;

  getStatus(symbol?: string, timeframe?: number): AIEngineStatus {
    if (this.trainingJob) {
      return {
        trained: false,
        is_training: true,
        symbol: this.trainingJob.symbol,
        timeframe: this.trainingJob.timeframe,
        samples: this.trainingJob.bars,
      };
    }
    if (symbol && timeframe) {
      if (this.status.symbol === symbol && this.status.timeframe === timeframe) {
        return { ...this.status };
      }
      // Return untrained for unknown combo
      return {
        trained: false,
        symbol,
        timeframe,
        is_training: false,
      };
    }
    return { ...this.status };
  }

  train(symbol: string, timeframe: number, bars: number): void {
    this.trainingJob = { symbol, timeframe, bars, pollCount: 0 };
  }

  // Called periodically; advances the training lifecycle
  tick(): AIEngineStatus {
    if (this.trainingJob) {
      this.trainingJob.pollCount++;
      if (this.trainingJob.pollCount >= 3) {
        // Done
        this.status = {
          trained: true,
          symbol: this.trainingJob.symbol,
          timeframe: this.trainingJob.timeframe,
          accuracy: 0.55 + Math.random() * 0.15,
          samples: this.trainingJob.bars,
          trained_at: new Date().toISOString(),
          is_training: false,
        };
        this.trainingJob = null;
      }
    }
    return this.getStatus();
  }
}

export const aiEngineStore = new AIEngineStore();
