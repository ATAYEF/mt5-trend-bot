"use client";
import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Sparkles,
  Hash,
  Wallet,
  Cable,
  CandlestickChart,
  Gauge,
  Waves,
  LogOut,
  Shield,
  TrendingUp,
  DoorOpen,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BotConfig, RiskPreset } from "@/lib/types";
import { NumberField } from "./fields/number-field";
import { SwitchField } from "./fields/switch-field";
import { SelectField, type SelectOption } from "./fields/select-field";
import { TextField } from "./fields/text-field";
import { ChipInput } from "./fields/chip-input";
import { cn } from "@/lib/utils";

interface BotConfigFormProps {
  value: BotConfig;
  onChange: (v: BotConfig) => void;
}

// ----------------------------------------------------------------------------
// Subsection wrapper — title with accent bar on the right (RTL) + description
// ----------------------------------------------------------------------------
function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-col">
        <span className="form-subsection-title">{title}</span>
        {desc && <span className="form-subsection-desc">{desc}</span>}
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Section definition data — title + subtitle + icon for each accordion section
// ----------------------------------------------------------------------------
interface SectionDef {
  num: string;
  value: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}

const SECTIONS: SectionDef[] = [
  { num: "۱", value: "mt5",         title: "اتصال MT5",                   subtitle: "اطلاعات حساب و سرور MetaTrader 5",            icon: Cable },
  { num: "۲", value: "sym",         title: "نمادها و تایم فریم",          subtitle: "انتخاب نمادهای معاملاتی و بازهٔ زمانی",      icon: CandlestickChart },
  { num: "۳", value: "regime",      title: "فیلتر رژیم بازار",            subtitle: "تشخیص روند در برابر رنج برای حالت خودکار",   icon: Gauge },
  { num: "۴", value: "scalp-entry", title: "ورود اسکلپ (Mean Reversion)", subtitle: "شرط‌های ورود بر اساس باند بولینگر و RSI",     icon: Waves },
  { num: "۵", value: "scalp-exit",  title: "خروج اسکلپ",                  subtitle: "تنظیمات حد ضرر/سود، ساختار و فیلتر سشن",      icon: LogOut },
  { num: "۶", value: "risk",        title: "مدیریت ریسک",                 subtitle: "حجم معامله، حد ضرر و حد سود",                 icon: Shield },
  { num: "۷", value: "trend-entry", title: "ورود روند (Trend Following)", subtitle: "آستانه ADX، cooldown، تأیید HTF",            icon: TrendingUp },
  { num: "۸", value: "exit",        title: "خروج",                        subtitle: "Trailing Stop، مدت معامله، تعطیلی آخر هفته", icon: DoorOpen },
  { num: "۹", value: "misc",        title: "ایمنی معاملات",               subtitle: "فقط حساب دمو، پروفایل و Magic Number",        icon: ShieldCheck },
];

