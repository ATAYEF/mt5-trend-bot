// ============================================================
// TrendPilot Web — Mock data (used when NEXT_PUBLIC_API_BASE_URL is empty)
// ============================================================
import type {
  AIEngineStatus,
  BacktestJob,
  BacktestResultPayload,
  BacktestTrade,
  BotConfig,
  BotStatus,
  DashboardStats,
  GroupedPositions,
  LogResponse,
  MetaResponse,
  PerformanceReport,
  Position,
  ProfilesResponse,
} from "./types";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ----------------------------------------------------------------------------
// Default config (matches PDF section 6 sensible defaults)
// ----------------------------------------------------------------------------

export const DEFAULT_CONFIG: BotConfig = {
  MT5_LOGIN: 5003330711,
  MT5_PASSWORD: "********",
  MT5_SERVER: "MetaQuotes-Demo",
  MT5_PATH: null,

  SYMBOLS: ["EURUSD", "GBPUSD", "XAUUSD"],
  TIMEFRAME: 15,
  STRATEGY_MODE: "خودکار (تشخیص رژیم بازار)",

  REGIME_ADX_MAX: 35,
  REGIME_BB_SLOPE_LOOKBACK: 6,
  REGIME_BB_SLOPE_MAX_PERCENT: 0.18,
  REGIME_EFFICIENCY_LOOKBACK: 24,
  REGIME_EFFICIENCY_MAX: 0.45,
  REGIME_ATR_LOOKBACK: 96,
  REGIME_ATR_MIN_PERCENTILE: 25,
  REGIME_ATR_MAX_PERCENTILE: 92,

  SCALP_BB_PERIOD: 20,
  SCALP_BB_STD: 2.1,
  SCALP_RSI_PERIOD: 7,
  SCALP_RSI_OVERSOLD: 28,
  SCALP_RSI_OVERBOUGHT: 72,
  SCALP_REQUIRE_REJECTION: true,
  SCALP_REJECTION_WICK_RATIO: 0.55,

  SCALP_STRUCTURE_LOOKBACK: 14,
  SCALP_STRUCTURE_BUFFER_ATR: 0.22,
  SCALP_ATR_SL_MULTIPLIER: 1.15,
  SCALP_TP_MODE: "atr",
  SCALP_TP_ATR_FALLBACK: 1.4,
  SCALP_MIN_RR: 1.4,
  SCALP_MAX_SPREAD_POINTS: 28,
  SCALP_SESSION_FILTER_ENABLED: true,
  SCALP_SESSION_START_HOUR_UTC: 6,
  SCALP_SESSION_END_HOUR_UTC: 21,

  RISK_PERCENT_PER_TRADE: 1.0,
  SL_PERCENT: 0.5,
  TP_PERCENT: 1.0,
  ENABLE_LEVERAGE_AWARE_PERCENT_STOPS: true,
  ENABLE_SR_STOPS: true,
  SR_LOOKBACK_BARS: 30,
  SR_BUFFER_ATR_MULTIPLIER: 0.15,
  ENABLE_DONCHIAN_SL: true,
  DONCHIAN_PERIOD: 20,
  DONCHIAN_ATR_MULTIPLIER: 1.0,
  RISK_TOLERANCE_PROFILE: "متعادل",

  ADX_TREND_THRESHOLD: 25,
  COOLDOWN_BARS: 4,
  MAX_CONCURRENT_TRADES: 3,
  MAX_TOTAL_RISK_PERCENT: 6.0,
  ENABLE_DAILY_LOSS_LIMIT: true,
  DAILY_LOSS_LIMIT_PERCENT: 5.0,
  ENABLE_HTF_CONFIRMATION: true,
  HTF_TIMEFRAME: 60,

  ENABLE_TRAILING_STOP: true,
  TRAILING_ACTIVATION_ATR_MULTIPLIER: 0.8,
  TRAILING_DISTANCE_ATR_MULTIPLIER: 0.6,
  ENABLE_MAX_TRADE_DURATION: true,
  MAX_TRADE_DURATION_HOURS: 12,
  ENABLE_WEEKEND_CLOSE: true,
  WEEKEND_CLOSE_HOUR_UTC: 21,

  REQUIRE_DEMO_ACCOUNT: true,
  PROFILE_NAME: "Default",
  MAGIC_NUMBER: 20240817,
  INITIAL_BALANCE: 10000,
};

