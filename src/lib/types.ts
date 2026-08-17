// ============================================================
// TrendPilot Web — Type definitions (based on PDF section 6)
// ============================================================

/** MT5 connection + strategy configuration for a bot profile. */
export interface BotConfig {
  // --- MT5 connection ---
  MT5_LOGIN: number;
  MT5_PASSWORD: string;
  MT5_SERVER: string;
  MT5_PATH: string | null;

  // --- Symbols & timeframe ---
  SYMBOLS: string[];
  TIMEFRAME: number; // minutes: 1, 5, 15, 30, 60, 240, 1440
  STRATEGY_MODE: string; // "روند (Trend Following)" | "اسکلپ (Scalping)" | "خودکار (تشخیص رژیم بازار)"

  // --- Market regime filter ---
  REGIME_ADX_MAX: number;
  REGIME_BB_SLOPE_LOOKBACK: number;
  REGIME_BB_SLOPE_MAX_PERCENT: number;
  REGIME_EFFICIENCY_LOOKBACK: number;
  REGIME_EFFICIENCY_MAX: number;
  REGIME_ATR_LOOKBACK: number;
  REGIME_ATR_MIN_PERCENTILE: number;
  REGIME_ATR_MAX_PERCENTILE: number;

  // --- Scalp entry (mean reversion) ---
  SCALP_BB_PERIOD: number;
  SCALP_BB_STD: number;
  SCALP_RSI_PERIOD: number;
  SCALP_RSI_OVERSOLD: number;
  SCALP_RSI_OVERBOUGHT: number;
  SCALP_REQUIRE_REJECTION: boolean;
  SCALP_REJECTION_WICK_RATIO: number;

  // --- Scalp exit ---
  SCALP_STRUCTURE_LOOKBACK: number;
  SCALP_STRUCTURE_BUFFER_ATR: number;
  SCALP_ATR_SL_MULTIPLIER: number;
  SCALP_TP_MODE: string;
  SCALP_TP_ATR_FALLBACK: number;
  SCALP_MIN_RR: number;
  SCALP_MAX_SPREAD_POINTS: number;
  SCALP_SESSION_FILTER_ENABLED: boolean;
  SCALP_SESSION_START_HOUR_UTC: number;
  SCALP_SESSION_END_HOUR_UTC: number;

  // --- Risk / SL-TP ---
  RISK_PERCENT_PER_TRADE: number;
  SL_PERCENT: number;
  TP_PERCENT: number;
  ENABLE_LEVERAGE_AWARE_PERCENT_STOPS: boolean;
  ENABLE_SR_STOPS: boolean;
  SR_LOOKBACK_BARS: number;
  SR_BUFFER_ATR_MULTIPLIER: number;
  ENABLE_DONCHIAN_SL: boolean;
  DONCHIAN_PERIOD: number;
  DONCHIAN_ATR_MULTIPLIER: number;
  RISK_TOLERANCE_PROFILE: string;

  // --- Trend entry ---
  ADX_TREND_THRESHOLD: number;
  COOLDOWN_BARS: number;
  MAX_CONCURRENT_TRADES: number;
  MAX_TOTAL_RISK_PERCENT: number;
  ENABLE_DAILY_LOSS_LIMIT: boolean;
  DAILY_LOSS_LIMIT_PERCENT: number;
  ENABLE_HTF_CONFIRMATION: boolean;
  HTF_TIMEFRAME: number | null;

  // --- Exit ---
  ENABLE_TRAILING_STOP: boolean;
  TRAILING_ACTIVATION_ATR_MULTIPLIER: number;
  TRAILING_DISTANCE_ATR_MULTIPLIER: number;
  ENABLE_MAX_TRADE_DURATION: boolean;
  MAX_TRADE_DURATION_HOURS: number;
  ENABLE_WEEKEND_CLOSE: boolean;
  WEEKEND_CLOSE_HOUR_UTC: number;

  // --- Misc ---
  REQUIRE_DEMO_ACCOUNT: boolean;
  PROFILE_NAME: string;
  MAGIC_NUMBER: number;
  INITIAL_BALANCE?: number;
}

/** An open MT5 position. */
export interface Position {
  ticket: number;
  symbol: string;
  type: number; // 0 = buy, 1 = sell
  volume: number;
  price_open: number;
  price_current: number;
  sl: number;
  tp: number;
  profit: number;
  magic: number;
  margin: number;
  leverage: number;
}

