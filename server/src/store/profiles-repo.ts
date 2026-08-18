// ============================================================
// مخزن پروفایل‌ها — CRUD + کپی + تضمین یکتا بودن Number Magic
// طبق بخش ۳.۲: «هر پروفایل یک Number Magic یکتا دارد تا معامالت
// پروفایل‌های مختلف از هم تفکیک شوند.»
// طبق بخش ۴.۷: هر پروفایل مجموعه‌ی نماد و Number Magic مستقل خودش
// را دارد؛ محدودیت سقف ریسک کل در سطح کل حساب هم رعایت می‌شود
// (این بخش دوم در risk.ts پیاده شده و در bot-manager اعمال می‌شود).
// ============================================================
import { jsonStore } from "./json-store.js";
import type { BotConfig } from "../types.js";

const FILE = "profiles.json";

export type ProfilesMap = Record<string, BotConfig>;

async function loadAll(): Promise<ProfilesMap> {
  return jsonStore.readJsonFile<ProfilesMap>(FILE, {});
}

async function saveAll(profiles: ProfilesMap): Promise<void> {
  await jsonStore.writeJsonFile(FILE, profiles);
}

function nextMagicNumber(profiles: ProfilesMap): number {
  const used = new Set(Object.values(profiles).map((p) => p.MAGIC_NUMBER));
  let candidate = 100001;
  while (used.has(candidate)) candidate++;
  return candidate;
}

export const profilesRepo = {
  async list(): Promise<ProfilesMap> {
    return loadAll();
  },

  async get(name: string): Promise<BotConfig | null> {
    const all = await loadAll();
    return all[name] ?? null;
  },

  async save(name: string, config: BotConfig): Promise<BotConfig> {
    const all = await loadAll();
    // یکتا بودن Number Magic بین همه‌ی پروفایل‌های دیگر را تضمین کن
    const conflict = Object.entries(all).find(
      ([otherName, cfg]) => otherName !== name && cfg.MAGIC_NUMBER === config.MAGIC_NUMBER
    );
    const finalConfig = conflict ? { ...config, MAGIC_NUMBER: nextMagicNumber(all) } : config;
    all[name] = { ...finalConfig, PROFILE_NAME: name };
    await saveAll(all);
    return all[name];
  },

  async duplicate(name: string, newName: string): Promise<BotConfig> {
    const all = await loadAll();
    const source = all[name];
    if (!source) throw new Error(`پروفایل «${name}» یافت نشد`);
    if (all[newName]) throw new Error(`پروفایلی با نام «${newName}» از قبل وجود دارد`);
    const copy: BotConfig = { ...source, PROFILE_NAME: newName, MAGIC_NUMBER: nextMagicNumber(all) };
    all[newName] = copy;
    await saveAll(all);
    return copy;
  },

  async remove(name: string): Promise<void> {
    const all = await loadAll();
    delete all[name];
    await saveAll(all);
  },
};
