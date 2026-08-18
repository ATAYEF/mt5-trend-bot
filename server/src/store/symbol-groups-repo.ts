// ============================================================
// مخزن گروه‌های نماد — GET/PUT /api/symbol-groups
// ============================================================
import { jsonStore } from "./json-store.js";

const FILE = "symbol-groups.json";

export type SymbolGroups = Record<string, string[]>;

const DEFAULT_GROUPS: SymbolGroups = {
  "فارکس اصلی": ["EURUSD", "GBPUSD", "USDJPY", "USDCHF"],
  "فلزات": ["XAUUSD", "XAGUSD"],
  "کریپتو": ["BTCUSD", "ETHUSD"],
  "شاخص‌ها": ["US30", "NAS100", "GER40"],
};

export const symbolGroupsRepo = {
  async get(): Promise<SymbolGroups> {
    return jsonStore.readJsonFile<SymbolGroups>(FILE, DEFAULT_GROUPS);
  },
  async save(groups: SymbolGroups): Promise<SymbolGroups> {
    await jsonStore.writeJsonFile(FILE, groups);
    return groups;
  },
};
