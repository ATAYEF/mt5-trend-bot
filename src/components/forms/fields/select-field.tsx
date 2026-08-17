"use client";
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string | undefined | null;
  onChange: (v: string) => void;
  options: SelectOption[];
  description?: string;
  placeholder?: string;
  className?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  description,
  placeholder = "انتخاب کنید…",
  className,
}: SelectFieldProps) {
  // Select doesn't accept empty string as value; use sentinel "none"
  const cur = value == null || value === "" ? undefined : String(value);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-medium text-foreground/90">{label}</Label>
      <Select value={cur} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {description}
        </p>
      )}
    </div>
  );
}
