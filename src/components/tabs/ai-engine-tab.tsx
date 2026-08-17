"use client";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Database,
  Target,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn, formatDateTime, formatPercent } from "@/lib/utils";

const AI_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "ETHUSD", "AUDUSD", "USDCHF"];

export function AIEngineTab() {
  const qc = useQueryClient();
  const { data: meta } = useQuery({
    queryKey: ["meta"],
    queryFn: () => api.getMeta(),
  });

  const [symbol, setSymbol] = React.useState("EURUSD");
  const [timeframe, setTimeframe] = React.useState("15");
  const [bars, setBars] = React.useState(5000);
  const [training, setTraining] = React.useState(false);
  const [trainingProgress, setTrainingProgress] = React.useState(0);

  // Status query
  const { data: status, isLoading } = useQuery({
    queryKey: ["ai-status", symbol, timeframe],
    queryFn: () => api.getAIEngineStatus(symbol, parseInt(timeframe, 10)),
    refetchInterval: training ? 1500 : 15000,
  });

  // Tick the mock store when training
  React.useEffect(() => {
    if (!training) return;
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + Math.random() * 20 + 10);
      setTrainingProgress(p);
      const s = api.tickAIEngine();
      if (!s.is_training) {
        setTraining(false);
        setTrainingProgress(100);
        clearInterval(iv);
        qc.invalidateQueries({ queryKey: ["ai-status", symbol, timeframe] });
        if (s.trained) {
          toast.success(`آموزش مدل با دقت ${formatPercent((s.accuracy ?? 0) * 100, 2)} تکمیل شد.`);
        }
      }
    }, 1500);
    return () => clearInterval(iv);
  }, [training, qc, symbol, timeframe]);

  // Reset progress when starting training
  async function handleTrain() {
    if (!symbol || !timeframe) {
      toast.error("نماد و تایمفریم را انتخاب کنید.");
      return;
    }
    if (bars < 100 || bars > 100000) {
      toast.error("تعداد کندل باید بین ۱۰۰ و ۱۰۰٬۰۰۰ باشد.");
      return;
    }
    setTraining(true);
    setTrainingProgress(0);
    try {
      await api.trainAIEngine({
        symbol,
        timeframe: parseInt(timeframe, 10),
        bars,
      });
      toast.info("آموزش مدل آغاز شد. این فرآیند ممکن است چند لحظه طول بکشد.");
    } catch (e) {
      setTraining(false);
      toast.error("شروع آموزش ناموفق بود.", { description: String(e) });
    }
  }

  const timeframeOptions = (meta?.timeframes ?? [1, 5, 15, 30, 60, 240, 1440]).map((t) => ({
    value: String(t),
    label:
      t >= 1440
        ? `${t / 1440} روزه (D1)`
        : t >= 60
        ? `${t / 60} ساعته (H${t / 60})`
        : `${t} دقیقه (M${t})`,
  }));

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
      {/* Status card */}
      <div className="space-y-3">
        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="size-5 text-emerald-500" />
              وضعیت موتور هوش مصنوعی
            </CardTitle>
            <CardDescription>
              مدل یاد‌گیری ماشین پیش‌بینی جهت کندل بعدی برای نماد و تایمفریم انتخابی
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <InfoCell
                    label="وضعیت آموزش"
                    value={status?.trained ? "آموزش‌دیده" : status?.is_training ? "در حال آموزش" : "آموزش ندیده"}
                    icon={status?.trained ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                    tone={status?.trained ? "pos" : status?.is_training ? "warn" : "neg"}
                  />
                  <InfoCell label="نماد" value={status?.symbol ?? "—"} icon={<Database className="size-4" />} mono />
                  <InfoCell
                    label="تایمفریم"
                    value={status?.timeframe ? `M${status.timeframe}` : "—"}
                    icon={<Clock className="size-4" />}
                    mono
                  />
                  <InfoCell
                    label="تعداد نمونه‌ها"
                    value={status?.samples ? String(status.samples) : "—"}
                    icon={<Database className="size-4" />}
                    mono
                  />
                  <InfoCell
                    label="دقت"
                    value={status?.accuracy != null ? formatPercent(status.accuracy * 100, 2) : "—"}
                    icon={<Target className="size-4" />}
                    tone={status?.accuracy != null ? (status.accuracy > 0.55 ? "pos" : "warn") : "neutral"}
                  />
                </div>

                {status?.trained_at && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    آخرین آموزش: <span className="font-mono">{formatDateTime(status.trained_at)}</span>
                  </div>
                )}

                {/* Accuracy gauge when trained */}
                {status?.trained && status.accuracy != null && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">دقت مدل</span>
                      <span className="font-mono font-semibold text-emerald-500">
                        {formatPercent(status.accuracy * 100, 2)}
                      </span>
                    </div>
                    <Progress
                      value={status.accuracy * 100}
                      className="h-3 bg-muted"
                    />
                  </div>
                )}

                {/* Training progress */}
                {training && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-500">در حال آموزش مدل…</span>
                      <span className="font-mono">{Math.round(trainingProgress)}%</span>
                    </div>
                    <Progress value={trainingProgress} className="h-3 bg-muted" />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* About the AI engine */}
        <Card className="border-border/60 bg-muted/30">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-emerald-500" />
              موتور هوش مصنوعی چیست؟
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2 text-sm leading-relaxed text-foreground/90">
            <p>
              موتور هوش مصنوعی TrendPilot از ویژگی‌های استخراج‌شده از داده‌های قیمتی برای
              پیش‌بینی جهت حرکت کندل بعدی استفاده می‌کند. ویژگی‌های کلیدی:
            </p>
            <ul className="space-y-1.5 ps-4">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-emerald-500">•</span>
                <span>فاصلهٔ قیمت فعلی از EMA‌های کوتاه و بلندمدت</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-emerald-500">•</span>
                <span>اندیکاتور RSI (قدرت نسبی) و ATR (نوسان)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-emerald-500">•</span>
                <span>عرض باندهای بولینگر (Bollinger Band width)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-emerald-500">•</span>
                <span>نسبت بدنهٔ کندل به سایه‌ها (Candle body ratio)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-emerald-500">•</span>
                <span>الگوی کندل‌های اخیر (Last N candles pattern)</span>
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              مدل از نوع Logistic Regression یا یک شبکهٔ عصبی کوچک است و خروجی آن در MT5 bridge
              برای تصمیم‌گیری در کنار استراتژی اصلی به‌کار می‌رود.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Training form */}
      <Card className="border-border/60 h-fit">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="size-4 text-emerald-500" />
            آموزش مدل جدید
          </CardTitle>
          <CardDescription>
            شروع آموزش مدل برای یک نماد و تایمفریم مشخص
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          <div>
            <Label className="text-xs">نماد</Label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_SYMBOLS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">تایمفریم</Label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeframeOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">تعداد کندل (نمونهٔ آموزشی)</Label>
            <Input
              type="number"
              value={bars}
              onChange={(e) => setBars(parseInt(e.target.value, 10) || 0)}
              min={100}
              max={100000}
              className="mt-1 font-mono"
              dir="ltr"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              پیشنهادی: ۵٬۰۰۰ تا ۲۰٬۰۰۰ کندل
            </p>
          </div>

          <Button
            onClick={handleTrain}
            disabled={training}
            className="w-full"
          >
            {training ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {training ? "در حال آموزش…" : "آموزش مدل"}
          </Button>

          {status?.trained && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-500 font-medium mb-1">
                <CheckCircle2 className="size-4" />
                مدل آموزش‌دیده موجود است
              </div>
              <p className="text-foreground/80">
                برای بهبود دقت یا تطبیق با تنظیمات جدید، می‌توانید دوباره آموزش دهید.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCell({
  label,
  value,
  icon,
  tone = "neutral",
  mono,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "pos" | "neg" | "warn" | "neutral";
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded",
            tone === "pos" && "text-emerald-500 bg-emerald-500/10",
            tone === "neg" && "text-rose-500 bg-rose-500/10",
            tone === "warn" && "text-amber-500 bg-amber-500/10",
            tone === "neutral" && "text-muted-foreground bg-muted"
          )}
        >
          {icon}
        </span>
      </div>
      <span
        className={cn(
          "text-sm font-medium",
          mono && "font-mono",
          tone === "pos" && "text-emerald-500",
          tone === "neg" && "text-rose-500",
          tone === "warn" && "text-amber-500"
        )}
      >
        {value}
      </span>
    </div>
  );
}
