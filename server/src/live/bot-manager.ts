// ============================================================
// مدیر اجرای زنده — چند-پروفایلی هم‌زمان
// طبق بخش ۴.۷: هر پروفایل مجموعه‌ی نماد و Number Magic مستقل خودش
// را دارد؛ سقف ریسک کل در سطح کل حساب هم رعایت می‌شود.
//
// نکته‌ی طراحی مهم (خارج از قرارداد رسمی سند، اما لازم برای کارکرد):
// طبق بخش ۵، پل سمت MT5 «هیچ محاسبه یا تصمیمی نمی‌گیرد» و فقط کندل
// می‌فرستد و دستور را اجرا می‌کند — یعنی هیچ تأییدیه‌ی fill/P&L واقعی
// از MT5 به سرور برنمی‌گردد. برای این‌که داشبورد/پوزیشن‌ها/گزارش
// معنا داشته باشند، سرور یک "دفتر معاملات کاغذی" (paper ledger) نگه
// می‌دارد: هر بار که موتور تصمیم دستور خرید/فروش صادر کند، به‌عنوان
// معامله‌ی بازشده با قیمت close همان کندل ثبت می‌شود؛ P&L لحظه‌ای هم
// با هر کندل جدید به‌روزرسانی می‌شود. اگر بعداً پل EA تأییدیه‌ی fill/
// قیمت واقعی را هم گزارش کند، این لایه به‌راحتی با آن مقادیر واقعی
// جایگزین می‌شود، بدون تغییر در بقیه‌ی سرور.
// ============================================================
import { decide, type DecisionOutput } from "../engine/decision.js";
import type { Candle } from "../indicators/engine.js";
import type { BotConfig } from "../types.js";
import type { OpenTradeState } from "../risk/position-management.js";
import { profilesRepo } from "../store/profiles-repo.js";

export interface LivePosition extends OpenTradeState {
  volume: number;
  contractSize: number;
  profitCurrency: number;
  marginUsed: number;
}

export interface LogLine {
  seq: number;
  time: number;
  level: "info" | "warn" | "error" | "debug";
  profile: string;
  symbol?: string;
  message: string;
}

interface ProfileRuntime {
  profileName: string;
  config: BotConfig;
  running: boolean;
  balance: number;
  equity: number;
  dailyStartBalance: number;
  dailyResetDay: number; // روز میلادی (UTC) برای تشخیص شروع روز جدید
  positions: Map<number, LivePosition>;
  closedTrades: {
    ticket: number;
    symbol: string;
    type: string;
    volume: number;
    price: number;
    profit: number;
    time: string;
  }[];
  lastTradeBarBySymbol: Map<string, number>;
  barCounter: number;
  nextTicket: number;
  rejectedSignalsTotal: number;
  rejectedBySymbol: Map<string, number>;
  rejectedByCode: Map<string, number>;
  lastRejection: Record<string, unknown>;
  symbolStates: Record<string, unknown>;
  symbolIssues: Record<string, string>;
  configuredSymbols: string[];
  lastAnalyzeAt: number | null;
}

const CONTRACT_SIZE_BY_PREFIX: { test: (s: string) => boolean; size: number }[] = [
  { test: (s) => /^(XAU|XAG)/.test(s), size: 100 },
  { test: (s) => /(BTC|ETH|USD.*USD|^[A-Z]{3}(USD|USDT)$)/.test(s) && /BTC|ETH/.test(s), size: 1 },
  { test: () => true, size: 100000 }, // پیش‌فرض فارکس
];

function contractSizeFor(symbol: string): number {
  const hit = CONTRACT_SIZE_BY_PREFIX.find((r) => r.test(symbol));
  return hit ? hit.size : 100000;
}

class BotManager {
  private runtimes = new Map<string, ProfileRuntime>();
  private logs: LogLine[] = [];
  private logSeq = 0;

  private log(profile: string, level: LogLine["level"], message: string, symbol?: string) {
    this.logSeq += 1;
    const line: LogLine = { seq: this.logSeq, time: Math.floor(Date.now() / 1000), level, profile, symbol, message };
    this.logs.push(line);
    if (this.logs.length > 5000) this.logs.splice(0, this.logs.length - 5000);
  }

  getLogsSince(since: number): { lines: string[]; next: number } {
    const slice = this.logs.filter((l) => l.seq > since);
    const lines = slice.map(
      (l) => `[${new Date(l.time * 1000).toISOString()}] [${l.level.toUpperCase()}] [${l.profile}]${l.symbol ? ` (${l.symbol})` : ""} ${l.message}`
    );
    return { lines, next: this.logSeq };
  }

