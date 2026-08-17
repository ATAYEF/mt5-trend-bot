"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Loader2, Search, Filter, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ----------------------------------------------------------------------------
// Log line parsing
// A line looks like:  [2026-08-17 05:07:47] [INFO] TrendPilot server v1.0.0...
// We split it into: timestamp, level, message
// ----------------------------------------------------------------------------

interface LogEntry {
  index: number;       // 1-based row number (assigned after merge)
  raw: string;         // original line
  timestamp: string | null;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "OTHER";
  message: string;
}

const LOG_LEVELS = ["INFO", "WARN", "ERROR", "DEBUG"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];
type LevelFilter = "ALL" | LogLevel;

const LEVEL_LABEL_FA: Record<LevelFilter, string> = {
  ALL: "همه",
  INFO: "اطلاع",
  WARN: "هشدار",
  ERROR: "خطا",
  DEBUG: "دیباگ",
};

function parseLine(raw: string, index: number): LogEntry {
  // Pattern: [timestamp] [LEVEL] message
  // timestamp may contain spaces inside []
  const m = raw.match(/^\[([^\]]+)\]\s*\[(\w+)\]\s*(.*)$/);
  if (m) {
    const level = (LOG_LEVELS as readonly string[]).includes(m[2])
      ? (m[2] as LogLevel)
      : "OTHER";
    return {
      index,
      raw,
      timestamp: m[1],
      level,
      message: m[3],
    };
  }
  // Fallback: no bracketed timestamp/level
  return {
    index,
    raw,
    timestamp: null,
    level: "OTHER",
    message: raw,
  };
}

