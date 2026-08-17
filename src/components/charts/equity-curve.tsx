"use client";
import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import type { BacktestTrade } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface EquityCurveProps {
  trades: BacktestTrade[];
  startingBalance?: number;
}

interface Point {
  idx: number;
  equity: number;
  profit: number;
  cumProfit: number;
  symbol: string;
}

export function EquityCurve({ trades, startingBalance = 10000 }: EquityCurveProps) {
  const data: Point[] = React.useMemo(() => {
    // Build cumulative-profit array without reassigning inside .map
    const out: Point[] = [];
    let cum = 0;
    for (let i = 0; i < trades.length; i++) {
      cum += trades[i].profit;
      out.push({
        idx: i + 1,
        equity: Number((startingBalance + cum).toFixed(2)),
        profit: trades[i].profit,
        cumProfit: Number(cum.toFixed(2)),
        symbol: trades[i].symbol,
      });
    }
    return out;
  }, [trades, startingBalance]);

  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        داده‌ای برای نمایش موجود نیست.
      </div>
    );
  }

  return (
    <div className="h-72 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
          <XAxis
            dataKey="idx"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "شماره معامله",
              position: "insideBottom",
              offset: -2,
              style: { fontSize: 11, fill: "var(--muted-foreground)" },
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={70}
            tickFormatter={(v) => formatNumber(Number(v), 0)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--card-foreground)",
            }}
            labelFormatter={(v) => `معامله #${v}`}
            formatter={(v: number, name: string) => {
              if (name === "equity") return [`$${formatNumber(v, 2)}`, "اکوییتی"];
              return [formatNumber(Number(v), 2), name];
            }}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#eqGrad)"
            name="equity"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
