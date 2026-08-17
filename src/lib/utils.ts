// ============================================================
// TrendPilot Web — Utils + formatters
// ============================================================
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ------------------- Number / Money / Percent formatters -------------------

/**
 * Format a number as money. For USD, uses Intl currency; for non-USD
 * we fall back to a plain decimal with the currency code appended.
 */
export function formatMoney(value: number, currency: string = "USD"): string {
  if (!Number.isFinite(value)) return "—";
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return `${formatNumber(value, 2)} ${currency}`;
}

/**
 * Format a value as a percentage with `decimals` decimal places.
 * Input value is assumed to already be in percent (e.g. 12.34 means 12.34%).
 */
export function formatPercent(value: number, decimals: number = 2): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a number with thousands separators and fixed decimal count.
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Compact format for large numbers (e.g. 1.2K, 3.4M).
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Convert a number to Persian digits. Useful for some labels.
 */
export function toPersianDigits(input: string | number): string {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(input).replace(/[0-9]/g, (d) => persian[parseInt(d, 10)]);
}

/**
 * Format an ISO timestamp into Asia/Tehran time, Latin digits.
 */
export function formatDateTime(iso: string | Date | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString().replace("T", " ").replace(/\..+/, "");
  }
}

/**
 * Format just the date portion (Asia/Tehran).
 */
export function formatDate(iso: string | Date | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Classify a P&L number into positive / negative / neutral.
 */
export function pnlTone(value: number): "pos" | "neg" | "neutral" {
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "neutral";
}

/**
 * Color class for P&L text.
 */
export function pnlColor(value: number): string {
  const tone = pnlTone(value);
  if (tone === "pos") return "text-emerald-500";
  if (tone === "neg") return "text-rose-500";
  return "text-muted-foreground";
}
