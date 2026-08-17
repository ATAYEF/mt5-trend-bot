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
    <div className={cn("flex flex-col gap-1", className)} dir="rtl">
      <Label className="form-field-label text-right">{label}</Label>
      <Select value={cur} onValueChange={onChange}>
        <SelectTrigger className="w-full text-right" dir="rtl">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="text-right" dir="rtl">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-right">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p className="form-field-desc text-right">
          {description}
        </p>
      )}
    </div>
  );
}