export function BotConfigForm({ value, onChange }: BotConfigFormProps) {
  const qc = useQueryClient();

  const { data: meta } = useQuery({
    queryKey: ["meta"],
    queryFn: () => api.getMeta(),
  });

  function update<K extends keyof BotConfig>(key: K, v: BotConfig[K]) {
    onChange({ ...value, [key]: v });
  }

  const timeframeOptions: SelectOption[] = (meta?.timeframes ?? [1, 5, 15, 30, 60, 240, 1440]).map(
    (t) => ({
      value: String(t),
      label:
        t >= 1440
          ? `${t / 1440} روزه (D1)`
          : t >= 60
          ? `${t / 60} ساعته (H${t / 60})`
          : `${t} دقیقه (M${t})`,
    })
  );

  const strategyModeOptions: SelectOption[] =
    meta?.strategy_modes?.map((s) => ({ value: s, label: s })) ?? [];

  const riskProfileOptions: SelectOption[] = meta
    ? Object.keys(meta.risk_profiles).map((k) => ({ value: k, label: k }))
    : [];

  function applyRiskProfile(name: string) {
    if (!meta) return;
    const preset: RiskPreset | null | undefined = meta.risk_profiles[name];
    if (!preset) {
      toast.error("پروفایل ریسک یافت نشد.");
      return;
    }
    onChange({
      ...value,
      RISK_TOLERANCE_PROFILE: name,
      RISK_PERCENT_PER_TRADE: preset.RISK_PERCENT_PER_TRADE,
      DONCHIAN_PERIOD: preset.DONCHIAN_PERIOD,
      DONCHIAN_ATR_MULTIPLIER: preset.DONCHIAN_ATR_MULTIPLIER,
      ADX_TREND_THRESHOLD: preset.ADX_TREND_THRESHOLD,
      COOLDOWN_BARS: preset.COOLDOWN_BARS,
      MAX_CONCURRENT_TRADES: preset.MAX_CONCURRENT_TRADES,
      MAX_TOTAL_RISK_PERCENT: preset.MAX_TOTAL_RISK_PERCENT,
      ENABLE_TRAILING_STOP: preset.ENABLE_TRAILING_STOP,
      TRAILING_ACTIVATION_ATR_MULTIPLIER: preset.TRAILING_ACTIVATION_ATR_MULTIPLIER,
      TRAILING_DISTANCE_ATR_MULTIPLIER: preset.TRAILING_DISTANCE_ATR_MULTIPLIER,
    });
    toast.success(`پروفایل ریسک «${name}» اعمال شد.`);
  }

  const tpModeOptions: SelectOption[] = [
    { value: "atr", label: "ATR" },
    { value: "structure", label: "ساختار (Structure)" },
    { value: "rr", label: "نسبت ریسک/بازده" },
  ];

  const htfOptions: SelectOption[] = [
    { value: "", label: "غیرفعال" },
    { value: "60", label: "۱ ساعته (H1)" },
    { value: "240", label: "۴ ساعته (H4)" },
    { value: "1440", label: "روزانه (D1)" },
  ];

  // Map SECTIONS to their content
  const sectionContent: Record<string, React.ReactNode> = {
    mt5: (
      <Section title="اطلاعات اتصال به ترمینال MetaTrader 5" desc="شماره حساب، رمز عبور و آدرس سرور">
        <NumberField
          label="MT5 Login (شماره حساب)"
          value={value.MT5_LOGIN}
          onChange={(v) => update("MT5_LOGIN", v)}
          description="شماره حساب معاملاتی MT5"
        />
        <TextField
          label="MT5 Password (رمز عبور)"
          type="password"
          value={value.MT5_PASSWORD}
          onChange={(v) => update("MT5_PASSWORD", v)}
          mono
          description="رمز عبور حساب (Investor یا اصلی)"
        />
        <TextField
          label="MT5 Server (سرور)"
          value={value.MT5_SERVER}
          onChange={(v) => update("MT5_SERVER", v)}
          mono
          placeholder="MetaQuotes-Demo"
        />
        <TextField
          label="MT5 Path (مسیر اجرا)"
          value={value.MT5_PATH ?? ""}
          onChange={(v) => update("MT5_PATH", v || null)}
          mono
          placeholder="خالی = خودکار"
          description="مسیر فایل terminal64.exe (اختیاری)"
        />
      </Section>
    ),
    sym: (
      <Section title="نمادهای معاملاتی و تایمفریم" desc="انتخاب نمادها، بازهٔ زمانی و حالت استراتژی">
        <div className="sm:col-span-2 lg:col-span-3">
          <ChipInput
            label="نمادها (Symbols)"
            values={value.SYMBOLS}
            onChange={(v) => update("SYMBOLS", v)}
            suggestions={["EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","NZDUSD","USDCAD","XAUUSD","XAGUSD","BTCUSD","ETHUSD"]}
            description="نمادهای معاملاتی که ربات روی آن‌ها سیگنال می‌گیرد"
          />
        </div>
        <SelectField
          label="تایمفریم (Timeframe)"
          value={String(value.TIMEFRAME)}
          onChange={(v) => update("TIMEFRAME", parseInt(v, 10))}
          options={timeframeOptions}
        />
        <SelectField
          label="حالت استراتژی"
          value={value.STRATEGY_MODE}
          onChange={(v) => update("STRATEGY_MODE", v)}
          options={strategyModeOptions}
          description="روند / اسکلپ / خودکار"
        />
      </Section>
    ),
    regime: (
      <Section title="تعیین رژیم بازار برای استراتژی خودکار" desc="ADX پایین + شیب کم باند + کارایی پایین Kaufman = بازار رنج">
        <NumberField label="حداکثر ADX" value={value.REGIME_ADX_MAX} onChange={(v) => update("REGIME_ADX_MAX", v)} description="ADX بالاتر از این مقدار = روند قوی" />
        <NumberField label="lookback شیب BB" value={value.REGIME_BB_SLOPE_LOOKBACK} onChange={(v) => update("REGIME_BB_SLOPE_LOOKBACK", v)} />
        <NumberField label="حداکثر شیب BB (%)" value={value.REGIME_BB_SLOPE_MAX_PERCENT} onChange={(v) => update("REGIME_BB_SLOPE_MAX_PERCENT", v)} step={0.01} />
        <NumberField label="lookback کارایی" value={value.REGIME_EFFICIENCY_LOOKBACK} onChange={(v) => update("REGIME_EFFICIENCY_LOOKBACK", v)} />
        <NumberField label="حداکثر کارایی" value={value.REGIME_EFFICIENCY_MAX} onChange={(v) => update("REGIME_EFFICIENCY_MAX", v)} step={0.01} />
        <NumberField label="lookback ATR" value={value.REGIME_ATR_LOOKBACK} onChange={(v) => update("REGIME_ATR_LOOKBACK", v)} />
        <NumberField label="حداقل صدک ATR" value={value.REGIME_ATR_MIN_PERCENTILE} onChange={(v) => update("REGIME_ATR_MIN_PERCENTILE", v)} description="حداقل صدک ATR اخیر" />
        <NumberField label="حداکثر صدک ATR" value={value.REGIME_ATR_MAX_PERCENTILE} onChange={(v) => update("REGIME_ATR_MAX_PERCENTILE", v)} description="حداکثر صدک ATR اخیر" />
      </Section>
    ),
    "scalp-entry": (
      <Section title="شرط‌های ورود در حالت اسکلپ" desc="استراتژی برگشت از حد (Mean-Reversion)">
        <NumberField label="دوره BB" value={value.SCALP_BB_PERIOD} onChange={(v) => update("SCALP_BB_PERIOD", v)} />
        <NumberField label="انحراف استاندارد BB" value={value.SCALP_BB_STD} onChange={(v) => update("SCALP_BB_STD", v)} step={0.1} />
        <NumberField label="دوره RSI" value={value.SCALP_RSI_PERIOD} onChange={(v) => update("SCALP_RSI_PERIOD", v)} />
        <NumberField label="RSI اشباع فروش" value={value.SCALP_RSI_OVERSOLD} onChange={(v) => update("SCALP_RSI_OVERSOLD", v)} />
        <NumberField label="RSI اشباع خرید" value={value.SCALP_RSI_OVERBOUGHT} onChange={(v) => update("SCALP_RSI_OVERBOUGHT", v)} />
        <NumberField label="نسبت سایه ریجکشن" value={value.SCALP_REJECTION_WICK_RATIO} onChange={(v) => update("SCALP_REJECTION_WICK_RATIO", v)} step={0.05} />
        <SwitchField label="نیازمند ریجکشن (Rejection)" checked={value.SCALP_REQUIRE_REJECTION} onChange={(v) => update("SCALP_REQUIRE_REJECTION", v)} description="آیا کندل ریجکشن الزامی است؟" className="sm:col-span-2" />
      </Section>
    ),
    "scalp-exit": (
      <Section title="تنظیمات خروج و SL/TP در حالت اسکلپ" desc="حد ضرر، حد سود، سشن و اسپرد">
        <NumberField label="lookback ساختار" value={value.SCALP_STRUCTURE_LOOKBACK} onChange={(v) => update("SCALP_STRUCTURE_LOOKBACK", v)} />
        <NumberField label="بافر ساختار (ATR)" value={value.SCALP_STRUCTURE_BUFFER_ATR} onChange={(v) => update("SCALP_STRUCTURE_BUFFER_ATR", v)} step={0.05} />
        <NumberField label="ضریب SL (ATR)" value={value.SCALP_ATR_SL_MULTIPLIER} onChange={(v) => update("SCALP_ATR_SL_MULTIPLIER", v)} step={0.05} />
        <SelectField label="حالت TP" value={value.SCALP_TP_MODE} onChange={(v) => update("SCALP_TP_MODE", v)} options={tpModeOptions} />
        <NumberField label="TP جایگزین (ATR)" value={value.SCALP_TP_ATR_FALLBACK} onChange={(v) => update("SCALP_TP_ATR_FALLBACK", v)} step={0.1} />
        <NumberField label="حداقل R/R" value={value.SCALP_MIN_RR} onChange={(v) => update("SCALP_MIN_RR", v)} step={0.1} />
        <NumberField label="حداکثر اسپرد (نقطه)" value={value.SCALP_MAX_SPREAD_POINTS} onChange={(v) => update("SCALP_MAX_SPREAD_POINTS", v)} />
        <SwitchField label="فیلتر سشن" checked={value.SCALP_SESSION_FILTER_ENABLED} onChange={(v) => update("SCALP_SESSION_FILTER_ENABLED", v)} description="محدود کردن معاملات به ساعات مشخص" />
        <NumberField label="شروع سشن (UTC)" value={value.SCALP_SESSION_START_HOUR_UTC} onChange={(v) => update("SCALP_SESSION_START_HOUR_UTC", v)} min={0} max={23} />
        <NumberField label="پایان سشن (UTC)" value={value.SCALP_SESSION_END_HOUR_UTC} onChange={(v) => update("SCALP_SESSION_END_HOUR_UTC", v)} min={0} max={23} />
      </Section>
    ),
    risk: (
      <Section title="پارامترهای ریسک، حد ضرر و حد سود" desc="درصد ریسک، روش‌های تعیین SL/TP، Donchian">
        <SelectField
          label="پروفایل تحمل ریسک"
          value={value.RISK_TOLERANCE_PROFILE}
          onChange={(v) => applyRiskProfile(v)}
          options={riskProfileOptions}
          description="اعمال فوریِ preset روی فیلدهای ریسک"
        />
        <NumberField label="ریسک هر معامله (%)" value={value.RISK_PERCENT_PER_TRADE} onChange={(v) => update("RISK_PERCENT_PER_TRADE", v)} step={0.1} />
        <NumberField label="حد ضرر (%)" value={value.SL_PERCENT} onChange={(v) => update("SL_PERCENT", v)} step={0.1} />
        <NumberField label="حد سود (%)" value={value.TP_PERCENT} onChange={(v) => update("TP_PERCENT", v)} step={0.1} />
        <SwitchField label="Stops آگاه از اهرم" checked={value.ENABLE_LEVERAGE_AWARE_PERCENT_STOPS} onChange={(v) => update("ENABLE_LEVERAGE_AWARE_PERCENT_STOPS", v)} />
        <SwitchField label="حد ضرر S/R" checked={value.ENABLE_SR_STOPS} onChange={(v) => update("ENABLE_SR_STOPS", v)} />
        <NumberField label="lookback S/R" value={value.SR_LOOKBACK_BARS} onChange={(v) => update("SR_LOOKBACK_BARS", v)} />
        <NumberField label="بافر S/R (ATR)" value={value.SR_BUFFER_ATR_MULTIPLIER} onChange={(v) => update("SR_BUFFER_ATR_MULTIPLIER", v)} step={0.05} />
        <SwitchField label="حد ضرر Donchian" checked={value.ENABLE_DONCHIAN_SL} onChange={(v) => update("ENABLE_DONCHIAN_SL", v)} />
        <NumberField label="دوره Donchian" value={value.DONCHIAN_PERIOD} onChange={(v) => update("DONCHIAN_PERIOD", v)} />
        <NumberField label="ضریب ATR Donchian" value={value.DONCHIAN_ATR_MULTIPLIER} onChange={(v) => update("DONCHIAN_ATR_MULTIPLIER", v)} step={0.05} />
      </Section>
    ),
    "trend-entry": (
      <Section title="شرط‌های ورود در استراتژی روند" desc="تأیید ADX، cooldown و تایمفریم بالاتر (HTF)">
        <NumberField label="آستانه ADX روند" value={value.ADX_TREND_THRESHOLD} onChange={(v) => update("ADX_TREND_THRESHOLD", v)} step={0.5} />
        <NumberField label="cooldown (کندل)" value={value.COOLDOWN_BARS} onChange={(v) => update("COOLDOWN_BARS", v)} />
        <NumberField label="حداکثر معاملات هم‌زمان" value={value.MAX_CONCURRENT_TRADES} onChange={(v) => update("MAX_CONCURRENT_TRADES", v)} />
        <NumberField label="حداکثر ریسک کل (%)" value={value.MAX_TOTAL_RISK_PERCENT} onChange={(v) => update("MAX_TOTAL_RISK_PERCENT", v)} step={0.5} />
        <SwitchField label="حد زیان روزانه" checked={value.ENABLE_DAILY_LOSS_LIMIT} onChange={(v) => update("ENABLE_DAILY_LOSS_LIMIT", v)} />
        <NumberField label="حد زیان روزانه (%)" value={value.DAILY_LOSS_LIMIT_PERCENT} onChange={(v) => update("DAILY_LOSS_LIMIT_PERCENT", v)} step={0.5} />
        <SwitchField label="تأیید HTF" checked={value.ENABLE_HTF_CONFIRMATION} onChange={(v) => update("ENABLE_HTF_CONFIRMATION", v)} description="آیا روند تایمفریم بالاتر بررسی شود؟" />
        <SelectField
          label="تایمفریم HTF"
          value={value.HTF_TIMEFRAME == null ? "" : String(value.HTF_TIMEFRAME)}
          onChange={(v) => update("HTF_TIMEFRAME", v === "" ? null : parseInt(v, 10))}
          options={htfOptions}
        />
      </Section>
    ),
    exit: (
      <Section title="تنظیمات خروج از معاملات" desc="Trailing Stop، حداکثر مدت، تعطیلی آخر هفته">
        <SwitchField label="تریلینگ استاپ" checked={value.ENABLE_TRAILING_STOP} onChange={(v) => update("ENABLE_TRAILING_STOP", v)} />
        <NumberField label="فعال‌سازی تریلینگ (ATR)" value={value.TRAILING_ACTIVATION_ATR_MULTIPLIER} onChange={(v) => update("TRAILING_ACTIVATION_ATR_MULTIPLIER", v)} step={0.05} />
        <NumberField label="فاصلهٔ تریلینگ (ATR)" value={value.TRAILING_DISTANCE_ATR_MULTIPLIER} onChange={(v) => update("TRAILING_DISTANCE_ATR_MULTIPLIER", v)} step={0.05} />
        <SwitchField label="حداکثر مدت معامله" checked={value.ENABLE_MAX_TRADE_DURATION} onChange={(v) => update("ENABLE_MAX_TRADE_DURATION", v)} />
        <NumberField label="حداکثر مدت (ساعت)" value={value.MAX_TRADE_DURATION_HOURS} onChange={(v) => update("MAX_TRADE_DURATION_HOURS", v)} step={0.5} />
        <SwitchField label="بستن آخر هفته" checked={value.ENABLE_WEEKEND_CLOSE} onChange={(v) => update("ENABLE_WEEKEND_CLOSE", v)} />
        <NumberField label="ساعت بستن آخر هفته (UTC)" value={value.WEEKEND_CLOSE_HOUR_UTC} onChange={(v) => update("WEEKEND_CLOSE_HOUR_UTC", v)} min={0} max={23} />
      </Section>
    ),
    misc: (
      <Section title="تنظیمات عمومی پروفایل" desc="نام پروفایل، Magic Number و بالانس اولیه">
        <SwitchField label="فقط حساب دمو" checked={value.REQUIRE_DEMO_ACCOUNT} onChange={(v) => update("REQUIRE_DEMO_ACCOUNT", v)} description="جلوگیری از اجرا روی حساب واقعی" className="sm:col-span-2" />
        <TextField label="نام پروفایل" value={value.PROFILE_NAME} onChange={(v) => update("PROFILE_NAME", v)} mono />
        <NumberField label="Magic Number" value={value.MAGIC_NUMBER} onChange={(v) => update("MAGIC_NUMBER", v)} description="شناسهٔ یکتای ربات در MT5" />
        <NumberField label="بالانس اولیه (اختیاری)" value={value.INITIAL_BALANCE ?? 0} onChange={(v) => update("INITIAL_BALANCE", v)} step={100} />
      </Section>
    ),
  };

  return (
    <Card className="form-card">
      <CardHeader dir="rtl">
        {/* Row 1 — title + meta badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="form-card-title">پیکربندی ربات</span>
            <span className="form-card-subtitle">
              تمامی تنظیمات استراتژی، ریسک و خروج در این فرم قرار دارند.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="form-meta-badge border border-emerald-500/30 bg-emerald-500/10">
              <Hash className="size-3 text-emerald-500" />
              <span className="form-meta-badge-key">Magic</span>
              <span className="form-meta-badge-val">{value.MAGIC_NUMBER}</span>
            </span>
            {value.INITIAL_BALANCE != null && (
              <span className="form-meta-badge border border-amber-500/30 bg-amber-500/10">
                <Wallet className="size-3 text-amber-500" />
                <span className="form-meta-badge-key">بالانس</span>
                <span className="form-meta-badge-val">{value.INITIAL_BALANCE}</span>
              </span>
            )}
          </div>
        </div>

        {/* Row 2 — quick risk preset (moved here for fast access) */}
        <div className="form-preset-section form-preset-section--inline" dir="rtl">
          <div className="flex flex-wrap items-center gap-3">
            <Sparkles className="size-4 text-emerald-500 shrink-0" />
            <div className="flex flex-col shrink-0">
              <span className="form-preset-label">اعمال سریع Preset ریسک</span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">
                یک کلیک برای تنظیم فیلدهای کلیدی ریسک
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mr-auto">
              {riskProfileOptions.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyRiskProfile(o.value)}
                  className={cn(
                    "h-7",
                    value.RISK_TOLERANCE_PROFILE === o.value &&
                      "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
                  )}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2" dir="rtl">
        <Accordion type="multiple" defaultValue={[]} className="w-full">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <AccordionItem key={s.value} value={s.value}>
                <AccordionTrigger className="hover:bg-muted/40 px-3 rounded-md gap-3">
                  <span className="form-section-num">{s.num}</span>
                  <span className="form-section-icon">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex flex-col items-start">
                    <span className="form-section-title">{s.title}</span>
                    <span className="form-section-subtitle">{s.subtitle}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-3 pt-4">
                  {sectionContent[s.value]}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
