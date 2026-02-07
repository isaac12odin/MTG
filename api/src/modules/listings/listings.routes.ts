import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../security/guards";
import {
  createListing,
  getById,
  listMine,
  listPublic,
  removeListing,
  updateListing,
} from "./listings.controller";

export async function listingRoutes(app: FastifyInstance) {
  app.get("/listings", listPublic);
  app.get("/listings/:id", getById);
  app.get("/me/listings", { preHandler: requireAuth }, listMine);

  app.post(
    "/listings",
    { preHandler: requireRole(["SELLER", "STORE"]), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    createListing
  );
  app.patch(
    "/listings/:id",
    { preHandler: requireRole(["SELLER", "STORE"]), config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    updateListing
  );
  app.delete(
    "/listings/:id",
    { preHandler: requireRole(["SELLER", "STORE"]), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    removeListing
  );
}
