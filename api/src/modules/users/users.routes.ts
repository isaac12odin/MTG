import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../security/guards";
import {
  createAddress,
  deleteAddress,
  getMe,
  listAddresses,
  requestVerification,
  setDefaultAddress,
  updateAddress,
  upsertProfile,
} from "./users.controller";

export async function userRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: requireAuth }, getMe);
  app.put("/me/profile", { preHandler: requireAuth }, upsertProfile);

  app.get("/me/addresses", { preHandler: requireAuth }, listAddresses);
  app.post("/me/addresses", { preHandler: requireAuth }, createAddress);
  app.put("/me/addresses/:id", { preHandler: requireAuth }, updateAddress);
  app.delete("/me/addresses/:id", { preHandler: requireAuth }, deleteAddress);
  app.post("/me/addresses/:id/default", { preHandler: requireAuth }, setDefaultAddress);
  app.post("/me/verification-requests", { preHandler: requireAuth }, requestVerification);
}
