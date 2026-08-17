"use client";
import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ChipInputProps {
  label?: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  description?: string;
  className?: string;
}

export function ChipInput({
  label,
  values,
  onChange,
  suggestions = [],
  placeholder = "افزودن و Enter…",
  description,
  className,
}: ChipInputProps) {
  const [input, setInput] = React.useState("");

  function add(v: string) {
    const trimmed = v.trim().toUpperCase();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  }

  function remove(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(input);
    } else if (e.key === "Backspace" && input === "" && values.length) {
      remove(values[values.length - 1]);
    }
  }

  // Suggested symbols not already in values
  const available = suggestions.filter((s) => !values.includes(s.toUpperCase()));

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label className="text-xs font-medium text-foreground/90">{label}</Label>
      )}
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-2.5">
        <div className="flex flex-wrap gap-1.5" dir="rtl">
          {values.length === 0 && (
            <span className="text-xs text-muted-foreground px-1 py-0.5">
              هیچ نمادی انتخاب نشده
            </span>
          )}
          {values.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="gap-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
            >
              <span className="font-mono">{v}</span>
              <button
                type="button"
                onClick={() => remove(v)}
                className="ml-0.5 hover:text-rose-500"
                aria-label={`حذف ${v}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>

        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          dir="rtl"
          className="font-mono text-right"
        />

        {available.length > 0 && (
          <div className="flex flex-wrap gap-1" dir="rtl">
            {available.slice(0, 12).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="rounded border border-border/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-500"
              >
                + {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {description && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {description}
        </p>
      )}
    </div>
  );
}