// ----------------------------------------------------------------------------
// Risk profiles (PDF section 4.6)
// ----------------------------------------------------------------------------

export const RISK_PROFILES: Record<string, import("./types").RiskPreset> = {
  "محافظه‌کار": {
    RISK_PERCENT_PER_TRADE: 0.5,
    DONCHIAN_PERIOD: 25,
    DONCHIAN_ATR_MULTIPLIER: 1.2,
    ADX_TREND_THRESHOLD: 28,
    COOLDOWN_BARS: 6,
    MAX_CONCURRENT_TRADES: 2,
    MAX_TOTAL_RISK_PERCENT: 3.0,
    ENABLE_TRAILING_STOP: true,
    TRAILING_ACTIVATION_ATR_MULTIPLIER: 1.0,
    TRAILING_DISTANCE_ATR_MULTIPLIER: 0.8,
  },
  "متعادل": {
    RISK_PERCENT_PER_TRADE: 1.0,
    DONCHIAN_PERIOD: 20,
    DONCHIAN_ATR_MULTIPLIER: 1.0,
    ADX_TREND_THRESHOLD: 25,
    COOLDOWN_BARS: 4,
    MAX_CONCURRENT_TRADES: 3,
    MAX_TOTAL_RISK_PERCENT: 6.0,
    ENABLE_TRAILING_STOP: true,
    TRAILING_ACTIVATION_ATR_MULTIPLIER: 0.8,
    TRAILING_DISTANCE_ATR_MULTIPLIER: 0.6,
  },
  "تهاجمی": {
    RISK_PERCENT_PER_TRADE: 2.0,
    DONCHIAN_PERIOD: 14,
    DONCHIAN_ATR_MULTIPLIER: 0.85,
    ADX_TREND_THRESHOLD: 22,
    COOLDOWN_BARS: 2,
    MAX_CONCURRENT_TRADES: 5,
    MAX_TOTAL_RISK_PERCENT: 12.0,
    ENABLE_TRAILING_STOP: true,
    TRAILING_ACTIVATION_ATR_MULTIPLIER: 0.6,
    TRAILING_DISTANCE_ATR_MULTIPLIER: 0.45,
  },
};

// ----------------------------------------------------------------------------
// Symbol groups (PDF section 4.2)
// ----------------------------------------------------------------------------

export const SYMBOL_GROUPS: Record<string, string[]> = {
  "جفت ارزهای اصلی": ["EURUSD", "GBPUSD", "USDJPY", "USDCHF"],
  "جفت ارزهای فرعی": ["AUDUSD", "NZDUSD", "USDCAD", "AUDJPY"],
  "فلزات": ["XAUUSD", "XAGUSD"],
  "ارزهای دیجیتال": ["BTCUSD", "ETHUSD"],
};

// ----------------------------------------------------------------------------
// Exit reason labels (Persian)
// ----------------------------------------------------------------------------

export const EXIT_REASON_LABELS: Record<string, string> = {
  tp_hit: "حد سود",
  sl_hit: "حد ضرر",
  trailing: "تریلینگ استاپ",
  timeout: "پایان مدت",
  weekend: "بستن آخر هفته",
  signal_reverse: "سیگنال معکوس",
  structure_break: "شکست ساختار",
  daily_loss: "حد زیان روزانه",
  manual: "بستن دستی",
};

// ----------------------------------------------------------------------------
// Timeframes & periods & strategy modes
// ----------------------------------------------------------------------------

