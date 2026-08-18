// ============================================================
// موتور بکتست
// طبق بخش ۴.۸: «باید دقیقاً همان منطقی را اجرا کند که در حالت زنده
// اجرا می‌شود» — به همین دلیل این ماژول مستقیماً از decide() در
// engine/decision.ts استفاده می‌کند، نه یک پیاده‌سازی جدا.
// ============================================================
import { decide } from "../engine/decision.js";
import { computeIndicators, type Candle } from "../indicators/engine.js";
import type { BotConfig } from "../types.js";
import type { AccountSnapshot } from "../risk/risk.js";
import type { OpenTradeState } from "../risk/position-management.js";
import { historicalDataProvider } from "./data-provider.js";
import { EXIT_REASON_LABELS } from "./exit-reasons.js";

export interface BacktestParams {
  config: BotConfig;
  symbols: string[];
  startUnix: number;
  endUnix: number;
}

interface OpenSimTrade {
  ticket: number;
  symbol: string;
  direction: "buy" | "sell";
  volume: number;
  entryPrice: number;
  sl: number;
  tp: number;
  openTime: number;
  openBarIndex: number;
  atrAtOpen: number;
  adxAtOpen: number;
  rsiAtOpen: number;
  htfTrend: string;
  slTpMethod: string;
  trailingActivated: boolean;
}

function contractSizeFor(symbol: string): number {
  if (symbol.startsWith("XAU") || symbol.startsWith("XAG")) return 100;
  if (symbol.includes("BTC") || symbol.includes("ETH")) return 1;
  return 100000;
}

const MIN_WARMUP_BARS = 120; // تعداد کندل لازم قبل از شروع تصمیم‌گیری، تا اندیکاتورها seed شوند

