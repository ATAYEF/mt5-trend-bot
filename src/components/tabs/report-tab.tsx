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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn, formatDateTime, formatMoney, formatNumber, formatPercent, pnlColor } from "@/lib/utils";

export function ReportTab() {
  const qc = useQueryClient();
  const { data: profilesData } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => api.getProfiles(),
  });
  const profileNames = Object.keys(profilesData?.profiles ?? {});

  const [profileName, setProfileName] = React.useState<string>("");
  const [days, setDays] = React.useState(30);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  const [query, setQuery] = React.useState<{
    profileName: string;
    days: number;
    startDate?: string;
    endDate?: string;
  } | null>(null);

  React.useEffect(() => {
    if (!profileName && profileNames.length) setProfileName(profileNames[0]);
  }, [profileNames, profileName]);

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", query],
    queryFn: () =>
      api.getReport(
        query!.profileName,
        query!.days,
        query!.startDate,
        query!.endDate
      ),
    enabled: !!query,
  });

  function handleSubmit() {
    if (!profileName) {
      toast.error("یک پروفایل انتخاب کنید.");
      return;
    }
    if (days < 1 || days > 3650) {
      toast.error("تعداد روز باید بین ۱ و ۳۶۵۰ باشد.");
      return;
    }
    setQuery({
      profileName,
      days,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }

  return (
    <div className="space-y-3">
      {/* Form */}
      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">گزارش عملکرد</CardTitle>
          <CardDescription>دریافت گزارش عملکرد یک پروفایل در بازهٔ زمانی مشخص</CardDescription>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">پروفایل</Label>
              <Select value={profileName} onValueChange={setProfileName}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="انتخاب پروفایل…" />
                </SelectTrigger>
                <SelectContent>
                  {profileNames.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">تعداد روز اخیر</Label>
              <Input
                type="number"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value, 10) || 30)}
                min={1}
                max={3650}
                className="mt-1"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-xs">از تاریخ (اختیاری)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-xs">تا تاریخ (اختیاری)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
                dir="ltr"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={handleSubmit} disabled={isLoading || !profileName}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {isLoading ? "در حال دریافت…" : "دریافت گزارش"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!query && (
        <Card className="border-border/60">
          <CardContent className="flex h-72 flex-col items-center justify-center gap-3">
            <FileText className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              برای دریافت گزارش، یک پروفایل و بازهٔ زمانی انتخاب کنید.
            </p>
          </CardContent>
        </Card>
      )}

      {query && isLoading && (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {query && report && !isLoading && (
        <div className="space-y-3">
          {report.error ? (
            <Card className="border-rose-500/40 bg-rose-500/5">
              <CardContent className="py-6 text-sm text-rose-500">
                {report.error}
              </CardContent>
            </Card>
          ) : report.total_trades === 0 ? (
            <Card className="border-border/60">
              <CardContent className="flex h-72 flex-col items-center justify-center gap-3">
                <FileText className="size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  هیچ معامله‌ای در این بازه ثبت نشده است.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="سود کل"
                  value={`${report.total_profit > 0 ? "+" : ""}${formatMoney(report.total_profit, report.currency ?? "USD")}`}
                  tone={report.total_profit > 0 ? "pos" : "neg"}
                />
                <Stat label="تعداد معاملات" value={formatNumber(report.total_trades, 0)} />
                <Stat label="نرخ برد" value={formatPercent(report.win_rate, 1)} tone="pos" />
                <Stat
                  label="برد / باخت"
                  value={`${report.wins} / ${report.losses}`}
                />
              </div>

              {/* Account info card */}
              <Card className="border-border/60">
                <CardHeader className="border-b border-border/60 pb-3">
                  <CardTitle className="text-base">اطلاعات حساب</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 text-sm">
                    <Info label="Login" value={String(report.account_login ?? "—")} mono />
                    <Info label="Server" value={report.account_server ?? "—"} mono />
                    <Info label="Balance" value={formatMoney(report.balance ?? 0, report.currency ?? "USD")} mono />
                    <Info label="Equity" value={formatMoney(report.equity ?? 0, report.currency ?? "USD")} mono />
                    <Info label="Currency" value={report.currency ?? "—"} mono />
                  </div>
                </CardContent>
              </Card>

              {/* Trades table */}
              <Card className="border-border/60">
                <CardHeader className="border-b border-border/60 pb-3">
                  <CardTitle className="text-base">معاملات بسته‌شده</CardTitle>
                  <CardDescription>{report.trades.length} معامله ثبت شده در بازهٔ انتخابی</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="max-h-[60vh] overflow-y-auto scroll-y-rtl">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          <TableHead>تیکت</TableHead>
                          <TableHead>نماد</TableHead>
                          <TableHead>نوع</TableHead>
                          <TableHead>حجم</TableHead>
                          <TableHead>قیمت</TableHead>
                          <TableHead>سود</TableHead>
                          <TableHead>زمان</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.trades.map((t) => (
                          <TableRow key={t.ticket}>
                            <TableCell className="font-mono text-xs">{t.ticket}</TableCell>
                            <TableCell className="font-mono">{t.symbol}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  t.type.toLowerCase() === "buy"
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                                    : "border-rose-500/40 bg-rose-500/10 text-rose-500"
                                )}
                              >
                                {t.type.toLowerCase() === "buy" ? "خرید" : "فروش"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono">{t.volume}</TableCell>
                            <TableCell className="font-mono">{formatNumber(t.price, 5)}</TableCell>
                            <TableCell className={cn("font-mono font-medium", pnlColor(t.profit))}>
                              {t.profit > 0 ? "+" : ""}{formatMoney(t.profit, report.currency ?? "USD")}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{formatDateTime(t.time)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
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

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium", mono && "font-mono")}>{value}</span>
    </div>
  );
}