export const TIMEFRAMES: number[] = [1, 5, 15, 30, 60, 240, 1440];
export const BACKTEST_PERIODS: string[] = [
  "۱ ماه اخیر",
  "۳ ماه اخیر",
  "۶ ماه اخیر",
  "۱ سال اخیر",
];
export const STRATEGY_MODES: string[] = [
  "روند (Trend Following)",
  "اسکلپ (Scalping)",
  "خودکار (تشخیص رژیم بازار)",
];

// ----------------------------------------------------------------------------
// Meta response
// ----------------------------------------------------------------------------

export const META: MetaResponse = {
  default_config: DEFAULT_CONFIG,
  risk_profiles: RISK_PROFILES,
  symbol_groups: SYMBOL_GROUPS,
  exit_reason_labels: EXIT_REASON_LABELS,
  timeframes: TIMEFRAMES,
  backtest_periods: BACKTEST_PERIODS,
  strategy_modes: STRATEGY_MODES,
};

// ----------------------------------------------------------------------------
// Sample profiles
// ----------------------------------------------------------------------------

function makeProfile(
  name: string,
  mode: string,
  magic: number,
  risk: string,
  symbols: string[],
  timeframe: number,
  balance?: number
): BotConfig {
  return {
    ...DEFAULT_CONFIG,
    PROFILE_NAME: name,
    STRATEGY_MODE: mode,
    MAGIC_NUMBER: magic,
    RISK_TOLERANCE_PROFILE: risk,
    SYMBOLS: symbols,
    TIMEFRAME: timeframe,
    INITIAL_BALANCE: balance,
  };
}

export const PROFILES: Record<string, BotConfig> = {
  "TrendFollow-Conservative": makeProfile(
    "TrendFollow-Conservative",
    "روند (Trend Following)",
    100001,
    "محافظه‌کار",
    ["EURUSD", "GBPUSD"],
    60,
    10000
  ),
  "Scalp-Aggressive": makeProfile(
    "Scalp-Aggressive",
    "اسکلپ (Scalping)",
    100002,
    "تهاجمی",
    ["EURUSD", "XAUUSD"],
    5,
    10000
  ),
  "Auto-Balanced": makeProfile(
    "Auto-Balanced",
    "خودکار (تشخیص رژیم بازار)",
    100003,
    "متعادل",
    ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD"],
    15,
    10000
  ),
};

// ----------------------------------------------------------------------------
// Positions
// ----------------------------------------------------------------------------

let ticketSeq = 44000001;
function nextTicket(): number {
  return ticketSeq++;
}

function makePosition(
  profile: string,
  symbol: string,
  type: 0 | 1,
  volume: number,
  open: number,
  current: number,
  sl: number,
  tp: number,
  magic: number,
  leverage: number
): Position {
  // Approximate contract size per symbol class:
  //   FX pairs -> 100,000   Metals -> 100   Crypto -> 1
  const contractSize = symbol.startsWith("BTC") || symbol.startsWith("ETH")
    ? 1
    : symbol.startsWith("XAU") || symbol.startsWith("XAG")
    ? 100
    : 100000;

  // Profit: (current - open) * volume * contractSize * (buy? +1 : -1)
  const profit = (current - open) * volume * contractSize * (type === 0 ? 1 : -1);

  // Margin: (contractSize * price * volume) / leverage
  const margin = (open * volume * contractSize) / leverage;
  return {
    ticket: nextTicket(),
    symbol,
    type,
    volume,
    price_open: open,
    price_current: current,
    sl,
    tp,
    profit: Number(profit.toFixed(2)),
    magic,
    margin: Number(margin.toFixed(2)),
    leverage,
  };
}

