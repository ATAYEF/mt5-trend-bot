// ============================================================
// نقطه‌ی ورود سرور — Fastify + CORS
//
// نسبت به نسخه‌ی قبلی: import و فراخوانی warmupProfilesFromDisk از
// live/bot-manager.ts حذف شد — آن ماژول به‌همراه کل موتور معاملاتی
// TS (indicators/signals/risk/engine/backtest/ai) دیگر لازم نیست و
// می‌تواند حذف شود؛ سرور دیگر خودش هیچ ربات یا تحلیلی اجرا نمی‌کند.
// ============================================================
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./api/routes.js";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await registerRoutes(app);

  app.setErrorHandler((err: any, _req, reply) => {
    app.log.error(err);
    reply.code(err.statusCode ?? 500).send({ error: err.message ?? "خطای داخلی سرور" });
  });

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`TrendPilot server listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
