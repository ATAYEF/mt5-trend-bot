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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wallet,
  Activity,
  Bot,
  Layers,
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  cn,
  formatMoney,
  formatNumber,
  pnlColor,
} from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Position } from "@/lib/types";

export function DashboardTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 5000,
  });

  const { data: grouped } = useQuery({
    queryKey: ["positions-grouped"],
    queryFn: () => api.getPositionsGrouped(),
    refetchInterval: 5000,
  });

  // Flatten top positions for the overview
  const topPositions = React.useMemo(() => {
    if (!grouped) return [];
    const all: { p: Position; profile: string }[] = [];
    for (const [prof, syms] of Object.entries(grouped)) {
      for (const positions of Object.values(syms)) {
        for (const p of positions) all.push({ p, profile: prof });
      }
    }
    return all
      .sort((a, b) => Math.abs(b.p.profit) - Math.abs(a.p.profit))
      .slice(0, 5);
  }, [grouped]);

  const dailyTone = (stats?.daily_pnl ?? 0) > 0 ? "up" : "down";

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="موجودی"
          value={formatMoney(stats.balance, stats.currency)}
          icon={<Wallet className="size-4" />}
          tone="neutral"
        />
        <StatCard
          title="اکوییتی"
          value={formatMoney(stats.equity, stats.currency)}
          icon={<Activity className="size-4" />}
          tone="neutral"
        />
        <StatCard
          title="ربات‌های در حال اجرا"
          value={formatNumber(stats.running_bots_count, 0)}
          icon={<Bot className="size-4" />}
          tone="neutral"
        />
        <StatCard
          title="پوزیشن‌های باز"
          value={formatNumber(stats.open_positions_count, 0)}
          icon={<Layers className="size-4" />}
          tone="neutral"
        />
        <StatCard
          title="سود/زیان روز جاری"
          value={`${stats.daily_pnl > 0 ? "+" : ""}${formatMoney(stats.daily_pnl, stats.currency)}`}
          icon={dailyTone === "up" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          tone={dailyTone === "up" ? "pos" : "neg"}
        />
        <StatCard
          title="وضعیت اتصال MT5"
          value={stats.mt5_connected ? "متصل" : "قطع"}
          icon={stats.mt5_connected ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
          tone={stats.mt5_connected ? "pos" : "neg"}
          subtitle={stats.account_server ?? undefined}
        />
      </div>

      {/* Account info bar */}
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center gap-3 py-4 text-xs">
          <span className="text-muted-foreground">اطلاعات حساب:</span>
          <Badge variant="secondary" className="font-mono">
            Login: {stats.account_login ?? "—"}
          </Badge>
          <Badge variant="secondary" className="font-mono">
            Server: {stats.account_server ?? "—"}
          </Badge>
          <Badge variant="secondary" className="font-mono">
            Leverage: 1:{stats.leverage ?? 100}
          </Badge>
          <Badge variant="outline" className="font-mono">
            {stats.currency ?? "USD"}
          </Badge>
          <div className="ms-auto flex items-center gap-1 text-muted-foreground">
            <RefreshCw className="size-3" />
            <span>به‌روزرسانی هر ۵ ثانیه</span>
          </div>
        </CardContent>
      </Card>

      {/* Positions overview */}
      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">نمای کلی پوزیشن‌ها</CardTitle>
          <CardDescription>
            ۵ پوزیشن برتر بر اساس سود/زیان لحظه‌ای
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {topPositions.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              هیچ پوزیشن بازی باز نیست.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>پروفایل</TableHead>
                  <TableHead>نماد</TableHead>
                  <TableHead>نوع</TableHead>
                  <TableHead>حجم</TableHead>
                  <TableHead>قیمت باز شدن</TableHead>
                  <TableHead>قیمت فعلی</TableHead>
                  <TableHead>سود لحظه‌ای</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPositions.map(({ p, profile }) => (
                  <TableRow key={p.ticket}>
                    <TableCell className="text-xs">{profile}</TableCell>
                    <TableCell className="font-mono">{p.symbol}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          p.type === 0
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-500"
                        )}
                      >
                        {p.type === 0 ? "خرید" : "فروش"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{p.volume}</TableCell>
                    <TableCell className="font-mono">{formatNumber(p.price_open, 5)}</TableCell>
                    <TableCell className="font-mono">{formatNumber(p.price_current, 5)}</TableCell>
                    <TableCell className={cn("font-mono font-medium", pnlColor(p.profit))}>
                      {p.profit > 0 ? "+" : ""}
                      {formatMoney(p.profit, stats.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone?: "pos" | "neg" | "neutral";
  subtitle?: string;
}

function StatCard({ title, value, icon, tone = "neutral", subtitle }: StatCardProps) {
  return (
    <Card className="gap-2 border-border/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{title}</span>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-md",
            tone === "pos" && "bg-emerald-500/10 text-emerald-500",
            tone === "neg" && "bg-rose-500/10 text-rose-500",
            tone === "neutral" && "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </span>
      </div>
      <div
        className={cn(
          "font-mono text-lg font-semibold tabular-nums",
          tone === "pos" && "text-emerald-500",
          tone === "neg" && "text-rose-500"
        )}
      >
        {value}
      </div>
      {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
    </Card>
  );
}