const OPEN_POSITIONS: Position[] = [
  makePosition("TrendFollow-Conservative", "EURUSD", 0, 0.5, 1.0832, 1.0848, 1.0795, 1.0902, 100001, 100),
  makePosition("TrendFollow-Conservative", "GBPUSD", 1, 0.4, 1.2725, 1.2695, 1.2780, 1.2620, 100001, 100),
  makePosition("Scalp-Aggressive", "EURUSD", 0, 0.3, 1.0845, 1.0852, 1.0830, 1.0870, 100002, 100),
  makePosition("Scalp-Aggressive", "XAUUSD", 1, 0.15, 2458.4, 2451.2, 2470.0, 2440.0, 100002, 100),
  makePosition("Auto-Balanced", "BTCUSD", 0, 0.05, 60250.0, 61420.0, 58000.0, 65000.0, 100003, 100),
];

// ----------------------------------------------------------------------------
// Grouped positions
// ----------------------------------------------------------------------------

export const GROUPED_POSITIONS: GroupedPositions = OPEN_POSITIONS.reduce(
  (acc, pos) => {
    if (!acc["TrendFollow-Conservative"]) acc["TrendFollow-Conservative"] = {};
    if (!acc["Scalp-Aggressive"]) acc["Scalp-Aggressive"] = {};
    if (!acc["Auto-Balanced"]) acc["Auto-Balanced"] = {};
    const group = acc[pos.symbol.startsWith("XAU") ? "Scalp-Aggressive" :
      pos.symbol === "BTCUSD" ? "Auto-Balanced" :
      pos.magic === 100001 ? "TrendFollow-Conservative" : "Scalp-Aggressive"];
    if (!group[pos.symbol]) group[pos.symbol] = [];
    group[pos.symbol].push(pos);
    return acc;
  },
  {} as GroupedPositions
);

// Build grouped positions cleanly by magic number
function groupByMagic(): GroupedPositions {
  const out: GroupedPositions = {};
  const magicToProfile: Record<number, string> = {
    100001: "TrendFollow-Conservative",
    100002: "Scalp-Aggressive",
    100003: "Auto-Balanced",
  };
  for (const p of OPEN_POSITIONS) {
    const prof = magicToProfile[p.magic] ?? "Unknown";
    if (!out[prof]) out[prof] = {};
    if (!out[prof][p.symbol]) out[prof][p.symbol] = [];
    out[prof][p.symbol].push(p);
  }
  return out;
}

export const GROUPED_POSITIONS_CLEAN: GroupedPositions = groupByMagic();

// ----------------------------------------------------------------------------
// Bot status (one per running profile)
// ----------------------------------------------------------------------------

function makeBotStatus(profile: string, magic: number, positions: Position[]): BotStatus {
  const wins = positions.filter((p) => p.profit > 0).length;
  return {
    connected: true,
    is_running: true,
    profile_name: profile,
    magic_number: magic,
    balance: 10000,
    equity: 10000 + positions.reduce((s, p) => s + p.profit, 0),
    currency: "USD",
    account_leverage: 100,
    open_positions: positions,
    rejected_signals_total: 18 + Math.floor(Math.random() * 10),
    rejected_signals_by_symbol: Object.fromEntries(
      Array.from(new Set(positions.map((p) => p.symbol))).map((s, i) => [s, 3 + i])
    ),
    rejected_signals_by_code: {
      spread_too_wide: 7,
      regime_filter: 4,
      cooldown: 3,
      daily_loss_limit: 1,
    },
    last_rejection: {
      code: "spread_too_wide",
      symbol: "BTCUSD",
      reason: "اسپرد فعلی بیش از حد مجاز است.",
      at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    },
    symbol_states: Object.fromEntries(positions.map((p) => [p.symbol, { state: "in_position" }])),
    symbol_issues: {},
    configured_symbols: Array.from(new Set(positions.map((p) => p.symbol))),
    bot_open_trades_count: positions.length,
    open_risk_percent: positions.length * 1.0,
    daily_loss_triggered: false,
  };
}

