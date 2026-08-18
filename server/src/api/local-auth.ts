// ============================================================
// احراز هویت ساده برای endpointهای /api/local/* — این‌ها فقط باید
// توسط local_service.py صدا زده شوند، نه از مرورگر. یک secret مشترک
// کافی است چون فقط یک کلاینت (PC خودِ آتا) داریم.
//
// LOCAL_API_SECRET را هم در env سرور و هم در .env کنار local_service.py
// یکسان بگذارید.
// ============================================================
import type { FastifyRequest, FastifyReply } from "fastify";

const SECRET = process.env.LOCAL_API_SECRET ?? "";

export function requireLocalAuth(req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) {
  if (!SECRET) {
    // اگر عمداً secret تنظیم نشده (مثلاً محیط توسعه)، رد نکن ولی هشدار بده
    req.log.warn("LOCAL_API_SECRET تنظیم نشده — endpoint بدون احراز هویت باز است");
    return done();
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== SECRET) {
    reply.code(401).send({ error: "احراز هویت نامعتبر" });
    return;
  }
  done();
}
