import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../security/guards";
import {
  register,
  resendOtp,
  verifyEmail,
  login,
  refresh,
  logout,
  listSessions,
  deleteSession,
} from "./auth.controller";

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, register);
  app.post("/otp/resend", { config: { rateLimit: { max: 3, timeWindow: "10 minutes" } } }, resendOtp);
  app.post("/verify-email", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, verifyEmail);
  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, login);
  app.post("/refresh", refresh);
  app.post("/logout", logout);
  app.get("/sessions", { preHandler: requireAuth }, listSessions);
  app.delete("/sessions/:id", { preHandler: requireAuth }, deleteSession);
}