export const BOT_STATUSES: Record<string, BotStatus> = {
  "TrendFollow-Conservative": makeBotStatus(
    "TrendFollow-Conservative",
    100001,
    OPEN_POSITIONS.filter((p) => p.magic === 100001)
  ),
  "Scalp-Aggressive": makeBotStatus(
    "Scalp-Aggressive",
    100002,
    OPEN_POSITIONS.filter((p) => p.magic === 100002)
  ),
  "Auto-Balanced": makeBotStatus(
    "Auto-Balanced",
    100003,
    OPEN_POSITIONS.filter((p) => p.magic === 100003)
  ),
};

// ----------------------------------------------------------------------------
// Dashboard stats
// ----------------------------------------------------------------------------

export const DASHBOARD_STATS: DashboardStats = {
  balance: 10500.5,
  equity: 10623.45,
  currency: "USD",
  running_bots_count: 2,
  open_positions_count: OPEN_POSITIONS.length,
  daily_pnl: 123.45,
  mt5_connected: true,
  account_login: 5003330711,
  account_server: "MetaQuotes-Demo",
  leverage: 100,
};

// ----------------------------------------------------------------------------
// Performance report (closed trades)
// ----------------------------------------------------------------------------

const REPORT_SYMBOLS = ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY"];
const REPORT_SIDES = ["buy", "sell"];

function makeReportTrade(i: number): import("./types").ReportTrade {
  const sym = pick(REPORT_SYMBOLS);
  const side = pick(REPORT_SIDES);
  const volume = pick([0.1, 0.2, 0.3, 0.5, 1.0]);
  const price = sym === "XAUUSD" ? rand(2300, 2480) : rand(0.95, 1.32);
  const profit = Number(rand(-180, 250).toFixed(2));
  const time = new Date(
    Date.now() - randInt(1, 30) * 24 * 60 * 60 * 1000 - randInt(0, 23) * 60 * 60 * 1000
  ).toISOString();
  return {
    ticket: 55000000 + i,
    symbol: sym,
    type: side,
    volume,
    price: Number(price.toFixed(5)),
    profit,
    time,
  };
}

export function makeReport(days: number = 30): PerformanceReport {
  const trades = Array.from({ length: 30 }, (_, i) => makeReportTrade(i));
  const wins = trades.filter((t) => t.profit > 0).length;
  const losses = trades.length - wins;
  const total_profit = Number(trades.reduce((s, t) => s + t.profit, 0).toFixed(2));
  return {
    total_profit,
    total_trades: trades.length,
    win_rate: Number(((wins / trades.length) * 100).toFixed(1)),
    wins,
    losses,
    trades,
    account_login: 5003330711,
    account_server: "MetaQuotes-Demo",
    balance: 10500.5,
    equity: 10500.5 + total_profit,
    currency: "USD",
  };
}

// ----------------------------------------------------------------------------
// Backtest trades + result
// ----------------------------------------------------------------------------

const BT_SYMBOLS = ["EURUSD", "GBPUSD", "XAUUSD"];
const BT_SIDES = ["buy", "sell"];
const BT_EXIT_REASONS = [
  "tp_hit",
  "sl_hit",
  "trailing",
  "timeout",
  "signal_reverse",
];
const BT_HTF_TRENDS = ["up", "down", "flat"];
const BT_SLTP_METHODS = ["atr", "donchian", "sr", "percent"];