/** Live runtime status of one running bot. */
export interface BotStatus {
  connected: boolean;
  is_running: boolean;
  profile_name: string;
  magic_number: number;
  balance?: number;
  equity?: number;
  currency?: string;
  account_leverage?: number | null;
  open_positions?: Position[];
  rejected_signals_total: number;
  rejected_signals_by_symbol: Record<string, number>;
  rejected_signals_by_code: Record<string, number>;
  last_rejection: Record<string, any>;
  symbol_states: Record<string, any>;
  symbol_issues?: Record<string, string>;
  configured_symbols?: string[];
  bot_open_trades_count?: number;
  open_risk_percent?: number;
  daily_loss_triggered: boolean;
}

/** A closed trade in the performance report. */
export interface ReportTrade {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  price: number;
  profit: number;
  time: string;
}

/** Aggregated performance report for a profile over a date range. */
export interface PerformanceReport {
  error?: string;
  total_profit: number;
  total_trades: number;
  win_rate: number;
  wins: number;
  losses: number;
  trades: ReportTrade[];
  account_login?: number;
  account_server?: string;
  balance?: number;
  equity?: number;
  currency?: string;
}

/** A single backtest trade record. */
export interface BacktestTrade {
  ticket: number;
  symbol: string;
  side: string;
  volume: number;
  open_time: string;
  open_price: number;
  sl: number;
  tp: number;
  close_time?: string;
  close_price?: number;
  profit: number;
  commission: number;
  exit_reason: string;
  exit_reason_fa: string;
  atr_at_open: number;
  adx_at_open: number;
  rsi_at_open: number;
  htf_trend: string;
  sl_tp_method: string;
  bars_held: number;
}

/** Per-symbol aggregated stats. */
export interface PerSymbolStats {
  symbol: string;
  total_profit: number;
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown_percent: number;
  expectancy: number;
}

/** Full backtest result payload. */
export interface BacktestResultPayload {
  total_profit: number;
  wins: number;
  losses: number;
  win_rate: number;
  max_dd_pct: number;
  max_dd_money: number;
  advanced: Record<string, any>;
  tips: string[];
  trades: BacktestTrade[];
  per_symbol: PerSymbolStats[];
}

/** State of a backtest job (running / done / error). */
export interface BacktestJob {
  status: "running" | "done" | "error";
  result?: BacktestResultPayload;
  errors?: string[];
  config?: BotConfig;
}

/** Risk preset applied to multiple fields at once. */
export interface RiskPreset {
  RISK_PERCENT_PER_TRADE: number;
  DONCHIAN_PERIOD: number;
  DONCHIAN_ATR_MULTIPLIER: number;
  ADX_TREND_THRESHOLD: number;
  COOLDOWN_BARS: number;
  MAX_CONCURRENT_TRADES: number;
  MAX_TOTAL_RISK_PERCENT: number;
  ENABLE_TRAILING_STOP: boolean;
  TRAILING_ACTIVATION_ATR_MULTIPLIER: number;
  TRAILING_DISTANCE_ATR_MULTIPLIER: number;
}

/** Server-side metadata: defaults, presets, labels. */
export interface MetaResponse {
  default_config: BotConfig;
  risk_profiles: Record<string, RiskPreset | null>;
  symbol_groups: Record<string, string[]>;
  exit_reason_labels: Record<string, string>;
  timeframes: number[];
  backtest_periods: string[];
  strategy_modes: string[];
}

/** Aggregated dashboard statistics. */
export interface DashboardStats {
  balance: number;
  equity: number;
  currency: string;
  running_bots_count: number;
  open_positions_count: number;
  daily_pnl: number;
  mt5_connected: boolean;
  account_login?: number;
  account_server?: string;
  leverage?: number;
}

/** Positions grouped first by profile, then by symbol. */
export interface GroupedPositions {
  [profile_name: string]: {
    [symbol: string]: Position[];
  };
}

/** A single OHLCV candle (used by the MT5 bridge /analyze endpoint). */
export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** Status of the local AI engine (model trained or training). */
export interface AIEngineStatus {
  trained: boolean;
  symbol?: string;
  timeframe?: number;
  accuracy?: number;
  samples?: number;
  trained_at?: string;
  is_training?: boolean;
}

/** Live log line response with cursor for next fetch. */
export interface LogResponse {
  lines: string[];
  next: number;
}

/** Saved profiles list response. */
export interface ProfilesResponse {
  profiles: Record<string, BotConfig>;
}
