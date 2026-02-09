import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../security/guards";
import { getMyPlan, listPlans, subscribePlan } from "./plans.controller";

export async function plansRoutes(app: FastifyInstance) {
  app.get("/plans", listPlans);
  app.get("/me/plan", { preHandler: requireAuth }, getMyPlan);
  app.post("/plans/subscribe", { preHandler: requireAuth }, subscribePlan);
}
