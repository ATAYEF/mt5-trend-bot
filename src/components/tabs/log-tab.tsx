"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const LEVELS = ["INFO", "WARN", "ERROR", "DEBUG"] as const;

function levelClass(line: string): string {
  for (const l of LEVELS) {
    if (line.includes(`[${l}]`)) {
      return `log-${l.toLowerCase()}`;
    }
  }
  return "";
}

export function LogTab() {
  const [lines, setLines] = React.useState<string[]>([]);
  // Use a ref for `since` so we don't trigger a new queryKey on each fetch.
  const sinceRef = React.useRef(0);
  const [atBottom, setAtBottom] = React.useState(true);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["log"],
    queryFn: () => api.getLog(sinceRef.current),
    refetchInterval: 2000,
  });

  // Append new lines as they arrive
  React.useEffect(() => {
    if (!data) return;
    if (data.lines.length === 0) return;
    setLines((prev) => {
      const merged = [...prev, ...data.lines];
      if (merged.length > 1000) {
        return merged.slice(merged.length - 1000);
      }
      return merged;
    });
    sinceRef.current = data.next;
  }, [data]);

  // Auto-scroll to bottom if user is at bottom
  React.useEffect(() => {
    if (!containerRef.current) return;
    if (atBottom) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, atBottom]);

  function onScroll() {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAtBottom(atBottom);
  }

  function clear() {
    setLines([]);
  }

  function scrollToBottom() {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAtBottom(true);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
              لاگ زنده
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {lines.length} خط
                {(isLoading || isFetching) && (
                  <Loader2 className="size-3 ms-1 inline animate-spin" />
                )}
              </span>
              <Button size="sm" variant="outline" onClick={clear}>
                <Trash2 className="size-3.5" />
                پاک کردن
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div
            ref={containerRef}
            onScroll={onScroll}
            className="log-terminal max-h-[70vh]"
          >
            {lines.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                در حال دریافت لاگ‌ها…
              </div>
            ) : (
              lines.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">
                  <span className="log-line-num">{String(i + 1).padStart(4, "0")}</span>
                  <span className={levelClass(line)}>{line}</span>
                </div>
              ))
            )}
          </div>
          {!atBottom && (
            <div className="mt-2 flex justify-center">
              <Button size="sm" variant="outline" onClick={scrollToBottom}>
                رفتن به آخر
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
