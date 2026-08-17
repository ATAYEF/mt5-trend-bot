// ============================================================
// TrendPilot Web — API client
// Reads NEXT_PUBLIC_API_BASE_URL; falls back to mock mode if empty.
// ============================================================
import {
  AI_ENGINE_STATUS,
  BACKTEST_RESULT,
  DASHBOARD_STATS,
  DEFAULT_CONFIG,
  HEALTH,
  META,
  makeLogResponse,
  makeReport,
} from "./mock-data";
import {
  aiEngineStore,
  backtestStore,
  botStore,
  delay,
  logStore,
  profileStore,
} from "./mock-store";
import type {
  AIEngineStatus,
  BacktestJob,
  BacktestResultPayload,
  BotConfig,
  BotStatus,
  DashboardStats,
  GroupedPositions,
  LogResponse,
  MetaResponse,
  PerformanceReport,
  ProfilesResponse,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const IS_MOCK = !BASE_URL;

// ----------------------------------------------------------------------------
// Internal fetch helper for real mode
// ----------------------------------------------------------------------------

async function realFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export const api = {
  isMock: IS_MOCK,

  // ------------------- /api/meta -------------------
  async getMeta(): Promise<MetaResponse> {
    if (IS_MOCK) {
      await delay(200);
      return META;
    }
    return realFetch<MetaResponse>("/api/meta");
  },

  // ------------------- /api/profiles -------------------
  async getProfiles(): Promise<ProfilesResponse> {
    if (IS_MOCK) {
      await delay(220);
      return profileStore.list();
    }
    return realFetch<ProfilesResponse>("/api/profiles");
  },

  async saveProfile(name: string, config: BotConfig): Promise<{ saved: boolean }> {
    if (IS_MOCK) {
      await delay(200);
      profileStore.save(name, config);
      return { saved: true };
    }
    await realFetch(`/api/profiles/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ config }),
    });
    return { saved: true };
  },

  async duplicateProfile(src: string, newName: string): Promise<{ copied: boolean }> {
    if (IS_MOCK) {
      await delay(220);
      profileStore.duplicate(src, newName);
      return { copied: true };
    }
    await realFetch(`/api/profiles/${encodeURIComponent(src)}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ new_name: newName }),
    });
    return { copied: true };
  },

  async deleteProfile(name: string): Promise<{ deleted: boolean }> {
    if (IS_MOCK) {
      await delay(180);
      profileStore.delete(name);
      return { deleted: true };
    }
    await realFetch(`/api/profiles/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    return { deleted: true };
  },

  // ------------------- /api/symbol-groups -------------------
  async getSymbolGroups(): Promise<Record<string, string[]>> {
    if (IS_MOCK) {
      await delay(150);
      return META.symbol_groups;
    }
    return realFetch<Record<string, string[]>>("/api/symbol-groups");
  },

  async saveSymbolGroups(groups: Record<string, string[]>): Promise<{ saved: boolean }> {
    if (IS_MOCK) {
      await delay(180);
      return { saved: true };
    }
    await realFetch("/api/symbol-groups", {
      method: "PUT",
      body: JSON.stringify(groups),
    });
    return { saved: true };
  },

  // ------------------- /api/bot/* -------------------
  async startBot(profileName: string, config: BotConfig): Promise<{ ok: boolean; already_running: boolean }> {
    if (IS_MOCK) {
      await delay(250);
      return botStore.start(profileName);
    }
    return realFetch<{ ok: boolean; already_running: boolean }>("/api/bot/start", {
      method: "POST",
      body: JSON.stringify({ profile_name: profileName, config }),
    });
  },

  async stopBot(profileName: string): Promise<{ stopped: boolean }> {
    if (IS_MOCK) {
      await delay(200);
      botStore.stop(profileName);
      return { stopped: true };
    }
    await realFetch("/api/bot/stop", {
      method: "POST",
      body: JSON.stringify({ profile_name: profileName }),
    });
    return { stopped: true };
  },

  async getBotStatus(): Promise<{ bots: Record<string, BotStatus> }> {
    if (IS_MOCK) {
      await delay(180);
      // Reflect live bot running/not-running state, not the static snapshot
      return { bots: botStore.statusMap() };
    }
    return realFetch<{ bots: Record<string, BotStatus> }>("/api/bot/status");
  },

  async openChart(profileName: string, symbol: string): Promise<{ ok: boolean }> {
    if (IS_MOCK) {
      await delay(180);
      return { ok: true };
    }
    return realFetch<{ ok: boolean }>("/api/bot/chart/open", {
      method: "POST",
      body: JSON.stringify({ profile_name: profileName, symbol }),
    });
  },

  // ------------------- /api/report -------------------
  async getReport(
    profileName: string,
    days: number,
    startDate?: string,
    endDate?: string
  ): Promise<PerformanceReport> {
    const qs = new URLSearchParams({
      profile_name: profileName,
      days: String(days),
    });
    if (startDate) qs.set("start_date", startDate);
    if (endDate) qs.set("end_date", endDate);
    if (IS_MOCK) {
      await delay(280);
      return makeReport(days);
    }
    return realFetch<PerformanceReport>(`/api/report?${qs.toString()}`);
  },

  // ------------------- /api/backtest/* -------------------
  async runBacktest(params: {
    config: BotConfig;
    symbols: string[];
    period_label?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{ job_id: string }> {
    if (IS_MOCK) {
      await delay(300);
      const id = backtestStore.run(params.config);
      return { job_id: id };
    }
    return realFetch<{ job_id: string }>("/api/backtest/run", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async getBacktestJob(jobId: string): Promise<BacktestJob> {
    if (IS_MOCK) {
      await delay(200);
      return backtestStore.get(jobId);
    }
    return realFetch<BacktestJob>(`/api/backtest/job/${encodeURIComponent(jobId)}`);
  },

  // ------------------- /api/log -------------------
  async getLog(since: number = 0): Promise<LogResponse> {
    if (IS_MOCK) {
      await delay(120);
      return logStore.since(since);
    }
    return realFetch<LogResponse>(`/api/log?since=${since}`);
  },

  // ------------------- /api/health -------------------
  async getHealth(): Promise<typeof HEALTH> {
    if (IS_MOCK) {
      await delay(80);
      return HEALTH;
    }
    return realFetch<typeof HEALTH>("/api/health");
  },

  // ------------------- /api/dashboard/stats -------------------
  async getDashboardStats(): Promise<DashboardStats> {
    if (IS_MOCK) {
      await delay(160);
      // Reflect the number of running bots from the bot store, not the static snapshot
      const statusMap = botStore.statusMap();
      const runningBots = Object.values(statusMap).filter((b) => b.is_running);
      const allOpenPositions = runningBots.flatMap((b) => b.open_positions ?? []);
      const totalProfit = allOpenPositions.reduce((s, p) => s + (p.profit ?? 0), 0);
      const baseBalance = DASHBOARD_STATS.balance;
      const equity = Number((baseBalance + totalProfit + (Math.random() - 0.5) * 5).toFixed(2));
      const dailyPnl = Number((totalProfit + (Math.random() - 0.5) * 8).toFixed(2));
      return {
        ...DASHBOARD_STATS,
        running_bots_count: runningBots.length,
        open_positions_count: allOpenPositions.length,
        equity,
        daily_pnl: dailyPnl,
        // MT5 connected if at least one bot is running
        mt5_connected: runningBots.length > 0,
      };
    }
    return realFetch<DashboardStats>("/api/dashboard/stats");
  },

  // ------------------- /api/positions/grouped -------------------
  async getPositionsGrouped(): Promise<GroupedPositions> {
    if (IS_MOCK) {
      await delay(180);
      // Rebuild the grouped positions map from the live bot status so
      // stopped bots don't show any open positions.
      const statusMap = botStore.statusMap();
      const out: GroupedPositions = {};
      for (const [name, status] of Object.entries(statusMap)) {
        if (!status.is_running) continue;
        const positions = status.open_positions ?? [];
        if (positions.length === 0) continue;
        const bySymbol: Record<string, typeof positions> = {};
        for (const p of positions) {
          if (!bySymbol[p.symbol]) bySymbol[p.symbol] = [];
          bySymbol[p.symbol].push(p);
        }
        out[name] = bySymbol;
      }
      return out;
    }
    return realFetch<GroupedPositions>("/api/positions/grouped");
  },

  // ------------------- /api/ai-engine/* -------------------
  async getAIEngineStatus(symbol?: string, timeframe?: number): Promise<AIEngineStatus> {
    if (IS_MOCK) {
      await delay(160);
      return aiEngineStore.getStatus(symbol, timeframe);
    }
    const qs = new URLSearchParams();
    if (symbol) qs.set("symbol", symbol);
    if (timeframe) qs.set("timeframe", String(timeframe));
    return realFetch<AIEngineStatus>(`/api/ai-engine/status?${qs.toString()}`);
  },

  async trainAIEngine(params: {
    symbol: string;
    timeframe: number;
    bars: number;
  }): Promise<{ started: boolean }> {
    if (IS_MOCK) {
      await delay(250);
      aiEngineStore.train(params.symbol, params.timeframe, params.bars);
      return { started: true };
    }
    await realFetch("/api/ai-engine/train", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return { started: true };
  },

  // Internal tick for AI engine (mock only) — used by polling in tab
  tickAIEngine(): AIEngineStatus {
    return aiEngineStore.tick();
  },

  // ------------------- default config + result accessors -------------------
  getDefaultConfig(): BotConfig {
    return { ...DEFAULT_CONFIG };
  },

  getBacktestResultMock(): BacktestResultPayload {
    return BACKTEST_RESULT;
  },

  getAIEngineStatusMock(): AIEngineStatus {
    return AI_ENGINE_STATUS;
  },
};

// Convenience export for direct import
export type TrendPilotAPI = typeof api;
