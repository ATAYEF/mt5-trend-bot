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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FilePlus2,
  Copy,
  Trash2,
  Save,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BotConfigForm } from "@/components/forms/bot-config-form";
import { useBotStatusMap } from "@/components/common/use-bot-status";
import type { BotConfig } from "@/lib/types";

export function SettingsTab() {
  const qc = useQueryClient();
  const { data: profilesData, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => api.getProfiles(),
  });
  const { data: meta } = useQuery({
    queryKey: ["meta"],
    queryFn: () => api.getMeta(),
  });
  const { botStatus } = useBotStatusMap();

  const profiles = profilesData?.profiles ?? {};
  const profileNames = Object.keys(profiles);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<BotConfig | null>(null);
  const [newName, setNewName] = React.useState("");
  const [dupOpen, setDupOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Initialize selected when profiles load
  React.useEffect(() => {
    if (!selected && profileNames.length) {
      setSelected(profileNames[0]);
    }
  }, [profileNames, selected]);

  React.useEffect(() => {
    if (selected && profiles[selected]) {
      setDraft({ ...profiles[selected] });
    }
  }, [selected, profiles]);

  // Poll bot status for the badges
  const isRunning = selected ? botStatus[selected]?.is_running ?? false : false;

  function handleNew() {
    if (!meta) return;
    const base = { ...meta.default_config };
    let idx = 1;
    let name = `پروفایل-جدید-${idx}`;
    while (profiles[name]) {
      idx++;
      name = `پروفایل-جدید-${idx}`;
    }
    base.PROFILE_NAME = name;
    base.MAGIC_NUMBER = Math.floor(100000 + Math.random() * 899999);
    setDraft(base);
    setSelected("__new__");
    toast.info("پروفایل جدید ساخته شد. برای ذخیره روی «ذخیره» بزنید.");
  }

  async function handleSave() {
    if (!draft) return;
    const name = (draft.PROFILE_NAME?.trim() || selected || "") as string;
    if (!name || name === "__new__") {
      toast.error("نام پروفایل خالی است.");
      return;
    }
    setSaving(true);
    try {
      await api.saveProfile(name, { ...draft, PROFILE_NAME: name });
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(`پروفایل «${name}» ذخیره شد.`);
      setSelected(name);
    } catch (e) {
      toast.error("ذخیره ناموفق بود.", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(newN: string) {
    if (!selected || selected === "__new__") return;
    if (!newN.trim()) {
      toast.error("نام جدید را وارد کنید.");
      return;
    }
    try {
      await api.duplicateProfile(selected, newN.trim());
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      setSelected(newN.trim());
      setDupOpen(false);
      setNewName("");
      toast.success(`پروفایل «${newN}» به‌عنوان کپی ساخته شد.`);
    } catch (e) {
      toast.error("کپی ناموفق بود.", { description: String(e) });
    }
  }

  async function handleDelete() {
    if (!selected || selected === "__new__") return;
    try {
      await api.deleteProfile(selected);
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      const remaining = Object.keys(profiles).filter((k) => k !== selected);
      setSelected(remaining[0] ?? null);
      toast.success(`پروفایل «${selected}» حذف شد.`);
    } catch (e) {
      toast.error("حذف ناموفق بود.", { description: String(e) });
    }
  }

  async function handleStart() {
    if (!draft) return;
    const name = (draft.PROFILE_NAME?.trim() || selected || "") as string;
    if (!name || name === "__new__") {
      toast.error("ابتدا پروفایل را ذخیره کنید.");
      return;
    }
    try {
      const r = await api.startBot(name, draft);
      await qc.invalidateQueries({ queryKey: ["bot-status"] });
      if (r.already_running) {
        toast.info(`ربات «${name}» از قبل در حال اجرا است.`);
      } else {
        toast.success(`ربات «${name}» آغاز به کار کرد.`);
      }
    } catch (e) {
      toast.error("شروع ناموفق بود.", { description: String(e) });
    }
  }

  async function handleStop() {
    if (!selected || selected === "__new__") return;
    try {
      await api.stopBot(selected);
      await qc.invalidateQueries({ queryKey: ["bot-status"] });
      toast.success(`ربات «${selected}» متوقف شد.`);
    } catch (e) {
      toast.error("توقف ناموفق بود.", { description: String(e) });
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px_1fr]">
          <div className="h-64 rounded-xl bg-muted/30" />
          <div className="h-64 rounded-xl bg-muted/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px_1fr]">
      {/* Profile list */}
      <Card className="border-border/60 h-fit">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">پروفایل‌ها</CardTitle>
            <Button size="sm" variant="outline" onClick={handleNew} className="h-7">
              <FilePlus2 className="size-3.5" />
              جدید
            </Button>
          </div>
          <CardDescription>انتخاب پروفایل برای ویرایش</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {profileNames.length === 0 && selected !== "__new__" ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              هیچ پروفایلی ذخیره نشده.
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto scroll-y-rtl p-1">
              {selected === "__new__" && draft && (
                <li>
                  <button
                    onClick={() => setDraft({ ...draft })}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-right text-sm",
                      "border border-dashed border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                    )}
                  >
                    <span className="truncate">{draft.PROFILE_NAME}</span>
                    <span className="text-[10px]">جدید</span>
                  </button>
                </li>
              )}
              {profileNames.map((name) => {
                const prof = profiles[name];
                const running = botStatus[name]?.is_running ?? false;
                return (
                  <li key={name}>
                    <button
                      onClick={() => setSelected(name)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-right text-sm hover:bg-muted/50",
                        selected === name && "bg-muted"
                      )}
                    >
                      <div className="flex flex-col items-start gap-0.5 truncate">
                        <span className="truncate font-medium">{name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {prof.SYMBOLS.length} نماد · M{prof.TIMEFRAME} · {prof.STRATEGY_MODE.split(" ")[0]}
                        </span>
                      </div>
                      {running ? (
                        <span className="flex items-center gap-1 text-emerald-500">
                          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                          در اجرا
                        </span>
                      ) : (
                        <CircleDot className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Form */}
      <div className="flex flex-col gap-3">
        {/* Action bar */}
        <Card className="border-border/60">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="flex items-center gap-2">
              {draft && (
                <Input
                  value={draft.PROFILE_NAME}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, PROFILE_NAME: e.target.value } : d))
                  }
                  className="h-9 w-56 font-mono text-sm text-right"
                  placeholder="نام پروفایل"
                  dir="rtl"
                />
              )}
              {isRunning && (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-500">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  در حال اجرا
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Duplicate */}
              <Sheet open={dupOpen} onOpenChange={setDupOpen}>
                <SheetTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selected || selected === "__new__"}
                  >
                    <Copy className="size-3.5" />
                    کپی
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader>
                    <SheetTitle>کپی پروفایل</SheetTitle>
                    <SheetDescription>
                      یک کپی از «{selected}» با نام جدید بسازید.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="p-4">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="نام جدید"
                      dir="rtl"
                      className="font-mono text-right"
                    />
                  </div>
                  <SheetFooter>
                    <Button onClick={() => handleDuplicate(newName)} size="sm">
                      ایجاد کپی
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>

              {/* Delete */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
                    disabled={!selected || selected === "__new__"}
                  >
                    <Trash2 className="size-3.5" />
                    حذف
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف پروفایل</AlertDialogTitle>
                    <AlertDialogDescription>
                      آیا از حذف پروفایل «{selected}» مطمئن هستید؟ این عمل قابل بازگشت نیست.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>انصراف</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-rose-500 hover:bg-rose-600 text-white"
                    >
                      حذف کن
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button size="sm" variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ["profiles"] })}>
                <RefreshCw className="size-3.5" />
              </Button>

              <Button size="sm" variant="default" onClick={handleSave} disabled={saving || !draft}>
                <Save className="size-3.5" />
                {saving ? "در حال ذخیره…" : "ذخیره"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleStart}
                disabled={!draft || isRunning}
                className="border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
              >
                <Play className="size-3.5" />
                شروع اجرا
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleStop}
                disabled={!isRunning}
                className="border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
              >
                <Square className="size-3.5" />
                توقف
              </Button>
            </div>
          </CardContent>
        </Card>

        {draft ? (
          <BotConfigForm value={draft} onChange={setDraft} />
        ) : (
          <Card className="border-border/60">
            <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              برای ویرایش، یک پروفایل انتخاب کنید یا پروفایل جدید بسازید.
            </CardContent>
          </Card>
        )}

        {/* Saved status */}
        {draft && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>
              Magic: <span className="font-mono">{draft.MAGIC_NUMBER}</span>
              {" · "}
              {draft.SYMBOLS.length} نماد · تایمفریم M{draft.TIMEFRAME}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
