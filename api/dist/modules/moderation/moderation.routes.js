"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moderationRoutes = moderationRoutes;
const guards_1 = require("../../security/guards");
const moderation_controller_1 = require("./moderation.controller");
async function moderationRoutes(app) {
    app.post("/users/:id/verify", { preHandler: (0, guards_1.requireRole)(["ADMIN", "MOD"]) }, moderation_controller_1.verifyUser);
    app.post("/reviews/:id/hide", { preHandler: (0, guards_1.requireRole)(["ADMIN", "MOD"]) }, moderation_controller_1.hideReview);
    app.get("/chat/active", { preHandler: (0, guards_1.requireRole)(["ADMIN", "MOD"]) }, moderation_controller_1.getChatStats);
}
