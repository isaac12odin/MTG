"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const guards_1 = require("../../security/guards");
const auth_controller_1 = require("./auth.controller");
async function authRoutes(app) {
    app.post("/register", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, auth_controller_1.register);
    app.post("/otp/resend", { config: { rateLimit: { max: 3, timeWindow: "10 minutes" } } }, auth_controller_1.resendOtp);
    app.post("/verify-email", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, auth_controller_1.verifyEmail);
    app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, auth_controller_1.login);
    app.post("/refresh", auth_controller_1.refresh);
    app.post("/logout", auth_controller_1.logout);
    app.get("/sessions", { preHandler: guards_1.requireAuth }, auth_controller_1.listSessions);
    app.delete("/sessions/:id", { preHandler: guards_1.requireAuth }, auth_controller_1.deleteSession);
}
