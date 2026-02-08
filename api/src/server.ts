import "dotenv/config";
import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";
import path from "path";
import fs from "fs";

import { authRoutes } from "./modules/auth/auth.routes";
import { moderationRoutes } from "./modules/moderation/moderation.routes";
import { listingRoutes } from "./modules/listings/listings.routes";
import { catalogRoutes } from "./modules/catalog/catalog.routes";
import { storeRoutes } from "./modules/stores/stores.routes";
import { auctionRoutes } from "./modules/auctions/auctions.routes";
import { chatRoutes } from "./modules/chat/chat.routes";
import { reviewRoutes } from "./modules/reviews/reviews.routes";
import { mediaRoutes } from "./modules/media/media.routes";
import { userRoutes } from "./modules/users/users.routes";
import { adminRoutes } from "./modules/admin/admin.routes";
import { prisma } from "./db";
import { startCron } from "./cron";
import { ensureAdminOnStart } from "./utils/bootstrap";

const app = Fastify({
  logger: true,
  trustProxy: true,
});

async function start() {
  const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors as any, {
    origin: [APP_ORIGIN],
    credentials: true,
  } as any);
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET,
  });
  await app.register(multipart, {
    limits: {
      fileSize: Number(process.env.UPLOAD_MAX_MB ?? 6) * 1024 * 1024,
      files: 1,
    },
  });
  await app.register(websocket);
  await app.register(rateLimit, {
    max: 200,
    timeWindow: "10 minute",
  });

  app.get("/uploads/*", async (request, reply) => {
    const rel = (request.params as { "*": string })["*"];
    const baseDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
    const resolved = path.resolve(baseDir, rel);
    if (!resolved.startsWith(baseDir)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    if (!fs.existsSync(resolved)) {
      return reply.code(404).send({ error: "Not found" });
    }
    const ext = path.extname(resolved).toLowerCase();
    if (ext === ".webp") reply.type("image/webp");
    if (ext === ".jpg" || ext === ".jpeg") reply.type("image/jpeg");
    if (ext === ".png") reply.type("image/png");
    return reply.send(fs.createReadStream(resolved));
  });

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "Invalid request", details: err.issues });
    }
    app.log.error(err);
    return reply.code(500).send({ error: "Internal error" });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(moderationRoutes, { prefix: "/moderation" });
  await app.register(listingRoutes);
  await app.register(catalogRoutes, { prefix: "/catalog" });
  await app.register(storeRoutes);
  await app.register(auctionRoutes);
  await app.register(chatRoutes);
  await app.register(reviewRoutes);
  await app.register(mediaRoutes);
  await app.register(userRoutes);
  await app.register(adminRoutes);

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  await ensureAdminOnStart();

  await app.listen({ port, host });

  startCron();
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
