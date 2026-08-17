"use client";
import * as React from "react";
import { Moon, Sun, Activity, Wifi, WifiOff, Bot, TrendingUp, TrendingDown } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn, formatMoney } from "@/lib/utils";

export function AppHeader() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 5000,
  });

  const connected = stats?.mt5_connected ?? true;
  // Count of profiles that currently have ≥1 open position (across all bots).
  const profilesWithPositions = stats?.profiles_with_open_positions ?? 0;
  // Sum of unrealized P&L across all open positions of all profiles.
  const totalPnl = stats?.total_unrealized_pnl ?? 0;
  const currency = stats?.currency ?? "USD";

  // Sign-aware styling
  const pnlSign: "positive" | "negative" | "zero" =
    totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : "zero";

  // Compact money format — 1 decimal max, $ prefix when USD
  const pnlDisplay = (() => {
    const abs = Math.abs(totalPnl);
    const val = abs >= 1000 ? abs.toFixed(0) : abs.toFixed(1);
    return currency === "USD" ? `$${val}` : `${val} ${currency}`;
  })();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-3 sm:px-6">
        {/* Right side (RTL) — logo + title */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/90 to-emerald-700/90 text-white shadow-sm">
            <Activity className="size-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold tracking-tight">
              TrendPilot <span className="text-emerald-500">Web</span>
            </span>
            <span className="hidden text-[10px] text-muted-foreground sm:block">
              مدیریت ربات معامله‌گر MetaTrader 5
            </span>
          </div>
        </div>

        {/* Left side — header metrics + status badges + theme toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Profiles with open positions count */}
          <span className="header-stat header-stat--bots" title="تعداد پروفایل‌هایی که پوزیشن باز دارند">
            <Bot className="size-3.5" />
            <span className="header-stat-label hidden sm:inline">پروفایل با پوزیشن</span>
            <span className="header-stat-label sm:hidden">پوزیشن</span>
            <span className="header-stat-value">{profilesWithPositions}</span>
          </span>

          {/* Total P&L across all profiles */}
          <span
            className="header-stat header-stat--pnl"
            title="مجموع سود/زیان کل پوزیشن‌های بازِ همهٔ پروفایل‌ها"
          >
            {pnlSign === "positive" ? (
              <TrendingUp className="size-3.5" />
            ) : pnlSign === "negative" ? (
              <TrendingDown className="size-3.5" />
            ) : (
              <Activity className="size-3.5" />
            )}
            <span className="header-stat-label hidden sm:inline">سود/زیان کل</span>
            <span className="header-stat-label sm:hidden">P&amp;L</span>
            <span
              className={cn(
                "header-stat-value",
                `header-stat-value--${pnlSign}`
              )}
            >
              {pnlDisplay}
            </span>
          </span>

          {/* MT5 connection */}
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 px-2.5 py-1 font-medium",
              connected
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : "border-rose-500/40 bg-rose-500/10 text-rose-500"
            )}
          >
            {connected ? (
              <Wifi className="size-3.5" />
            ) : (
              <WifiOff className="size-3.5" />
            )}
            <span className="hidden sm:inline">
              {connected ? "MT5 متصل" : "MT5 قطع"}
            </span>
            <span className="sm:hidden">
              {connected ? "متصل" : "قطع"}
            </span>
          </Badge>

          {/* Account login — hidden on small screens */}
          {stats?.account_login && (
            <Badge variant="secondary" className="hidden gap-1 lg:inline-flex">
              <span className="text-muted-foreground">لاگین:</span>
              <span className="font-mono">{stats.account_login}</span>
            </Badge>
          )}

          {/* Theme toggle */}
          <Button
            variant="outline"
            size="icon"
            aria-label="تغییر تم"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
