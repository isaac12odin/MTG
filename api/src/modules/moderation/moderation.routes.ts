import type { FastifyInstance } from "fastify";
import { requireRole } from "../../security/guards";
import { getChatStats, hideReview, verifyUser } from "./moderation.controller";

export async function moderationRoutes(app: FastifyInstance) {
  app.post("/users/:id/verify", { preHandler: requireRole(["ADMIN", "MOD"]) }, verifyUser);
  app.post("/reviews/:id/hide", { preHandler: requireRole(["ADMIN", "MOD"]) }, hideReview);
  app.get("/chat/active", { preHandler: requireRole(["ADMIN", "MOD"]) }, getChatStats);
}