export async function runBacktest(params: BacktestParams) {
  const { config, symbols, startUnix, endUnix } = params;

  const commissionPerLot = 3.5;
  const startingBalance = config.INITIAL_BALANCE ?? 10000;
  let balance = startingBalance;
  let equity = startingBalance;
  let peakEquity = startingBalance;
  let maxDdMoney = 0;
  let maxDdPct = 0;

  const trades: ReturnType<typeof buildTradeRecord>[] = [];
  const equityCurve: { time: number; equity: number }[] = [];

  let ticketSeq = 1;
  const perSymbolOpen = new Map<string, OpenSimTrade | null>();
  const lastTradeBarBySymbol = new Map<string, number>();
  let dailyStartEquity = startingBalance;
  let lastDay = -1;

  for (const symbol of symbols) {
    perSymbolOpen.set(symbol, null);

    const candles = await historicalDataProvider.getCandles(symbol, config.TIMEFRAME, startUnix, endUnix);
    if (candles.length < MIN_WARMUP_BARS + 1) continue;

    const htfCandles = config.ENABLE_HTF_CONFIRMATION && config.HTF_TIMEFRAME
      ? await historicalDataProvider.getCandles(symbol, config.HTF_TIMEFRAME, startUnix, endUnix)
      : undefined;

    const contractSize = contractSizeFor(symbol);

    for (let i = MIN_WARMUP_BARS; i < candles.length; i++) {
      const window = candles.slice(0, i + 1);
      const cur = window[window.length - 1];

      const day = new Date(cur.time * 1000).getUTCDate();
      if (day !== lastDay) {
        lastDay = day;
        dailyStartEquity = equity;
      }

      let open = perSymbolOpen.get(symbol) ?? null;

      // --- مدیریت پوزیشن باز فعلی (SL/TP/Trailing/حداکثر مدت) ---
      if (open) {
        const series = computeIndicators(window.slice(Math.max(0, window.length - MIN_WARMUP_BARS)));
        const curInd = series[series.length - 1];

        let exitPrice: number | null = null;
        let exitReason: keyof typeof EXIT_REASON_LABELS | null = null;

        // برخورد با SL/TP در بازه‌ی high/low کندل جاری
        if (open.direction === "buy") {
          if (cur.low <= open.sl) { exitPrice = open.sl; exitReason = "sl_hit"; }
          else if (cur.high >= open.tp) { exitPrice = open.tp; exitReason = "tp_hit"; }
        } else {
          if (cur.high >= open.sl) { exitPrice = open.sl; exitReason = "sl_hit"; }
          else if (cur.low <= open.tp) { exitPrice = open.tp; exitReason = "tp_hit"; }
        }

        // Trailing Stop
        if (!exitPrice && config.ENABLE_TRAILING_STOP && curInd.atr != null) {
          const activationDist = curInd.atr * config.TRAILING_ACTIVATION_ATR_MULTIPLIER;
          const trailDist = curInd.atr * config.TRAILING_DISTANCE_ATR_MULTIPLIER;
          const profitDist = open.direction === "buy" ? cur.close - open.entryPrice : open.entryPrice - cur.close;
          if (profitDist >= activationDist) {
            const candidateSl = open.direction === "buy" ? cur.close - trailDist : cur.close + trailDist;
            const improves = open.direction === "buy" ? candidateSl > open.sl : candidateSl < open.sl;
            if (improves) { open.sl = candidateSl; open.trailingActivated = true; }
          }
        }

        // حداکثر مدت معامله
        if (!exitPrice && config.ENABLE_MAX_TRADE_DURATION) {
          const hoursOpen = (cur.time - open.openTime) / 3600;
          if (hoursOpen >= config.MAX_TRADE_DURATION_HOURS) { exitPrice = cur.close; exitReason = "timeout"; }
        }

        // بستن آخر هفته
        if (!exitPrice && config.ENABLE_WEEKEND_CLOSE) {
          const d = new Date(cur.time * 1000);
          const wd = d.getUTCDay();
          const hr = d.getUTCHours();
          if ((wd === 5 && hr >= config.WEEKEND_CLOSE_HOUR_UTC) || wd === 6 || wd === 0) {
            exitPrice = cur.close; exitReason = "weekend";
          }
        }

        if (exitPrice != null && exitReason != null) {
          const diff = open.direction === "buy" ? exitPrice - open.entryPrice : open.entryPrice - exitPrice;
          const grossProfit = diff * open.volume * contractSize;
          const commission = commissionPerLot * open.volume;
          const netProfit = grossProfit - commission;
          balance += netProfit;

          trades.push(
            buildTradeRecord({
              ticket: open.ticket, symbol, direction: open.direction, volume: open.volume,
              openTime: open.openTime, entryPrice: open.entryPrice, sl: open.sl, tp: open.tp,
              closeTime: cur.time, closePrice: exitPrice, profit: netProfit, commission,
              exitReason, atrAtOpen: open.atrAtOpen, adxAtOpen: open.adxAtOpen, rsiAtOpen: open.rsiAtOpen,
              htfTrend: open.htfTrend, slTpMethod: open.slTpMethod,
              barsHeld: i - open.openBarIndex,
            })
          );
          open = null;
          perSymbolOpen.set(symbol, null);
          lastTradeBarBySymbol.set(symbol, i);
        }
      }

      // --- در صورت نبود پوزیشن باز، از موتور تصمیم مشترک بپرس ---
      if (!open) {
        const htfWindow = htfCandles
          ? htfCandles.filter((c) => c.time <= cur.time).slice(-MIN_WARMUP_BARS)
          : undefined;

        const lastBar = lastTradeBarBySymbol.get(symbol) ?? null;
        const barsSince = lastBar == null ? null : i - lastBar;
        const dailyPnlPercent = ((equity - dailyStartEquity) / dailyStartEquity) * 100;

        const account: AccountSnapshot = { balance, equity, leverage: 100, currentOpenRiskPercent: 0 };
        const openTradesForSymbol: OpenTradeState[] = [];

        const decision = decide({
          config,
          candles: window.slice(Math.max(0, window.length - MIN_WARMUP_BARS)),
          htfCandles: htfWindow,
          account,
          contractSize,
          openTradesForSymbol,
          openTradesCountForProfile: 0,
          barsSinceLastTradeForSymbol: barsSince,
          dailyPnlPercent,
          nowUnix: cur.time,
        });

        if (decision.order === "buy" || decision.order === "sell") {
          const ind = decision.indicatorSnapshot;
          perSymbolOpen.set(symbol, {
            ticket: ticketSeq++,
            symbol,
            direction: decision.order,
            volume: decision.volume!,
            entryPrice: cur.close,
            sl: decision.sl!,
            tp: decision.tp!,
            openTime: cur.time,
            openBarIndex: i,
            atrAtOpen: ind.atr ?? 0,
            adxAtOpen: ind.adx ?? 0,
            rsiAtOpen: ind.rsi ?? 0,
            htfTrend: decision.regime === "trend" ? "روند" : decision.regime === "range" ? "رنج" : "-",
            slTpMethod:
              config.STRATEGY_MODE.includes("اسکلپ") || decision.regime === "range"
                ? `اسکلپ (${config.SCALP_ATR_SL_MULTIPLIER}×ATR)`
                : config.ENABLE_DONCHIAN_SL
                ? "دانچیان"
                : config.ENABLE_SR_STOPS
                ? "ساختاری"
                : "درصدی ساده",
            trailingActivated: false,
          });
        }
      }

      equity =
        balance +
        (perSymbolOpen.get(symbol)
          ? (() => {
              const o = perSymbolOpen.get(symbol)!;
              const diff = o.direction === "buy" ? cur.close - o.entryPrice : o.entryPrice - cur.close;
              return diff * o.volume * contractSize;
            })()
          : 0);

      peakEquity = Math.max(peakEquity, equity);
      const ddMoney = peakEquity - equity;
      const ddPct = peakEquity > 0 ? (ddMoney / peakEquity) * 100 : 0;
      maxDdMoney = Math.max(maxDdMoney, ddMoney);
      maxDdPct = Math.max(maxDdPct, ddPct);

      if (i % 5 === 0 || i === candles.length - 1) {
        equityCurve.push({ time: cur.time, equity });
      }
    }

    // بستن پوزیشن باز باقی‌مانده در پایان بازه‌ی بکتست
    const stillOpen = perSymbolOpen.get(symbol);
    if (stillOpen) {
      const lastCandle = candles[candles.length - 1];
      const diff = stillOpen.direction === "buy" ? lastCandle.close - stillOpen.entryPrice : stillOpen.entryPrice - lastCandle.close;
      const grossProfit = diff * stillOpen.volume * contractSize;
      const commission = commissionPerLot * stillOpen.volume;
      const netProfit = grossProfit - commission;
      balance += netProfit;
      trades.push(
        buildTradeRecord({
          ticket: stillOpen.ticket, symbol, direction: stillOpen.direction, volume: stillOpen.volume,
          openTime: stillOpen.openTime, entryPrice: stillOpen.entryPrice, sl: stillOpen.sl, tp: stillOpen.tp,
          closeTime: lastCandle.time, closePrice: lastCandle.close, profit: netProfit, commission,
          exitReason: "manual", atrAtOpen: stillOpen.atrAtOpen, adxAtOpen: stillOpen.adxAtOpen,
          rsiAtOpen: stillOpen.rsiAtOpen, htfTrend: stillOpen.htfTrend, slTpMethod: stillOpen.slTpMethod,
          barsHeld: candles.length - 1 - stillOpen.openBarIndex,
        })
      );
    }
  }

  trades.sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  const wins = trades.filter((t) => t.profit > 0).length;
  const losses = trades.filter((t) => t.profit <= 0).length;
  const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
  const grossWin = trades.filter((t) => t.profit > 0).reduce((s, t) => s + t.profit, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.profit <= 0).reduce((s, t) => s + t.profit, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  const perSymbol = symbols.map((symbol) => {
    const symTrades = trades.filter((t) => t.symbol === symbol);
    const symWins = symTrades.filter((t) => t.profit > 0).length;
    const symProfit = symTrades.reduce((s, t) => s + t.profit, 0);
    const symGrossWin = symTrades.filter((t) => t.profit > 0).reduce((s, t) => s + t.profit, 0);
    const symGrossLoss = Math.abs(symTrades.filter((t) => t.profit <= 0).reduce((s, t) => s + t.profit, 0));
    let peak = startingBalance / symbols.length;
    let bal = peak;
    let ddPctSym = 0;
    for (const t of symTrades) {
      bal += t.profit;
      peak = Math.max(peak, bal);
      ddPctSym = Math.max(ddPctSym, peak > 0 ? ((peak - bal) / peak) * 100 : 0);
    }
    return {
      symbol,
      total_profit: symProfit,
      total_trades: symTrades.length,
      win_rate: symTrades.length ? (symWins / symTrades.length) * 100 : 0,
      profit_factor: symGrossLoss > 0 ? symGrossWin / symGrossLoss : symGrossWin > 0 ? Infinity : 0,
      max_drawdown_percent: ddPctSym,
      expectancy: symTrades.length ? symProfit / symTrades.length : 0,
    };
  });

  const tips = buildTips({ winRate: trades.length ? (wins / trades.length) * 100 : 0, profitFactor, maxDdPct, tradeCount: trades.length, config });

  return {
    total_profit: totalProfit,
    wins,
    losses,
    win_rate: trades.length ? (wins / trades.length) * 100 : 0,
    max_dd_pct: maxDdPct,
    max_dd_money: maxDdMoney,
    advanced: {
      profit_factor: profitFactor,
      starting_balance: startingBalance,
      ending_balance: balance,
      equity_curve: equityCurve,
      total_commission: trades.reduce((s, t) => s + t.commission, 0),
      avg_bars_held: trades.length ? trades.reduce((s, t) => s + t.bars_held, 0) / trades.length : 0,
    },
    tips,
    trades,
    per_symbol: perSymbol,
  };
}

function buildTradeRecord(p: {
  ticket: number; symbol: string; direction: "buy" | "sell"; volume: number;
  openTime: number; entryPrice: number; sl: number; tp: number;
  closeTime: number; closePrice: number; profit: number; commission: number;
  exitReason: keyof typeof EXIT_REASON_LABELS; atrAtOpen: number; adxAtOpen: number; rsiAtOpen: number;
  htfTrend: string; slTpMethod: string; barsHeld: number;
}) {
  return {
    ticket: p.ticket,
    symbol: p.symbol,
    side: p.direction === "buy" ? "خرید" : "فروش",
    volume: p.volume,
    open_time: new Date(p.openTime * 1000).toISOString(),
    open_price: p.entryPrice,
    sl: p.sl,
    tp: p.tp,
    close_time: new Date(p.closeTime * 1000).toISOString(),
    close_price: p.closePrice,
    profit: p.profit,
    commission: p.commission,
    exit_reason: p.exitReason,
    exit_reason_fa: EXIT_REASON_LABELS[p.exitReason] ?? p.exitReason,
    atr_at_open: p.atrAtOpen,
    adx_at_open: p.adxAtOpen,
    rsi_at_open: p.rsiAtOpen,
    htf_trend: p.htfTrend,
    sl_tp_method: p.slTpMethod,
    bars_held: p.barsHeld,
  };
}

function buildTips(input: { winRate: number; profitFactor: number; maxDdPct: number; tradeCount: number; config: BotConfig }): string[] {
  const tips: string[] = [];
  if (input.tradeCount === 0) {
    tips.push("در این بازه هیچ معامله‌ای ثبت نشد — آستانه‌های ورود (ADX، RSI) را بررسی کنید یا نمادها/بازه‌ی زمانی را تغییر دهید.");
    return tips;
  }
  if (input.winRate < 40) tips.push("نرخ برد پایین است — فیلترهای ورود را سخت‌گیرانه‌تر کنید یا آستانه‌ی ADX_TREND_THRESHOLD را بالا ببرید.");
  if (input.profitFactor < 1.2) tips.push("Profit Factor نزدیک به ۱ است — نسبت ریسک به ریوارد (TP/SL) را بازبینی کنید.");
  if (input.maxDdPct > 20) tips.push("حداکثر افت سرمایه بالاست — درصد ریسک هر معامله (RISK_PERCENT_PER_TRADE) را کاهش دهید.");
  if (input.config.MAX_CONCURRENT_TRADES > 5) tips.push("تعداد معاملات هم‌زمان بالاست — ممکن است ریسک پرتفوی را افزایش دهد.");
  if (tips.length === 0) tips.push("نتایج در محدوده‌ی معقول است؛ می‌توانید با تغییر تدریجی پارامترها بهینه‌سازی بیشتری انجام دهید.");
  return tips;
}
