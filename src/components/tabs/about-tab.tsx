"use client";
import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  Globe,
  Server,
  Monitor,
  ArrowLeft,
  ArrowRight,
  Github,
  FileText,
} from "lucide-react";

export function AboutTab() {
  return (
    <div className="space-y-3">
      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/90 to-emerald-700/90 text-white">
                <Activity className="size-6" />
              </div>
              <div>
                <CardTitle className="text-xl">TrendPilot Web</CardTitle>
                <CardDescription>داشبورد مدیریت ربات‌های معاملاتی الگوریتمی MetaTrader 5</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono">
              نسخه ۱.۰.۰
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-3 space-y-3 text-sm leading-relaxed text-foreground/90">
          <p>
            TrendPilot Web یک رابط کاربری وب برای مدیریت ربات‌های معاملاتی الگوریتمی
            روی پلتفرم MetaTrader 5 است. این نرم‌افزار امکان پیکربندی استراتژی‌های
            روند، اسکلپ و خودکار، اجرای بکتست، مشاهدهٔ پوزیشن‌های لحظه‌ای، و گزارش‌گیری
            عملکرد را فراهم می‌کند.
          </p>
          <p>
            نکتهٔ مهم: <span className="text-amber-500">تمامی منطق معاملاتی روی سرور مجزای TrendPilot و در اِسترالی
            MT5 (به‌صورت کد MQL5) اجرا می‌شود.</span> رابط کاربری وب صرفاً یک پنل کنترلی
            برای پیکربندی، مانیتورینگ و گزارش‌گیری است و خودش هیچ تصمیم معاملاتی نمی‌گیرد.
          </p>
        </CardContent>
      </Card>

      {/* Architecture diagram */}
      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">معماری سیستم</CardTitle>
          <CardDescription>نمای کلی اجزای TrendPilot</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-center">
            {/* UI */}
            <ArchBlock
              title="رابط کاربری وب"
              subtitle="TrendPilot Web (Next.js)"
              icon={<Globe className="size-6" />}
              tone="emerald"
            />

            <ArchArrow label="REST API" />

            {/* Server */}
            <ArchBlock
              title="سرور TrendPilot"
              subtitle="Node.js + TypeScript"
              icon={<Server className="size-6" />}
              tone="amber"
            />

            <ArchArrow label="MT5 Bridge (MQL5 EA)" />

            {/* MT5 */}
            <ArchBlock
              title="ترمینال MetaTrader 5"
              subtitle="MetaTrader 5 + EA"
              icon={<Monitor className="size-6" />}
              tone="rose"
            />
          </div>

          <Separator className="my-6 bg-border/40" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TechCard
              title="رابط کاربری وب"
              items={[
                "Next.js 16 + TypeScript",
                "Tailwind CSS 4 + shadcn/ui",
                "TanStack Query (polling)",
                "Recharts برای نمودارها",
                "Vazirmatn (فارسی، RTL)",
              ]}
            />
            <TechCard
              title="سرور TrendPilot"
              items={[
                "Node.js + TypeScript",
                "MetaTrader5 Python API",
                "Lock برای مدیریت state",
                "REST API + WebSocket",
                "Export Excel/CSV",
              ]}
            />
            <TechCard
              title="پل MT5"
              items={[
                "EA نوشته‌شده با MQL5",
                "ارسال کندل‌ها به سرور",
                "دریافت تصمیم (buy/sell/hold)",
                "اجرای order واقعی",
                "Heartbeat زنده",
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Mode info */}
      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base">حالت اجرای فعلی</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <ModeInfo />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            راهنمای سریع
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2 text-sm text-foreground/90">
          <p><span className="font-medium text-emerald-500">داشبورد:</span> دید کلی از موجودی، اکوییتی، ربات‌های فعال و پوزیشن‌های باز.</p>
          <p><span className="font-medium text-emerald-500">تنظیمات:</span> ساخت/ویرایش پروفایل‌ها و پیکربندی استراتژی، ریسک و خروج.</p>
          <p><span className="font-medium text-emerald-500">پوزیشن‌ها:</span> مشاهدهٔ پوزیشن‌های باز به تفکیک پروفایل و نماد.</p>
          <p><span className="font-medium text-emerald-500">بکتست:</span> ارزیابی استراتژی روی داده‌های تاریخی همراه با نمودار اکوییتی.</p>
          <p><span className="font-medium text-emerald-500">گزارش:</span> گزارش عملکرد یک پروفایل در بازهٔ زمانی مشخص.</p>
          <p><span className="font-medium text-emerald-500">لاگ:</span> مشاهدهٔ زندهٔ لاگ‌های سرور و ربات‌ها.</p>
          <p><span className="font-medium text-emerald-500">موتور هوش مصنوعی:</span> آموزش مدل پیش‌بینی جهت کندل بعدی.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ArchBlock({
  title,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "rose";
}) {
  const toneCls = {
    emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    rose: "border-rose-500/40 bg-rose-500/10 text-rose-500",
  }[tone];
  return (
    <div className={`flex w-full max-w-xs flex-col items-center gap-2 rounded-xl border ${toneCls} p-4`}>
      <div className="flex size-10 items-center justify-center rounded-lg bg-card/60">
        {icon}
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function ArchArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <ArrowLeft className="size-5 text-muted-foreground rotate-90 md:rotate-0" />
      <ArrowRight className="size-5 text-muted-foreground rotate-90 md:rotate-0" />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function TechCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
            <span className="mt-0.5 text-emerald-500">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeInfo() {
  const [mode, setMode] = React.useState<string>("mock");
  React.useEffect(() => {
    setMode(api.isMock ? "mock" : "real");
  }, []);
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Badge
        variant="outline"
        className={
          mode === "mock"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
        }
      >
        {mode === "mock" ? "حالت موک (دادهٔ شبیه‌سازی‌شده)" : "حالت واقعی (API متصل)"}
      </Badge>
      <span className="text-xs text-muted-foreground">
        {mode === "mock"
          ? "در این حالت، رابط کاربری از دادهٔ شبیه‌سازی‌شده استفاده می‌کند. برای اتصال به سرور واقعی، متغیر NEXT_PUBLIC_API_BASE_URL را تنظیم کنید."
          : `متصل به: ${process.env.NEXT_PUBLIC_API_BASE_URL}`}
      </span>
    </div>
  );
}

// ModeInfo uses api imported at top of file
