import type { FastifyInstance } from "fastify";
import { requireRole } from "../../security/guards";
import {
  adminSettings,
  createPlanAdmin,
  createGameAdmin,
  dashboardStats,
  decideVerificationRequest,
  listAuctionsAdmin,
  listDealsAdmin,
  listGamesAdmin,
  listListingsAdmin,
  listPaymentAlerts,
  listPlansAdmin,
  listReportsAdmin,
  listStoresAdmin,
  listEventsAdmin,
  listUsersAdmin,
  listVerificationRequests,
  updateEventAdmin,
  updateGameAdmin,
  updateListingAdmin,
  updatePlanAdmin,
  updateReportAdmin,
  updateUserAdmin,
  verifyPayment,
  listChatActiveUsers,
} from "./admin.controller";

export async function adminRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRole(["ADMIN", "MOD"]) };

  app.get("/admin/games", guard, listGamesAdmin);
  app.post("/admin/games", guard, createGameAdmin);
  app.patch("/admin/games/:id", guard, updateGameAdmin);

  app.get("/admin/dashboard", guard, dashboardStats);

  app.get("/admin/users", guard, listUsersAdmin);
  app.patch("/admin/users/:id", guard, updateUserAdmin);

  app.get("/admin/listings", guard, listListingsAdmin);
  app.patch("/admin/listings/:id", guard, updateListingAdmin);

  app.get("/admin/auctions", guard, listAuctionsAdmin);
  app.get("/admin/deals", guard, listDealsAdmin);
  app.get("/admin/reports", guard, listReportsAdmin);
  app.patch("/admin/reports/:id", guard, updateReportAdmin);

  app.get("/admin/stores", guard, listStoresAdmin);
  app.get("/admin/events", guard, listEventsAdmin);
  app.patch("/admin/events/:id", guard, updateEventAdmin);

  app.get("/admin/plans", guard, listPlansAdmin);
  app.post("/admin/plans", guard, createPlanAdmin);
  app.patch("/admin/plans/:id", guard, updatePlanAdmin);

  app.get("/admin/settings", guard, adminSettings);
  app.get("/admin/chat/active-users", guard, listChatActiveUsers);

  app.get("/admin/verifications", guard, listVerificationRequests);
  app.post("/admin/verifications/:id/decision", guard, decideVerificationRequest);

  app.get("/admin/payments", guard, listPaymentAlerts);
  app.post("/admin/payments/:id/verify", guard, verifyPayment);
}
