"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auctionRoutes = auctionRoutes;
const guards_1 = require("../../security/guards");
const auctions_controller_1 = require("./auctions.controller");
async function auctionRoutes(app) {
    app.get("/auctions", auctions_controller_1.listAuctions);
    app.get("/auctions/:id", auctions_controller_1.getAuction);
    app.post("/auctions", { preHandler: (0, guards_1.requireRole)(["SELLER", "STORE"]), config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, auctions_controller_1.createAuction);
    app.post("/auctions/:id/bids", { preHandler: guards_1.requireAuth, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, auctions_controller_1.placeBid);
}
