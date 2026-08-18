// ============================================================
// ذخیره‌سازی پایدار سبک — فایل JSON روی دیسک
// طبق بخش ۴.۱۰: «ذخیره‌سازی پایدار (فایل JSON یا دیتابیس سبک مثل SQLite)»
// این ماژول یک key-value store ساده و امن در برابر نوشتن هم‌زمان
// (با نوشتن اتمیک از طریق فایل موقت + rename) فراهم می‌کند.
// ============================================================
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, "../../data");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      await writeJsonFile(filename, fallback);
      return fallback;
    }
    throw err;
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath); // نوشتن اتمیک — جلوگیری از خرابی فایل در نوشتن هم‌زمان
}

export const jsonStore = { readJsonFile, writeJsonFile };
