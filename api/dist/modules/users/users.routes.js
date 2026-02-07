"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = userRoutes;
const guards_1 = require("../../security/guards");
const users_controller_1 = require("./users.controller");
async function userRoutes(app) {
    app.get("/me", { preHandler: guards_1.requireAuth }, users_controller_1.getMe);
    app.put("/me/profile", { preHandler: guards_1.requireAuth }, users_controller_1.upsertProfile);
    app.get("/me/addresses", { preHandler: guards_1.requireAuth }, users_controller_1.listAddresses);
    app.post("/me/addresses", { preHandler: guards_1.requireAuth }, users_controller_1.createAddress);
    app.put("/me/addresses/:id", { preHandler: guards_1.requireAuth }, users_controller_1.updateAddress);
    app.delete("/me/addresses/:id", { preHandler: guards_1.requireAuth }, users_controller_1.deleteAddress);
    app.post("/me/addresses/:id/default", { preHandler: guards_1.requireAuth }, users_controller_1.setDefaultAddress);
    app.post("/me/verification-requests", { preHandler: guards_1.requireAuth }, users_controller_1.requestVerification);
    app.get("/users/:id", users_controller_1.getPublicProfile);
    app.post("/users/:id/follow", { preHandler: guards_1.requireAuth }, users_controller_1.followUser);
    app.delete("/users/:id/follow", { preHandler: guards_1.requireAuth }, users_controller_1.unfollowUser);
    app.get("/users/:id/followers", users_controller_1.listFollowers);
    app.get("/users/:id/following", users_controller_1.listFollowing);
}
