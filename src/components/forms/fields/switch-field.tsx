"use client";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface SwitchFieldProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  className?: string;
}

export function SwitchField({
  label,
  checked,
  onChange,
  description,
  className,
}: SwitchFieldProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3",
        className
      )}
      dir="rtl"
    >
      <div className="flex flex-col gap-0.5">
        <Label className="form-field-label text-right !mb-0">{label}</Label>
        {description && (
          <p className="form-field-desc text-right !mt-0">
            {description}
          </p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
