// ============================================================
// وضعیت محلی — جایگزین live/bot-manager.ts (که منطق معاملاتی TS
// داشت). این ماژول هیچ تصمیمی نمی‌گیرد — فقط:
//   ۱) آخرین وضعیتی که local_service.py (روی PC خودِ آتا) push
//      کرده را نگه می‌دارد
//   ۲) یک صف دستور (start/stop/run_backtest/...) که local_service.py
//      هر چند ثانیه یک‌بار می‌خواند و اجرا می‌کند
//   ۳) یک بافر حلقه‌ای برای خطوط لاگ (تب Log در داشبورد)
//
// چون PC ممکن است گاهی خاموش/آفلاین باشد، اگر آخرین push بیش از
// OFFLINE_THRESHOLD_MS قدیمی باشد، online=false گزارش می‌شود —
// بدون اینکه خطا پرتاب شود (فقط "قدیمی" است، نه "خراب").
// ============================================================
import { randomUUID } from "node:crypto";

export type CommandType =
  | "start"
  | "stop"
  | "open_chart"
  | "get_report"
  | "run_backtest"
  | "train_ai"
  | "predict_ai"
  | "ai_status";

export interface LocalCommand {
  id: string;
  type: CommandType;
  payload: Record<string, unknown>;
  status: "pending" | "sent" | "done" | "failed";
  createdAt: number;
  doneAt?: number;
  result?: unknown;
  error?: string;
}

export interface ProfileStatusEntry {
  running: boolean;
  snapshot: Record<string, any> | null;
  config?: Record<string, any>;
}

interface LocalStatusPayload {
  ts: string;
  profiles: Record<string, ProfileStatusEntry>;
}

const OFFLINE_THRESHOLD_MS = 30_000;
const MAX_LOG_LINES = 2000;
const MAX_COMMAND_HISTORY = 500;

class LocalState {
  private lastStatus: LocalStatusPayload | null = null;
  private lastStatusAt = 0;
  private commands: LocalCommand[] = [];
  private logs: { seq: number; line: string }[] = [];
  private logSeq = 0;

  // ---------------- وضعیت ----------------
  pushStatus(payload: LocalStatusPayload) {
    this.lastStatus = payload;
    this.lastStatusAt = Date.now();
  }

  isOnline(): boolean {
    return Date.now() - this.lastStatusAt < OFFLINE_THRESHOLD_MS;
  }

  getStatus() {
    return {
      online: this.isOnline(),
      last_seen: this.lastStatus?.ts ?? null,
      profiles: this.lastStatus?.profiles ?? {},
    };
  }

  getProfileEntry(profileName: string): ProfileStatusEntry | null {
    return this.lastStatus?.profiles?.[profileName] ?? null;
  }

  // ---------------- دستورات ----------------
  enqueue(type: CommandType, payload: Record<string, unknown>): LocalCommand {
    const cmd: LocalCommand = {
      id: randomUUID(),
      type,
      payload,
      status: "pending",
      createdAt: Date.now(),
    };
    this.commands.push(cmd);
    this.trimCommandHistory();
    return cmd;
  }

  takePending(): LocalCommand[] {
    const pending = this.commands.filter((c) => c.status === "pending");
    for (const c of pending) c.status = "sent";
    return pending;
  }

  complete(id: string, status: "done" | "failed", result?: unknown, error?: string) {
    const cmd = this.commands.find((c) => c.id === id);
    if (!cmd) return;
    cmd.status = status;
    cmd.doneAt = Date.now();
    cmd.result = result;
    cmd.error = error;
  }

  get(id: string): LocalCommand | undefined {
    return this.commands.find((c) => c.id === id);
  }

  /** پولینگ داخلی سمت سرور تا نتیجه‌ی یک دستور آماده شود (برای endpointهایی مثل /api/report که فرانت پاسخ همزمان می‌خواهد). */
  async waitFor(id: string, timeoutMs: number): Promise<LocalCommand | undefined> {
    const start = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (Date.now() - start < timeoutMs) {
      const cmd = this.get(id);
      if (cmd && (cmd.status === "done" || cmd.status === "failed")) return cmd;
      await new Promise((r) => setTimeout(r, 400));
    }
    return this.get(id);
  }

  private trimCommandHistory() {
    const finished = this.commands.filter((c) => c.status === "done" || c.status === "failed");
    if (finished.length > MAX_COMMAND_HISTORY) {
      const toDrop = finished
        .sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0))
        .slice(0, finished.length - MAX_COMMAND_HISTORY)
        .map((c) => c.id);
      this.commands = this.commands.filter((c) => !toDrop.includes(c.id));
    }
  }

  // ---------------- لاگ ----------------
  pushLogs(lines: string[]) {
    for (const line of lines) {
      this.logSeq += 1;
      this.logs.push({ seq: this.logSeq, line });
    }
    if (this.logs.length > MAX_LOG_LINES) {
      this.logs.splice(0, this.logs.length - MAX_LOG_LINES);
    }
  }

  getLogsSince(since: number) {
    const lines = this.logs.filter((l) => l.seq > since).map((l) => l.line);
    return { lines, next: this.logSeq };
  }
}

export const localState = new LocalState();