  private ensureDailyReset(rt: ProfileRuntime) {
    const today = new Date().getUTCDate();
    if (rt.dailyResetDay !== today) {
      rt.dailyResetDay = today;
      rt.dailyStartBalance = rt.balance;
    }
  }

  async start(profileName: string, config: BotConfig): Promise<{ ok: boolean; already_running: boolean }> {
    const existing = this.runtimes.get(profileName);
    if (existing?.running) {
      return { ok: true, already_running: true };
    }
    if (existing) {
      existing.running = true;
      existing.config = config;
      this.log(profileName, "info", "ربات دوباره شروع به کار کرد");
      return { ok: true, already_running: false };
    }
    const balance = config.INITIAL_BALANCE ?? 10000;
    const rt: ProfileRuntime = {
      profileName,
      config,
      running: true,
      balance,
      equity: balance,
      dailyStartBalance: balance,
      dailyResetDay: new Date().getUTCDate(),
      positions: new Map(),
      closedTrades: [],
      lastTradeBarBySymbol: new Map(),
      barCounter: 0,
      nextTicket: 1,
      rejectedSignalsTotal: 0,
      rejectedBySymbol: new Map(),
      rejectedByCode: new Map(),
      lastRejection: {},
      symbolStates: {},
      symbolIssues: {},
      configuredSymbols: config.SYMBOLS,
      lastAnalyzeAt: null,
    };
    this.runtimes.set(profileName, rt);
    this.log(profileName, "info", `ربات شروع شد — نمادها: ${config.SYMBOLS.join(", ")} — Magic: ${config.MAGIC_NUMBER}`);
    return { ok: true, already_running: false };
  }

  async stop(profileName: string): Promise<{ ok: boolean }> {
    const rt = this.runtimes.get(profileName);
    if (!rt) return { ok: false };
    rt.running = false;
    this.log(profileName, "info", "ربات متوقف شد");
    return { ok: true };
  }

