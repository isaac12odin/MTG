"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPlans = listPlans;
exports.getMyPlan = getMyPlan;
exports.subscribePlan = subscribePlan;
const db_1 = require("../../db");
const plan_1 = require("../../utils/plan");
const plans_model_1 = require("./plans.model");
async function listPlans(_request, reply) {
    const plans = await db_1.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: [{ priceMXN: "asc" }],
    });
    return reply.send({ data: plans });
}
async function getMyPlan(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const now = new Date();
    const active = await db_1.prisma.mensualidad.findFirst({
        where: {
            userId,
            status: "PAGADO",
            periodStart: { lte: now },
            periodEnd: { gt: now },
        },
        include: { plan: true },
        orderBy: { periodStart: "desc" },
    });
    const pending = await db_1.prisma.mensualidad.findFirst({
        where: {
            userId,
            status: { in: ["PENDIENTE", "VENCIDO"] },
            periodEnd: { gt: now },
        },
        include: { plan: true },
        orderBy: { periodStart: "desc" },
    });
    const activePlan = active
        ? {
            status: active.status,
            periodStart: active.periodStart,
            periodEnd: active.periodEnd,
            plan: active.plan,
        }
        : null;
    const pendingPlan = pending
        ? {
            status: pending.status,
            periodStart: pending.periodStart,
            periodEnd: pending.periodEnd,
            plan: pending.plan,
        }
        : null;
    return reply.send({ data: { active: activePlan, pending: pendingPlan } });
}
async function subscribePlan(request, reply) {
    const body = plans_model_1.SubscribePlanSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const plan = await db_1.prisma.plan.findFirst({ where: { id: body.planId, isActive: true } });
    if (!plan)
        return reply.code(404).send({ error: "Plan not found" });
    const { start, end } = (0, plan_1.monthRange)();
    const existing = await db_1.prisma.mensualidad.findFirst({
        where: { userId, periodStart: start, periodEnd: end },
    });
    if (existing) {
        if (existing.status === "PAGADO") {
            return reply.code(409).send({ error: "Plan already active for this period" });
        }
        const updated = await db_1.prisma.mensualidad.update({
            where: { id: existing.id },
            data: {
                planId: plan.id,
                status: "PENDIENTE",
            },
            include: { plan: true },
        });
        return reply.send({ data: updated, pending: true });
    }
    const created = await db_1.prisma.mensualidad.create({
        data: {
            userId,
            planId: plan.id,
            periodStart: start,
            periodEnd: end,
            status: "PENDIENTE",
        },
        include: { plan: true },
    });
    return reply.code(201).send({ data: created, pending: true });
}
