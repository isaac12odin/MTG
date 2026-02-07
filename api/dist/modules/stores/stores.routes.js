"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeRoutes = storeRoutes;
const guards_1 = require("../../security/guards");
const stores_controller_1 = require("./stores.controller");
async function storeRoutes(app) {
    app.get("/stores/:id", stores_controller_1.getStore);
    app.get("/stores/:id/inventory", stores_controller_1.listStoreInventory);
    app.post("/me/store", { preHandler: guards_1.requireAuth, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, stores_controller_1.upsertStore);
    app.get("/me/inventory", { preHandler: (0, guards_1.requireRole)(["STORE"]) }, stores_controller_1.listMyInventory);
    app.post("/inventory", { preHandler: (0, guards_1.requireRole)(["STORE"]), config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, stores_controller_1.createInventoryItem);
    app.post("/inventory/bulk", { preHandler: (0, guards_1.requireRole)(["STORE"]), config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, stores_controller_1.bulkInventory);
    app.patch("/inventory/:id", { preHandler: (0, guards_1.requireRole)(["STORE"]), config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, stores_controller_1.updateInventoryItem);
    app.delete("/inventory/:id", { preHandler: (0, guards_1.requireRole)(["STORE"]), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, stores_controller_1.archiveInventoryItem);
}