  /** پردازش هر بار که پل EA کندل‌های یک نماد را برای یک پروفایل می‌فرستد. */
  async analyze(profileName: string, symbol: string, timeframeMinutes: number, candles: Candle[]) {
    const rt = this.runtimes.get(profileName);
    if (!rt || !rt.running) {
      return { order: "hold" as const, reason: "این پروفایل در حال اجرا نیست" };
    }
    this.ensureDailyReset(rt);
    rt.barCounter += 1;
    rt.lastAnalyzeAt = Math.floor(Date.now() / 1000);

    const contractSize = contractSizeFor(symbol);
    const currentPrice = candles[candles.length - 1].close;

    // ۱) به‌روزرسانی P&L پوزیشن‌های باز همین نماد
    let openRiskPercent = 0;
    for (const pos of rt.positions.values()) {
      if (pos.symbol !== symbol) continue;
      const diff = pos.direction === "buy" ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
      pos.profitCurrency = diff * pos.volume * contractSize;
    }
    for (const pos of rt.positions.values()) {
      const dist = Math.abs(pos.entryPrice - pos.sl);
      openRiskPercent += ((dist * pos.volume * contractSize) / rt.balance) * 100;
    }
    rt.equity = rt.balance + Array.from(rt.positions.values()).reduce((s, p) => s + p.profitCurrency, 0);

    const dailyPnlPercent = ((rt.equity - rt.dailyStartBalance) / rt.dailyStartBalance) * 100;

    const openTradesForSymbol: OpenTradeState[] = Array.from(rt.positions.values()).filter(
      (p) => p.symbol === symbol
    );
    const lastTradeBar = rt.lastTradeBarBySymbol.get(symbol) ?? null;
    const barsSince = lastTradeBar == null ? null : rt.barCounter - lastTradeBar;

    const decision: DecisionOutput = decide({
      config: rt.config,
      candles,
      account: { balance: rt.balance, equity: rt.equity, leverage: 100, currentOpenRiskPercent: openRiskPercent },
      contractSize,
      openTradesForSymbol,
      openTradesCountForProfile: rt.positions.size,
      barsSinceLastTradeForSymbol: barsSince,
      dailyPnlPercent,
      nowUnix: candles[candles.length - 1].time,
    });

    // اعمال اقدامات مدیریت پوزیشن (trailing / بستن اجباری / بستن آخر هفته)
    for (const act of decision.positionManagementActions) {
      const pos = rt.positions.get(act.ticket);
      if (!pos) continue;
      if (act.action === "update_sl" && act.newSl != null) {
        pos.sl = act.newSl;
        pos.trailingActivated = true;
        this.log(profileName, "info", `Trailing Stop به‌روزرسانی شد — تیکت ${pos.ticket} → SL جدید ${act.newSl.toFixed(5)}`, symbol);
      } else if (act.action === "close") {
        this.closePosition(rt, pos, currentPrice, act.reason);
      }
    }

    if (decision.order === "hold") {
      if (decision.rejectionCode) {
        rt.rejectedSignalsTotal += 1;
        rt.rejectedBySymbol.set(symbol, (rt.rejectedBySymbol.get(symbol) ?? 0) + 1);
        rt.rejectedByCode.set(decision.rejectionCode, (rt.rejectedByCode.get(decision.rejectionCode) ?? 0) + 1);
        rt.lastRejection = { symbol, code: decision.rejectionCode, reason: decision.reason, time: Date.now() };
      }
      rt.symbolStates[symbol] = { regime: decision.regime, reason: decision.reason, updated_at: Date.now() };
      return { order: "hold" as const, reason: decision.reason };
    }

    // باز کردن پوزیشن جدید (ثبت در دفتر کاغذی)
    const ticket = rt.nextTicket++;
    const pos: LivePosition = {
      ticket,
      symbol,
      direction: decision.direction as "buy" | "sell",
      entryPrice: currentPrice,
      sl: decision.sl!,
      tp: decision.tp!,
      openTime: candles[candles.length - 1].time,
      trailingActivated: false,
      volume: decision.volume!,
      contractSize,
      profitCurrency: 0,
      marginUsed: (decision.volume! * contractSize * currentPrice) / 100, // فرض اهرم ۱:۱۰۰
    };
    rt.positions.set(ticket, pos);
    rt.lastTradeBarBySymbol.set(symbol, rt.barCounter);
    rt.symbolStates[symbol] = { regime: decision.regime, reason: decision.reason, updated_at: Date.now() };
    this.log(
      profileName,
      "info",
      `سیگنال ${decision.direction === "buy" ? "خرید" : "فروش"} اجرا شد — حجم ${pos.volume} — SL ${pos.sl.toFixed(5)} — TP ${pos.tp.toFixed(5)} — دلیل: ${decision.reason}`,
      symbol
    );

    return {
      order: decision.direction as "buy" | "sell",
      sl: decision.sl,
      tp: decision.tp,
      volume: decision.volume,
      reason: decision.reason,
    };
  }

  private closePosition(rt: ProfileRuntime, pos: LivePosition, price: number, reason: string) {
    const diff = pos.direction === "buy" ? price - pos.entryPrice : pos.entryPrice - price;
    const profit = diff * pos.volume * pos.contractSize;
    rt.balance += profit;
    rt.positions.delete(pos.ticket);
    rt.closedTrades.push({
      ticket: pos.ticket,
      symbol: pos.symbol,
      type: pos.direction === "buy" ? "خرید" : "فروش",
      volume: pos.volume,
      price,
      profit,
      time: new Date().toISOString(),
    });
    this.log(rt.profileName, "info", `پوزیشن بسته شد — تیکت ${pos.ticket} — سود/زیان ${profit.toFixed(2)} — دلیل: ${reason}`, pos.symbol);
  }

  /** بستن دستی یک نماد از داشبورد UI (باز کردن چارت فقط لاگ می‌کند، عملیات معامله‌ای انجام نمی‌دهد). */
  openChartRequested(profileName: string, symbol: string) {
    this.log(profileName, "info", "درخواست باز کردن چارت از UI دریافت شد", symbol);
  }