function levelBadgeClass(level: LogEntry["level"]): string {
  switch (level) {
    case "INFO":
      return "log-badge-info";
    case "WARN":
      return "log-badge-warn";
    case "ERROR":
      return "log-badge-error";
    case "DEBUG":
      return "log-badge-debug";
    default:
      return "log-badge-other";
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LogTab() {
  const [rawLines, setRawLines] = React.useState<string[]>([]);
  const sinceRef = React.useRef(0);
  const [atTop, setAtTop] = React.useState(true);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Filters
  const [levelFilter, setLevelFilter] = React.useState<LevelFilter>("ALL");
  const [search, setSearch] = React.useState("");
  const [showFilters, setShowFilters] = React.useState(true);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["log"],
    queryFn: () => api.getLog(sinceRef.current),
    refetchInterval: 2000,
  });

  // Append new lines as they arrive
  React.useEffect(() => {
    if (!data) return;
    if (data.lines.length === 0) return;
    setRawLines((prev) => {
      const merged = [...prev, ...data.lines];
      if (merged.length > 1000) {
        return merged.slice(merged.length - 1000);
      }
      return merged;
    });
    sinceRef.current = data.next;
  }, [data]);

  // Parse all raw lines into LogEntry[] — newest first (descending index)
  const entries: LogEntry[] = React.useMemo(() => {
    const parsed = rawLines.map((line, i) => parseLine(line, i + 1));
    // Reverse so the newest (last appended) appears at the top
    return parsed.reverse();
  }, [rawLines]);

  // Apply filters
  const filtered: LogEntry[] = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (levelFilter !== "ALL" && e.level !== levelFilter) return false;
      if (q && !e.raw.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, levelFilter, search]);

  // Level counts for filter badges
  const levelCounts = React.useMemo(() => {
    const counts: Record<LevelFilter, number> = {
      ALL: entries.length,
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      DEBUG: 0,
    };
    for (const e of entries) {
      if (e.level === "INFO") counts.INFO++;
      else if (e.level === "WARN") counts.WARN++;
      else if (e.level === "ERROR") counts.ERROR++;
      else if (e.level === "DEBUG") counts.DEBUG++;
    }
    return counts;
  }, [entries]);

  // Auto-scroll to TOP when new entries arrive (since newest is at top)
  React.useEffect(() => {
    if (!containerRef.current) return;
    if (atTop) {
      containerRef.current.scrollTop = 0;
    }
  }, [filtered, atTop]);

  function onScroll() {
    if (!containerRef.current) return;
    const el = containerRef.current;
    // "at top" = user is viewing the newest entries
    const isTop = el.scrollTop < 40;
    setAtTop(isTop);
  }

  function clear() {
    setRawLines([]);
  }

  function scrollToTop() {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setAtTop(true);
    }
  }

  return (
    <div className="space-y-3" dir="rtl">
      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 pb-3" dir="rtl">
          <div className="flex flex-wrap items-center justify-between gap-3" dir="rtl">
            <CardTitle className="text-base flex items-center gap-2" dir="rtl">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              لاگ زنده
            </CardTitle>
            <div className="flex items-center gap-2" dir="rtl">
              <span className="text-xs text-muted-foreground" dir="rtl">
                {filtered.length} از {rawLines.length} خط
                {(isLoading || isFetching) && (
                  <Loader2 className="size-3 ms-1 inline animate-spin" />
                )}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowFilters((s) => !s)}
              >
                <Filter className="size-3.5" />
                فیلترها
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform",
                    showFilters && "rotate-180"
                  )}
                />
              </Button>
              <Button size="sm" variant="outline" onClick={clear}>
                <Trash2 className="size-3.5" />
                پاک کردن
              </Button>
            </div>
          </div>

          {/* Filter toolbar */}
          {showFilters && (
            <div
              className="mt-3 flex flex-col gap-3 rounded-lg border border-border/40 bg-card/40 p-3"
              dir="rtl"
            >
              {/* Search row */}
              <div className="relative" dir="rtl">
                <Search className="size-3.5 absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="جستجو در متن لاگ…"
                  className="text-right pr-9"
                  dir="rtl"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute top-1/2 -translate-y-1/2 left-3 text-muted-foreground hover:text-foreground"
                    aria-label="پاک کردن جستجو"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Level filter pills */}
              <div
                className="flex flex-wrap items-center gap-1.5"
                dir="rtl"
              >
                <span className="text-[11px] text-muted-foreground" dir="rtl">
                  سطح:
                </span>
                {(["ALL", "INFO", "WARN", "ERROR", "DEBUG"] as LevelFilter[]).map(
                  (lv) => {
                    const active = levelFilter === lv;
                    const count = levelCounts[lv];
                    return (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => setLevelFilter(lv)}
                        className={cn(
                          "log-filter-pill inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                          active
                            ? lv === "ALL"
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                              : lv === "INFO"
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                              : lv === "WARN"
                              ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                              : lv === "ERROR"
                              ? "border-rose-500/50 bg-rose-500/15 text-rose-400"
                              : "border-slate-400/50 bg-slate-400/15 text-slate-300"
                            : "border-border/60 bg-card/40 text-muted-foreground hover:bg-muted/40"
                        )}
                        aria-pressed={active}
                      >
                        <span>{LEVEL_LABEL_FA[lv]}</span>
                        <Badge
                          variant="secondary"
                          className="h-4 min-w-[1.25rem] px-1 text-[10px] font-mono"
                        >
                          {count}
                        </Badge>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0" dir="rtl">
          {/* Log table */}
          <div
            ref={containerRef}
            onScroll={onScroll}
            className="log-table max-h-[70vh] overflow-y-auto overflow-x-auto"
            dir="rtl"
          >
            {filtered.length === 0 ? (
              <div
                className="flex h-32 items-center justify-center text-xs text-muted-foreground"
                dir="rtl"
              >
                {rawLines.length === 0
                  ? "در حال دریافت لاگ‌ها…"
                  : "موردی مطابق فیلتر یافت نشد."}
              </div>
            ) : (
              <Table dir="rtl">
                <TableHeader dir="rtl" className="sticky top-0 z-20">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[64px] text-center font-bold">ردیف</TableHead>
                    <TableHead className="w-[170px] font-bold">زمان</TableHead>
                    <TableHead className="w-[90px] text-center font-bold">سطح</TableHead>
                    <TableHead className="font-bold">پیام</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => (
                    <TableRow key={entry.index}>
                      <TableCell className="log-table-num">
                        {String(entry.index).padStart(4, "0")}
                      </TableCell>
                      <TableCell className="log-table-time">
                        {entry.timestamp ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "log-badge",
                            levelBadgeClass(entry.level)
                          )}
                        >
                          {entry.level === "OTHER" ? "—" : entry.level}
                        </span>
                      </TableCell>
                      <TableCell className="log-table-message">
                        {entry.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {!atTop && filtered.length > 0 && (
            <div className="mt-2 flex justify-center" dir="rtl">
              <Button size="sm" variant="outline" onClick={scrollToTop}>
                <ChevronDown className="size-3.5 rotate-180" />
                رفتن به جدیدترین
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
