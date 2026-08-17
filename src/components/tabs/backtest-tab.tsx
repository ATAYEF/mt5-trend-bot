"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play,
  Loader2,
  Download,
  FileSpreadsheet,
  Lightbulb,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  cn,
  formatMoney,
  formatNumber,
  formatPercent,
  pnlColor,
} from "@/lib/utils";
import { ChipInput } from "@/components/forms/fields/chip-input";
import { EquityCurve } from "@/components/charts/equity-curve";
import type { BacktestJob, BotConfig } from "@/lib/types";
import * as XLSX from "xlsx";

export function BacktestTab() {
  const { data: meta } = useQuery({
    queryKey: ["meta"],
    queryFn: () => api.getMeta(),
  });

  // ---- form state ----
  const [symbols, setSymbols] = React.useState<string[]>(["EURUSD", "GBPUSD", "XAUUSD"]);
  const [periodLabel, setPeriodLabel] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [customMode, setCustomMode] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [job, setJob] = React.useState<BacktestJob | null>(null);
  const [pollTick, setPollTick] = React.useState(0);

  // Poll for job state while running
  React.useEffect(() => {
    if (!jobId || !running) return;
    let cancelled = false;
    async function poll() {
      try {
        const j = await api.getBacktestJob(jobId);
        if (cancelled) return;
        setJob(j);
        setPollTick((t) => t + 1);
        if (j.status === "done" || j.status === "error") {
          setRunning(false);
          if (j.status === "done") {
            toast.success("بکتست با موفقیت تکمیل شد.");
          } else {
            toast.error("بکتست با خطا مواجه شد.", { description: j.errors?.join(" ") });
          }
        }
      } catch (e) {
        if (!cancelled) {
          toast.error("خطا در دریافت وضعیت بکتست.", { description: String(e) });
          setRunning(false);
        }
      }
    }
    const t = setInterval(poll, 1500);
    // also call immediately
    poll();
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobId, running]);

  // ---- submit ----
  async function handleRun() {
    if (symbols.length === 0) {
      toast.error("حداقل یک نماد انتخاب کنید.");
      return;
    }
    setJob(null);
    setJobId(null);
    setRunning(true);
    setPollTick(0);
    try {
      const config: BotConfig = {
        ...(meta?.default_config ?? api.getDefaultConfig()),
        SYMBOLS: symbols,
      };
      const r = await api.runBacktest({
        config,
        symbols,
        period_label: periodLabel || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setJobId(r.job_id);
      toast.info(`بکتست آغاز شد (job_id: ${r.job_id}).`);
    } catch (e) {
      setRunning(false);
      toast.error("شروع بکتست ناموفق بود.", { description: String(e) });
    }
  }

  // ---- export ----
  function buildExportData() {
    if (!job?.result) return null;
    return job.result.trades.map((t) => ({
      "تیکت": t.ticket,
      "نماد": t.symbol,
      "جهت": t.side === "buy" ? "خرید" : "فروش",
      "حجم": t.volume,
      "زمان باز شدن": t.open_time,
      "قیمت باز شدن": t.open_price,
      "حد ضرر": t.sl,
      "حد سود": t.tp,
      "زمان بسته شدن": t.close_time ?? "",
      "قیمت بسته شدن": t.close_price ?? "",
      "سود": t.profit,
      "کمیسیون": t.commission,
      "دلیل خروج": t.exit_reason_fa,
      "ATR": t.atr_at_open,
      "ADX": t.adx_at_open,
      "RSI": t.rsi_at_open,
      "روند HTF": t.htf_trend,
      "روش SL/TP": t.sl_tp_method,
      "مدت نگه‌داری (کندل)": t.bars_held,
    }));
  }

  function exportCSV() {
    const rows = buildExportData();
    if (!rows) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trades");
    XLSX.writeFile(wb, `trendpilot-backtest-${Date.now()}.csv`, { bookType: "csv" });
    toast.success("فایل CSV دانلود شد.");
  }

  function exportXLSX() {
    const rows = buildExportData();
    if (!rows) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trades");
    XLSX.writeFile(wb, `trendpilot-backtest-${Date.now()}.xlsx`, { bookType: "xlsx" });
    toast.success("فایل Excel دانلود شد.");
  }

  const result = job?.result;
  const advanced = result?.advanced ?? {};

  return (
    <div className="space-y-3">
      {/* Form */}
      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">اجرای بکتست</CardTitle>
          <CardDescription>
            انتخاب نمادها و بازهٔ زمانی برای ارزیابی استراتژی روی داده‌های تاریخی
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
            <div>
              <Label className="text-xs">نماد(ها)</Label>
              <div className="mt-1">
                <ChipInput
                  values={symbols}
                  onChange={setSymbols}
                  suggestions={["EURUSD","GBPUSD","USDJPY","XAUUSD","BTCUSD","USDCHF","AUDUSD"]}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">بازه زمانی</Label>
              <div className="mt-1 flex items-center gap-2">
                <Select
                  value={customMode ? "__custom__" : periodLabel}
                  onValueChange={(v) => {
                    if (v === "__custom__") {
                      setCustomMode(true);
                      setPeriodLabel("");
                    } else {
                      setCustomMode(false);
                      setPeriodLabel(v);
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="انتخاب بازه…" />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.backtest_periods?.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                    <SelectItem value="__custom__">بازه دلخواه…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {customMode && (
              <>
                <div>
                  <Label className="text-xs">از تاریخ</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-[160px]"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label className="text-xs">تا تاریخ</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-[160px]"
                    dir="ltr"
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={handleRun} disabled={running}>
              {running ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {running ? "در حال اجرا…" : "اجرای بکتست"}
            </Button>
            {running && (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500">
                <Loader2 className="size-3 animate-spin" />
                در حال اجرا… (پاسخ {pollTick})
              </Badge>
            )}
            {job?.status === "done" && (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-500">
                تکمیل شد
              </Badge>
            )}
            {job?.status === "error" && (
              <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-500">
                خطا
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Running state with no result yet */}
      {running && !result && (
        <Card className="border-border/60">
          <CardContent className="flex h-64 flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 animate-spin text-emerald-500" />
            <p className="text-sm text-muted-foreground">
              در حال اجرای بکتست… لطفاً منتظر بمانید.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Equity curve */}
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4 text-emerald-500" />
                منحنی اکوییتی
              </CardTitle>
              <CardDescription>روند رشد/افت سرمایه طی معاملات بکتست</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <EquityCurve trades={result.trades} startingBalance={10000} />
            </CardContent>
          </Card>

          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="سود کل" value={formatMoney(result.total_profit, "USD")} tone={result.total_profit > 0 ? "pos" : "neg"} />
            <Stat label="تعداد معاملات" value={formatNumber(result.total_trades, 0)} />
            <Stat label="نرخ برد" value={formatPercent(result.win_rate, 1)} tone="pos" />
            <Stat label="حداکثر افت سرمایه" value={formatPercent(result.max_dd_pct)} tone="neg" />
            <Stat label="حداکثر افت (مبلغ)" value={formatMoney(result.max_dd_money, "USD")} tone="neg" />
            <Stat label="Profit Factor" value={formatNumber(Number(advanced.profit_factor) || 0, 2)} />
          </div>

          {/* Per-symbol table */}
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-base">آمار به تفکیک نماد</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نماد</TableHead>
                    <TableHead>سود کل</TableHead>
                    <TableHead>تعداد معاملات</TableHead>
                    <TableHead>نرخ برد</TableHead>
                    <TableHead>Profit Factor</TableHead>
                    <TableHead>حداکثر افت</TableHead>
                    <TableHead>Expectancy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.per_symbol.map((s) => (
                    <TableRow key={s.symbol}>
                      <TableCell className="font-mono">{s.symbol}</TableCell>
                      <TableCell className={cn("font-mono", pnlColor(s.total_profit))}>
                        {s.total_profit > 0 ? "+" : ""}{formatMoney(s.total_profit, "USD")}
                      </TableCell>
                      <TableCell className="font-mono">{s.total_trades}</TableCell>
                      <TableCell className="font-mono">{formatPercent(s.win_rate, 1)}</TableCell>
                      <TableCell className="font-mono">{formatNumber(s.profit_factor, 2)}</TableCell>
                      <TableCell className="font-mono text-rose-500">{formatPercent(s.max_drawdown_percent)}</TableCell>
                      <TableCell className="font-mono">{formatMoney(s.expectancy, "USD")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Trades table */}
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/60 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">جدول معاملات</CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={exportCSV}>
                    <Download className="size-3.5" />
                    خروجی CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportXLSX}>
                    <FileSpreadsheet className="size-3.5" />
                    خروجی Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="max-h-[60vh] overflow-y-auto scroll-y-rtl">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>تیکت</TableHead>
                      <TableHead>نماد</TableHead>
                      <TableHead>جهت</TableHead>
                      <TableHead>حجم</TableHead>
                      <TableHead>زمان باز شدن</TableHead>
                      <TableHead>قیمت باز شدن</TableHead>
                      <TableHead>SL</TableHead>
                      <TableHead>TP</TableHead>
                      <TableHead>زمان بسته شدن</TableHead>
                      <TableHead>قیمت بسته شدن</TableHead>
                      <TableHead>سود</TableHead>
                      <TableHead>کمیسیون</TableHead>
                      <TableHead>دلیل خروج</TableHead>
                      <TableHead>ATR</TableHead>
                      <TableHead>ADX</TableHead>
                      <TableHead>RSI</TableHead>
                      <TableHead>روند HTF</TableHead>
                      <TableHead>روش SL/TP</TableHead>
                      <TableHead>مدت (کندل)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.trades.map((t) => (
                      <TableRow key={t.ticket}>
                        <TableCell className="font-mono text-xs">{t.ticket}</TableCell>
                        <TableCell className="font-mono">{t.symbol}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              t.side === "buy"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                                : "border-rose-500/40 bg-rose-500/10 text-rose-500"
                            )}
                          >
                            {t.side === "buy" ? "خرید" : "فروش"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{t.volume}</TableCell>
                        <TableCell className="font-mono text-xs">{t.open_time.replace("T"," ").replace(/\..+/, "")}</TableCell>
                        <TableCell className="font-mono">{formatNumber(t.open_price, 5)}</TableCell>
                        <TableCell className="font-mono">{formatNumber(t.sl, 5)}</TableCell>
                        <TableCell className="font-mono">{formatNumber(t.tp, 5)}</TableCell>
                        <TableCell className="font-mono text-xs">{t.close_time?.replace("T"," ").replace(/\..+/, "") ?? "—"}</TableCell>
                        <TableCell className="font-mono">{t.close_price ? formatNumber(t.close_price, 5) : "—"}</TableCell>
                        <TableCell className={cn("font-mono font-medium", pnlColor(t.profit))}>
                          {t.profit > 0 ? "+" : ""}{formatMoney(t.profit, "USD")}
                        </TableCell>
                        <TableCell className="font-mono">{formatMoney(t.commission, "USD")}</TableCell>
                        <TableCell>{t.exit_reason_fa}</TableCell>
                        <TableCell className="font-mono">{formatNumber(t.atr_at_open, 5)}</TableCell>
                        <TableCell className="font-mono">{formatNumber(t.adx_at_open, 1)}</TableCell>
                        <TableCell className="font-mono">{formatNumber(t.rsi_at_open, 1)}</TableCell>
                        <TableCell className="font-mono text-xs">{t.htf_trend}</TableCell>
                        <TableCell className="font-mono text-xs">{t.sl_tp_method}</TableCell>
                        <TableCell className="font-mono">{t.bars_held}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          {result.tips.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="border-b border-amber-500/20 pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-amber-500">
                  <Lightbulb className="size-4" />
                  توصیه‌های تحلیلی
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <ul className="space-y-1.5">
                  {result.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                      <span className="mt-1 text-amber-500">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
}) {
  return (
    <Card className="gap-1.5 border-border/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          tone === "pos" && "text-emerald-500",
          tone === "neg" && "text-rose-500"
        )}
      >
        {value}
      </div>
    </Card>
  );
}