  getStatus(profileName: string) {
    const rt = this.runtimes.get(profileName);
    if (!rt) return null;
    return {
      connected: rt.running,
      is_running: rt.running,
      profile_name: rt.profileName,
      magic_number: rt.config.MAGIC_NUMBER,
      balance: rt.balance,
      equity: rt.equity,
      currency: "USD",
      account_leverage: 100,
      open_positions: Array.from(rt.positions.values()).map((p) => ({
        ticket: p.ticket,
        symbol: p.symbol,
        type: p.direction === "buy" ? 0 : 1,
        volume: p.volume,
        price_open: p.entryPrice,
        price_current: p.entryPrice + (p.direction === "buy" ? 1 : -1) * (p.profitCurrency / (p.volume * p.contractSize) || 0),
        sl: p.sl,
        tp: p.tp,
        profit: p.profitCurrency,
        magic: rt.config.MAGIC_NUMBER,
        margin: p.marginUsed,
        leverage: 100,
      })),
      rejected_signals_total: rt.rejectedSignalsTotal,
      rejected_signals_by_symbol: Object.fromEntries(rt.rejectedBySymbol),
      rejected_signals_by_code: Object.fromEntries(rt.rejectedByCode),
      last_rejection: rt.lastRejection,
      symbol_states: rt.symbolStates,
      symbol_issues: rt.symbolIssues,
      configured_symbols: rt.configuredSymbols,
      bot_open_trades_count: rt.positions.size,
      open_risk_percent: 0,
      daily_loss_triggered: (rt.equity - rt.dailyStartBalance) / rt.dailyStartBalance <= -Math.abs(rt.config.DAILY_LOSS_LIMIT_PERCENT) / 100,
    };
  }

  getAllStatuses(): Record<string, ReturnType<BotManager["getStatus"]>> {
    const out: Record<string, ReturnType<BotManager["getStatus"]>> = {};
    for (const name of this.runtimes.keys()) out[name] = this.getStatus(name);
    return out;
  }

  getPositionsGrouped() {
    const out: Record<string, Record<string, any[]>> = {};
    for (const [name, rt] of this.runtimes) {
      const bySymbol: Record<string, any[]> = {};
      for (const p of rt.positions.values()) {
        bySymbol[p.symbol] = bySymbol[p.symbol] ?? [];
        bySymbol[p.symbol].push({
          ticket: p.ticket,
          symbol: p.symbol,
          type: p.direction === "buy" ? 0 : 1,
          volume: p.volume,
          price_open: p.entryPrice,
          price_current: p.entryPrice,
          sl: p.sl,
          tp: p.tp,
          profit: p.profitCurrency,
          magic: rt.config.MAGIC_NUMBER,
          margin: p.marginUsed,
          leverage: 100,
        });
      }
      out[name] = bySymbol;
    }
    return out;
  }

  getReport(profileName: string, days: number, startDate?: string, endDate?: string) {
    const rt = this.runtimes.get(profileName);
    if (!rt) return { error: "پروفایل یافت نشد", total_profit: 0, total_trades: 0, win_rate: 0, wins: 0, losses: 0, trades: [] };
    let trades = rt.closedTrades;
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : -Infinity;
      const end = endDate ? new Date(endDate).getTime() : Infinity;
      trades = trades.filter((t) => {
        const t2 = new Date(t.time).getTime();
        return t2 >= start && t2 <= end;
      });
    } else {
      const cutoff = Date.now() - days * 86400 * 1000;
      trades = trades.filter((t) => new Date(t.time).getTime() >= cutoff);
    }
    const wins = trades.filter((t) => t.profit > 0).length;
    const losses = trades.filter((t) => t.profit <= 0).length;
    const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
    return {
      total_profit: totalProfit,
      total_trades: trades.length,
      win_rate: trades.length ? (wins / trades.length) * 100 : 0,
      wins,
      losses,
      trades: trades.map((t, i) => ({ ...t, ticket: t.ticket ?? i })),
      account_login: rt.config.MT5_LOGIN,
      account_server: rt.config.MT5_SERVER,
      balance: rt.balance,
      equity: rt.equity,
      currency: "USD",
    };
  }

  getDashboardStats() {
    let balance = 0;
    let equity = 0;
    let runningBots = 0;
    let openPositions = 0;
    let dailyProfit = 0;
    let anyConnected = false;
    for (const rt of this.runtimes.values()) {
      balance += rt.balance;
      equity += rt.equity;
      if (rt.running) {
        runningBots += 1;
        anyConnected = true;
      }
      openPositions += rt.positions.size;
      dailyProfit += rt.equity - rt.dailyStartBalance;
    }
    return {
      balance,
      equity,
      running_bots: runningBots,
      open_positions: openPositions,
      daily_profit: dailyProfit,
      mt5_connected: anyConnected,
    };
  }
}

export const botManager = new BotManager();

/** بارگذاری پروفایل‌های ذخیره‌شده روی دیسک هنگام بالا آمدن سرور (بدون شروع خودکار اجرا). */
export async function warmupProfilesFromDisk() {
  await profilesRepo.list();
}
