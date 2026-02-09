"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plansRoutes = plansRoutes;
const guards_1 = require("../../security/guards");
const plans_controller_1 = require("./plans.controller");
async function plansRoutes(app) {
    app.get("/plans", plans_controller_1.listPlans);
    app.get("/me/plan", { preHandler: guards_1.requireAuth }, plans_controller_1.getMyPlan);
    app.post("/plans/subscribe", { preHandler: guards_1.requireAuth }, plans_controller_1.subscribePlan);
}
