// ============================================================
// محاسبات مشتق‌شده از وضعیت پروفایل‌ها (که local_service.py push
// می‌کند) — برای داشبورد و تب پوزیشن‌ها. جایگزین همان توابع که قبلاً
// در live/bot-manager.ts با منطق TS محاسبه می‌شدند.
//
// نکته‌ی مهم: فیلد open_positions در snapshot هر پروفایل شامل *همه‌ی*
// پوزیشن‌های حساب MT5 است (نه فقط پوزیشن‌های همان پروفایل) — چون
// چند پروفایل ممکن است روی یک حساب با Magic Number متفاوت اجرا شوند.
// پس همیشه باید بر اساس magic فیلتر کرد.
// ============================================================
import type { ProfileStatusEntry } from "../store/local-state.js";

function filterOwnPositions(entry: ProfileStatusEntry): any[] {
  const snap = entry.snapshot;
  if (!snap) return [];
  const magic = snap.magic_number;
  const all: any[] = snap.open_positions ?? [];
  return magic == null ? all : all.filter((p) => p.magic === magic);
}

export function computeDashboardStats(profiles: Record<string, ProfileStatusEntry>) {
  const entries = Object.values(profiles);
  const runningCount = entries.filter((e) => e.running).length;

  let balance = 0;
  let equity = 0;
  let currency = "USD";
  let accountLogin: number | undefined;
  let accountServer: string | undefined;
  let leverage: number | undefined;
  let mt5Connected = false;

  // بالانس/اکوییتی مشترک بین پروفایل‌هایی که روی یک حساب هستند —
  // اولین پروفایل متصل را به‌عنوان مرجع حساب در نظر می‌گیریم
  for (const e of entries) {
    if (e.snapshot?.connected) {
      mt5Connected = true;
      balance = e.snapshot.balance ?? balance;
      equity = e.snapshot.equity ?? equity;
      currency = e.snapshot.currency ?? currency;
      accountLogin = e.snapshot.account_login ?? accountLogin;
      accountServer = e.snapshot.account_server ?? accountServer;
      leverage = e.snapshot.account_leverage ?? leverage;
      break;
    }
  }

  let openPositionsCount = 0;
  let totalUnrealizedPnl = 0;
  let profilesWithOpenPositions = 0;

  for (const e of entries) {
    const own = filterOwnPositions(e);
    if (own.length > 0) profilesWithOpenPositions += 1;
    openPositionsCount += own.length;
    totalUnrealizedPnl += own.reduce((sum, p) => sum + (p.profit ?? 0), 0);
  }

  return {
    balance,
    equity,
    currency,
    running_bots_count: runningCount,
    profiles_with_open_positions: profilesWithOpenPositions,
    open_positions_count: openPositionsCount,
    total_unrealized_pnl: Math.round(totalUnrealizedPnl * 100) / 100,
    daily_pnl: Math.round(totalUnrealizedPnl * 100) / 100,
    mt5_connected: mt5Connected,
    account_login: accountLogin,
    account_server: accountServer,
    leverage,
  };
}

export function computeGroupedPositions(profiles: Record<string, ProfileStatusEntry>) {
  const grouped: Record<string, Record<string, any[]>> = {};
  for (const [profileName, entry] of Object.entries(profiles)) {
    const own = filterOwnPositions(entry);
    if (own.length === 0) continue;
    grouped[profileName] = {};
    for (const pos of own) {
      const symbol = pos.symbol ?? "نامشخص";
      if (!grouped[profileName][symbol]) grouped[profileName][symbol] = [];
      grouped[profileName][symbol].push(pos);
    }
  }
  return grouped;
}

export function computeAllStatuses(profiles: Record<string, ProfileStatusEntry>) {
  const out: Record<string, any> = {};
  for (const [name, entry] of Object.entries(profiles)) {
    out[name] = {
      ...(entry.snapshot ?? {}),
      is_running: entry.running,
      profile_name: name,
    };
  }
  return out;
}
