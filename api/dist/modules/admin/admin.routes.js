"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = adminRoutes;
const guards_1 = require("../../security/guards");
const admin_controller_1 = require("./admin.controller");
async function adminRoutes(app) {
    const guard = { preHandler: (0, guards_1.requireRole)(["ADMIN", "MOD"]) };
    app.get("/admin/games", guard, admin_controller_1.listGamesAdmin);
    app.post("/admin/games", guard, admin_controller_1.createGameAdmin);
    app.patch("/admin/games/:id", guard, admin_controller_1.updateGameAdmin);
    app.get("/admin/verifications", guard, admin_controller_1.listVerificationRequests);
    app.post("/admin/verifications/:id/decision", guard, admin_controller_1.decideVerificationRequest);
    app.get("/admin/payments", guard, admin_controller_1.listPaymentAlerts);
    app.post("/admin/payments/:id/verify", guard, admin_controller_1.verifyPayment);
}
