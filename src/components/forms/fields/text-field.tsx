"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  description?: string;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  ltr?: boolean;
  className?: string;
}

export function TextField({
  label,
  value,
  onChange,
  description,
  placeholder,
  type = "text",
  mono,
  ltr: _ltr, // deprecated — kept for API compatibility, but all fields are RTL now
  className,
}: TextFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-medium text-foreground/90 text-right">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="rtl"
        className={cn(mono && "font-mono", "text-right")}
      />
      {description && (
        <p className="text-[11px] text-muted-foreground leading-snug text-right">
          {description}
        </p>
      )}
    </div>
  );
}
