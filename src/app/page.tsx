"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  Settings,
  Layers,
  FlaskConical,
  FileText,
  ScrollText,
  BrainCircuit,
  Info,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { DashboardTab } from "@/components/tabs/dashboard-tab";
import { SettingsTab } from "@/components/tabs/settings-tab";
import { PositionsTab } from "@/components/tabs/positions-tab";
import { BacktestTab } from "@/components/tabs/backtest-tab";
import { ReportTab } from "@/components/tabs/report-tab";
import { LogTab } from "@/components/tabs/log-tab";
import { AIEngineTab } from "@/components/tabs/ai-engine-tab";
import { AboutTab } from "@/components/tabs/about-tab";

interface TabDef {
  value: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

const TABS: TabDef[] = [
  { value: "dashboard", label: "داشبورد", icon: <LayoutDashboard className="size-4" />, component: <DashboardTab /> },
  { value: "settings", label: "تنظیمات", icon: <Settings className="size-4" />, component: <SettingsTab /> },
  { value: "positions", label: "پوزیشن‌ها", icon: <Layers className="size-4" />, component: <PositionsTab /> },
  { value: "backtest", label: "بکتست", icon: <FlaskConical className="size-4" />, component: <BacktestTab /> },
  { value: "report", label: "گزارش", icon: <FileText className="size-4" />, component: <ReportTab /> },
  { value: "log", label: "لاگ", icon: <ScrollText className="size-4" />, component: <LogTab /> },
  { value: "ai-engine", label: "موتور هوش مصنوعی", icon: <BrainCircuit className="size-4" />, component: <AIEngineTab /> },
  { value: "about", label: "درباره", icon: <Info className="size-4" />, component: <AboutTab /> },
];

export default function Home() {
  const [active, setActive] = React.useState("dashboard");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <Tabs value={active} onValueChange={setActive} className="gap-3">
          <TabsList
            aria-label="زبانه‌های اصلی"
            className="flex h-auto w-full flex-wrap justify-start gap-1 bg-card/60 p-1.5 rounded-xl border border-border/60"
          >
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="h-9 gap-1.5 px-3 text-xs sm:text-sm"
              >
                {t.icon}
                <span>{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {mounted &&
            TABS.map((t) => (
              <TabsContent key={t.value} value={t.value} className="mt-3 focus-visible:outline-none">
                {t.component}
              </TabsContent>
            ))}
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border/60 bg-card/40">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-3 py-3 text-xs text-muted-foreground sm:px-6">
          <span>
            TrendPilot Web © ۱۴۰۵ — داشبورد مدیریت ربات معامله‌گر MetaTrader 5
          </span>
          <span className="font-mono">v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
