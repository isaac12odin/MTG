import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../security/guards";
import {
  archiveInventoryItem,
  bulkInventory,
  createInventoryItem,
  getStore,
  listMyInventory,
  listStoreInventory,
  updateInventoryItem,
  upsertStore,
} from "./stores.controller";

export async function storeRoutes(app: FastifyInstance) {
  app.get("/stores/:id", getStore);
  app.get("/stores/:id/inventory", listStoreInventory);

  app.post(
    "/me/store",
    { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    upsertStore
  );

  app.get("/me/inventory", { preHandler: requireRole(["STORE"]) }, listMyInventory);

  app.post(
    "/inventory",
    { preHandler: requireRole(["STORE"]), config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    createInventoryItem
  );
  app.post(
    "/inventory/bulk",
    { preHandler: requireRole(["STORE"]), config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    bulkInventory
  );
  app.patch(
    "/inventory/:id",
    { preHandler: requireRole(["STORE"]), config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    updateInventoryItem
  );
  app.delete(
    "/inventory/:id",
    { preHandler: requireRole(["STORE"]), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    archiveInventoryItem
  );
}