function makeBacktestTrade(i: number, baseEquity: number): { trade: BacktestTrade; cumProfit: number; equity: number } {
  const symbol = pick(BT_SYMBOLS);
  const side = pick(BT_SIDES);
  const volume = pick([0.1, 0.2, 0.3, 0.5]);
  const openPrice =
    symbol === "XAUUSD" ? rand(2300, 2480) : rand(0.95, 1.32);
  const win = Math.random() > 0.4;
  const profit = Number((win ? rand(40, 220) : -rand(30, 180)).toFixed(2));
  const closePrice =
    side === "buy"
      ? openPrice + (profit > 0 ? rand(0.0005, 0.003) : -rand(0.0005, 0.003))
      : openPrice - (profit > 0 ? rand(0.0005, 0.003) : -rand(0.0005, 0.003));
  const openTime = new Date(
    Date.now() - (50 - i) * 6 * 60 * 60 * 1000
  ).toISOString();
  const closeTime = new Date(
    Date.now() - (50 - i) * 6 * 60 * 60 * 1000 + randInt(1, 36) * 60 * 60 * 1000
  ).toISOString();
  const exit_reason = pick(BT_EXIT_REASONS);
  const cumProfit = profit;
  const equity = Number((baseEquity + cumProfit).toFixed(2));
  return {
    trade: {
      ticket: 66000000 + i,
      symbol,
      side,
      volume,
      open_time: openTime,
      open_price: Number(openPrice.toFixed(5)),
      sl: Number((openPrice * (side === "buy" ? 0.995 : 1.005)).toFixed(5)),
      tp: Number((openPrice * (side === "buy" ? 1.01 : 0.99)).toFixed(5)),
      close_time: closeTime,
      close_price: Number(closePrice.toFixed(5)),
      profit,
      commission: -2.5,
      exit_reason,
      exit_reason_fa: EXIT_REASON_LABELS[exit_reason] ?? exit_reason,
      atr_at_open: Number(rand(0.0008, 0.004).toFixed(5)),
      adx_at_open: Number(rand(18, 38).toFixed(1)),
      rsi_at_open: Number(rand(25, 75).toFixed(1)),
      htf_trend: pick(BT_HTF_TRENDS),
      sl_tp_method: pick(BT_SLTP_METHODS),
      bars_held: randInt(2, 24),
    },
    cumProfit,
    equity,
  };
}

export function makeBacktestResult(): BacktestResultPayload {
  const baseEquity = 10000;
  const trades: BacktestTrade[] = [];
  let cum = 0;
  const equitySeries: { idx: number; equity: number }[] = [];
  for (let i = 0; i < 50; i++) {
    const { trade, cumProfit, equity } = makeBacktestTrade(i, baseEquity + cum);
    cum += cumProfit;
    trades.push(trade);
    equitySeries.push({ idx: i, equity: Number((baseEquity + cum).toFixed(2)) });
  }
  const wins = trades.filter((t) => t.profit > 0).length;
  const losses = trades.length - wins;
  const total_profit = Number(trades.reduce((s, t) => s + t.profit, 0).toFixed(2));
  const gross_profit = trades.filter((t) => t.profit > 0).reduce((s, t) => s + t.profit, 0);
  const gross_loss = -trades.filter((t) => t.profit < 0).reduce((s, t) => s + t.profit, 0);
  const profit_factor = Number((gross_profit / Math.max(gross_loss, 1)).toFixed(2));

  // Per-symbol stats
  const perSymbolMap: Record<string, BacktestTrade[]> = {};
  for (const t of trades) {
    if (!perSymbolMap[t.symbol]) perSymbolMap[t.symbol] = [];
    perSymbolMap[t.symbol].push(t);
  }
  const per_symbol = Object.entries(perSymbolMap).map(([symbol, ts]) => {
    const w = ts.filter((t) => t.profit > 0).length;
    const tp = ts.reduce((s, t) => s + t.profit, 0);
    const gp = ts.filter((t) => t.profit > 0).reduce((s, t) => s + t.profit, 0);
    const gl = -ts.filter((t) => t.profit < 0).reduce((s, t) => s + t.profit, 0);
    return {
      symbol,
      total_profit: Number(tp.toFixed(2)),
      total_trades: ts.length,
      win_rate: Number(((w / ts.length) * 100).toFixed(1)),
      profit_factor: Number((gp / Math.max(gl, 1)).toFixed(2)),
      max_drawdown_percent: Number(rand(2, 8).toFixed(2)),
      expectancy: Number((tp / ts.length).toFixed(2)),
    };
  });

  // Max drawdown calculation
  let peak = baseEquity;
  let maxDD = 0;
  let maxDDMoney = 0;
  let running = baseEquity;
  for (const t of trades) {
    running += t.profit;
    if (running > peak) peak = running;
    const dd = (peak - running) / peak;
    if (dd > maxDD) {
      maxDD = dd;
      maxDDMoney = peak - running;
    }
  }

  return {
    total_profit,
    wins,
    losses,
    win_rate: Number(((wins / trades.length) * 100).toFixed(1)),
    max_dd_pct: Number((maxDD * 100).toFixed(2)),
    max_dd_money: Number(maxDDMoney.toFixed(2)),
    advanced: {
      profit_factor: profit_factor,
      expectancy: Number((total_profit / trades.length).toFixed(2)),
      gross_profit: Number(gross_profit.toFixed(2)),
      gross_loss: Number(gross_loss.toFixed(2)),
      average_win: Number((gross_profit / Math.max(wins, 1)).toFixed(2)),
      average_loss: Number((gross_loss / Math.max(losses, 1)).toFixed(2)),
      sharpe_ratio: Number(rand(0.8, 1.8).toFixed(2)),
      sortino_ratio: Number(rand(1.0, 2.4).toFixed(2)),
      longest_winning_streak: randInt(3, 7),
      longest_losing_streak: randInt(2, 5),
      recovery_factor: Number(rand(1.5, 4.5).toFixed(2)),
      equity_curve: equitySeries,
    },
    tips: [
      "میانگین سود در معاملات برنده نسبت به میانگین زیان در معاملات بازنده مناسب است؛ نسبت ریسک به بازده حفظ شده است.",
      "حداکثر افت سرمایه در محدودهٔ مجاز قرار دارد، اما در ساعات نوسانی بازار مراقب افزایش اسپرد باشید.",
      "نشانه‌ای از افت عملکرد در سشن نیویورک دیده می‌شود؛ پیشنهاد می‌شود فیلتر سشن فعال شود.",
      "در نماد XAUUSD نرخ برد پایین‌تر است؛ توصیه می‌شود حد ضرر Donchian را کمی سست‌تر تنظیم کنید.",
      "میانگین مدت نگه‌داری معاملات منطقی است؛ تنظیم timeout فعلی به‌نظر کافی می‌رسد.",
    ],
    trades,
    per_symbol,
  };
}

