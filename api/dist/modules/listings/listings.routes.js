"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingRoutes = listingRoutes;
const guards_1 = require("../../security/guards");
const listings_controller_1 = require("./listings.controller");
async function listingRoutes(app) {
    app.get("/listings", listings_controller_1.listPublic);
    app.get("/listings/:id", listings_controller_1.getById);
    app.get("/me/listings", { preHandler: guards_1.requireAuth }, listings_controller_1.listMine);
    app.post("/listings", { preHandler: (0, guards_1.requireRole)(["SELLER", "STORE"]), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, listings_controller_1.createListing);
    app.patch("/listings/:id", { preHandler: (0, guards_1.requireRole)(["SELLER", "STORE"]), config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, listings_controller_1.updateListing);
    app.delete("/listings/:id", { preHandler: (0, guards_1.requireRole)(["SELLER", "STORE"]), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, listings_controller_1.removeListing);
}
