"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  description?: string;
  unit?: string;
  className?: string;
}

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  description,
  unit,
  className,
}: NumberFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label className="form-field-label">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className="font-mono text-right"
          dir="rtl"
        />
        {unit && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>
      {description && (
        <p className="form-field-desc">
          {description}
        </p>
      )}
    </div>
  );
}
