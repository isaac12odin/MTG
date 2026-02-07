import type { FastifyInstance } from "fastify";
import { requireRole } from "../../security/guards";
import {
  createGameAdmin,
  decideVerificationRequest,
  listGamesAdmin,
  listPaymentAlerts,
  listVerificationRequests,
  updateGameAdmin,
  verifyPayment,
} from "./admin.controller";

export async function adminRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRole(["ADMIN", "MOD"]) };

  app.get("/admin/games", guard, listGamesAdmin);
  app.post("/admin/games", guard, createGameAdmin);
  app.patch("/admin/games/:id", guard, updateGameAdmin);

  app.get("/admin/verifications", guard, listVerificationRequests);
  app.post("/admin/verifications/:id/decision", guard, decideVerificationRequest);

  app.get("/admin/payments", guard, listPaymentAlerts);
  app.post("/admin/payments/:id/verify", guard, verifyPayment);
}
