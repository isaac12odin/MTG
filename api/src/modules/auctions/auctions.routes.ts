import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../security/guards";
import { createAuction, getAuction, listAuctions, placeBid } from "./auctions.controller";

export async function auctionRoutes(app: FastifyInstance) {
  app.get("/auctions", listAuctions);
  app.get("/auctions/:id", getAuction);
  app.post(
    "/auctions",
    { preHandler: requireRole(["SELLER", "STORE"]), config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    createAuction
  );
  app.post(
    "/auctions/:id/bids",
    { preHandler: requireAuth, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    placeBid
  );
}
