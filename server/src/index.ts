// ============================================================
// نقطه‌ی ورود سرور — Fastify + CORS
// طبق اصل طراحی سند: «سرور بتواند روی هر هاستی (حتی سرور ابری
// لینوکسی معمولی) میزبانی شود» — بدون هیچ وابستگی سیستمی خاص.
// ============================================================
import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./api/routes.js";
import { warmupProfilesFromDisk } from "./live/bot-manager.js";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await registerRoutes(app);
  await warmupProfilesFromDisk();

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
