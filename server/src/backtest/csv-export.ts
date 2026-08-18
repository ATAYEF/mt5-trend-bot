// ============================================================
// خروجی CSV برای نتایج بکتست (بخش ۳.۴: «امکان خروجی گرفتن CSV/اکسل»)
// خروجی CSV با ستون‌بندی سازگار با اکسل (قابل باز شدن مستقیم در Excel)
// ============================================================
export function backtestTradesToCsv(trades: Record<string, unknown>[]): string {
  if (trades.length === 0) return "بدون معامله\n";
  const headers = Object.keys(trades[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = trades.map((t) => headers.map((h) => escape(t[h])).join(","));
  // BOM برای نمایش صحیح حروف فارسی در اکسل
  return "\uFEFF" + [headers.join(","), ...rows].join("\n") + "\n";
}