export const BACKTEST_RESULT: BacktestResultPayload = makeBacktestResult();

// ----------------------------------------------------------------------------
// AI engine status
// ----------------------------------------------------------------------------

export const AI_ENGINE_STATUS: AIEngineStatus = {
  trained: true,
  symbol: "EURUSD",
  timeframe: 15,
  accuracy: 0.6234,
  samples: 5000,
  trained_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  is_training: false,
};

// ----------------------------------------------------------------------------
// Log lines
// ----------------------------------------------------------------------------

function ts(minAgo: number, sec = 0): string {
  const d = new Date(Date.now() - minAgo * 60 * 1000 - sec * 1000);
  return d.toISOString().replace("T", " ").replace(/\..+/, "");
}

export const LOG_LINES_INITIAL: string[] = [
  `[${ts(60)}] [INFO] TrendPilot server v1.0.0 started on :3030`,
  `[${ts(58)}] [INFO] MT5 bridge agent ready (path=C:\\Program Files\\MetaTrader 5\\terminal64.exe)`,
  `[${ts(55)}] [INFO] Profile 'TrendFollow-Conservative' loaded — magic=100001`,
  `[${ts(54)}] [INFO] Profile 'Scalp-Aggressive' loaded — magic=100002`,
  `[${ts(53)}] [INFO] Profile 'Auto-Balanced' loaded — magic=100003`,
  `[${ts(52)}] [INFO] Bot 'TrendFollow-Conservative' connected to MT5 server 'MetaQuotes-Demo' (login=5003330711)`,
  `[${ts(51)}] [INFO] Bot 'Scalp-Aggressive' connected to MT5 server 'MetaQuotes-Demo'`,
  `[${ts(50)}] [INFO] EURUSD timeframe=15m → 96 bars loaded, ATR=0.00082, ADX=27.4`,
  `[${ts(48)}] [INFO] GBPUSD timeframe=60m regime=trend, efficiency=0.42 (OK)`,
  `[${ts(46)}] [INFO] Signal BUY EURUSD @1.0832 sl=1.0795 tp=1.0902 vol=0.50 magic=100001`,
  `[${ts(45)}] [INFO] Position opened: ticket=44000001 EURUSD buy 0.50 @1.0832`,
  `[${ts(44)}] [INFO] Signal SELL GBPUSD @1.2725 sl=1.2780 tp=1.2620 vol=0.40 magic=100001`,
  `[${ts(43)}] [INFO] Position opened: ticket=44000002 GBPUSD sell 0.40 @1.2725`,
  `[${ts(42)}] [WARN] BTCUSD spread=35 points exceeds SCALP_MAX_SPREAD_POINTS=28 → signal rejected`,
  `[${ts(41)}] [INFO] Scalp entry EURUSD @1.0845 RSI=27 (oversold), wick_ratio=0.61 → BUY signal`,
  `[${ts(40)}] [INFO] Position opened: ticket=44000003 EURUSD buy 0.30 @1.0845 magic=100002`,
  `[${ts(38)}] [INFO] XAUUSD scalp signal SELL @2458.4 sl=2470.0 tp=2440.0`,
  `[${ts(37)}] [INFO] Position opened: ticket=44000004 XAUUSD sell 0.15 @2458.4 magic=100002`,
  `[${ts(35)}] [INFO] Auto-Balanced regime detect: BTCUSD=range, EURUSD=trend → use Trend mode`,
  `[${ts(34)}] [INFO] Signal BUY BTCUSD @60250 sl=58000 tp=65000 vol=0.05 magic=100003`,
  `[${ts(33)}] [INFO] Position opened: ticket=44000005 BTCUSD buy 0.05 @60250 magic=100003`,
  `[${ts(30)}] [INFO] Trailing stop activated on EURUSD #44000003 — moved SL to 1.0840`,
  `[${ts(28)}] [DEBUG] Tick EURUSD bid=1.0848 ask=1.0849 spread=1 point`,
  `[${ts(25)}] [WARN] XAUUSD spread=42 points → 2 signals rejected (cooldown=4 bars)`,
  `[${ts(20)}] [INFO] Daily P&L = +123.45 USD (within daily_loss_limit=5%)`,
  `[${ts(15)}] [DEBUG] Cooldown active on GBPUSD (3/4 bars elapsed)`,
  `[${ts(10)}] [INFO] Bot heartbeat: 3 bots running, 5 open positions, total risk=2.5%`,
  `[${ts(5)}] [INFO] Equity snapshot: balance=10500.50 equity=10623.45 margin_used=189.32 (1.8%)`,
];

export const LOG_LINES_STREAM: string[] = [
  `[${ts(3)}] [DEBUG] Tick XAUUSD bid=2451.20 ask=2451.45 spread=25 points`,
  `[${ts(2)}] [INFO] Trailing stop: ticket=44000004 XAUUSD → SL moved to 2465.0`,
  `[${ts(1)}] [INFO] Bot heartbeat: 3 bots running, 5 open positions`,
  `[${ts(0)}] [DEBUG] ATR recalc: EURUSD 15m = 0.00085`,
];

// ----------------------------------------------------------------------------
// LogResponse factory (used by mock-store)
// ----------------------------------------------------------------------------

export function makeLogResponse(since: number = 0): LogResponse {
  const all = [...LOG_LINES_INITIAL, ...LOG_LINES_STREAM];
  const slice = all.slice(since);
  return {
    lines: slice,
    next: all.length,
  };
}

// ----------------------------------------------------------------------------
// Health
// ----------------------------------------------------------------------------

export const HEALTH = {
  status: "ok",
  server: "trendpilot-server",
  version: "1.0.0",
  mt5_bridge: "online",
  uptime_seconds: 8423,
};
