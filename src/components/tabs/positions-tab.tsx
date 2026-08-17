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
  TableFooter,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatMoney, formatNumber, pnlColor } from "@/lib/utils";
import type { GroupedPositions, Position } from "@/lib/types";

export function PositionsTab() {
  const { data: grouped, isLoading } = useQuery({
    queryKey: ["positions-grouped"],
    queryFn: () => api.getPositionsGrouped(),
    refetchInterval: 4000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!grouped || Object.keys(grouped).length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex h-72 flex-col items-center justify-center gap-3">
          <Layers className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">هیچ پوزیشن بازی باز نیست.</p>
        </CardContent>
      </Card>
    );
  }

  const profileNames = Object.keys(grouped);
  const totalPositions = profileNames.reduce(
    (s, p) =>
      s +
      Object.values(grouped[p]).reduce((s2, arr) => s2 + arr.length, 0),
    0
  );

  return (
    <div className="space-y-3">
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-between py-3 text-xs">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-emerald-500" />
            <span>مجموع پوزیشن‌های باز:</span>
            <Badge variant="secondary" className="font-mono">{totalPositions}</Badge>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <RefreshCw className="size-3" />
            <span>به‌روزرسانی هر ۴ ثانیه</span>
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={profileNames} className="w-full space-y-3">
        {profileNames.map((profile) => (
          <ProfileGroup
            key={profile}
            profile={profile}
            data={grouped[profile]}
          />
        ))}
      </Accordion>
    </div>
  );
}

function ProfileGroup({
  profile,
  data,
}: {
  profile: string;
  data: GroupedPositions[string];
}) {
  const symbols = Object.keys(data);
  const allPos = symbols.flatMap((s) => data[s]);
  const totalProfit = allPos.reduce((s, p) => s + p.profit, 0);
  const totalMargin = allPos.reduce((s, p) => s + p.margin, 0);

  return (
    <Card className="border-border/60">
      <AccordionItem value={profile} className="border-b-0">
        <CardHeader className="border-b border-border/60 pb-3">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex w-full flex-wrap items-center justify-between gap-2 pe-3">
              <div className="flex items-center gap-2">
                <span className="size-2.5 animate-pulse rounded-full bg-emerald-500" />
                <CardTitle className="text-base font-mono">{profile}</CardTitle>
                <Badge variant="secondary" className="font-mono">
                  {allPos.length} پوزیشن
                </Badge>
                <Badge variant="outline" className="font-mono">
                  {symbols.length} نماد
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  مجموع مارجین: <span className="font-mono">{formatMoney(totalMargin, "USD")}</span>
                </span>
                <span className={cn("font-mono font-semibold", pnlColor(totalProfit))}>
                  سود کل: {totalProfit > 0 ? "+" : ""}{formatMoney(totalProfit, "USD")}
                </span>
              </div>
            </div>
          </AccordionTrigger>
        </CardHeader>
        <CardContent className="pt-2">
          <AccordionContent>
            <div className="space-y-4">
              {symbols.map((sym) => (
                <SymbolTable key={sym} symbol={sym} positions={data[sym]} />
              ))}
            </div>
          </AccordionContent>
        </CardContent>
      </AccordionItem>
    </Card>
  );
}

function SymbolTable({
  symbol,
  positions,
}: {
  symbol: string;
  positions: Position[];
}) {
  const sumProfit = positions.reduce((s, p) => s + p.profit, 0);
  return (
    <div className="rounded-lg border border-border/40 bg-card/40">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">{symbol}</span>
          <Badge variant="outline" className="font-mono text-[10px]">
            {positions.length} پوزیشن
          </Badge>
        </div>
        <span className={cn("font-mono text-sm font-medium", pnlColor(sumProfit))}>
          {sumProfit > 0 ? "+" : ""}{formatMoney(sumProfit, "USD")}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>تیکت</TableHead>
            <TableHead>نوع</TableHead>
            <TableHead>حجم</TableHead>
            <TableHead>قیمت باز شدن</TableHead>
            <TableHead>قیمت فعلی</TableHead>
            <TableHead>حد ضرر</TableHead>
            <TableHead>حد سود</TableHead>
            <TableHead>سود لحظه‌ای</TableHead>
            <TableHead>مارجین</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p) => (
            <TableRow key={p.ticket}>
              <TableCell className="font-mono text-xs">{p.ticket}</TableCell>
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
              <TableCell className="font-mono">{formatNumber(p.sl, 5)}</TableCell>
              <TableCell className="font-mono">{formatNumber(p.tp, 5)}</TableCell>
              <TableCell className={cn("font-mono font-medium", pnlColor(p.profit))}>
                {p.profit > 0 ? "+" : ""}{formatMoney(p.profit, "USD")}
              </TableCell>
              <TableCell className="font-mono">{formatMoney(p.margin, "USD")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={7} className="text-left text-xs text-muted-foreground">
              مجموع سود این نماد:
            </TableCell>
            <TableCell className={cn("font-mono font-medium", pnlColor(sumProfit))}>
              {sumProfit > 0 ? "+" : ""}{formatMoney(sumProfit, "USD")}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
