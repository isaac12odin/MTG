import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../db";
import { monthRange } from "../../utils/plan";
import { SubscribePlanSchema } from "./plans.model";

export async function listPlans(_request: FastifyRequest, reply: FastifyReply) {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: [{ priceMXN: "asc" }],
  });

  return reply.send({ data: plans });
}

export async function getMyPlan(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const now = new Date();
  const active = await prisma.mensualidad.findFirst({
    where: {
      userId,
      status: "PAGADO",
      periodStart: { lte: now },
      periodEnd: { gt: now },
    },
    include: { plan: true },
    orderBy: { periodStart: "desc" },
  });

  const pending = await prisma.mensualidad.findFirst({
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

export async function subscribePlan(request: FastifyRequest, reply: FastifyReply) {
  const body = SubscribePlanSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const plan = await prisma.plan.findFirst({ where: { id: body.planId, isActive: true } });
  if (!plan) return reply.code(404).send({ error: "Plan not found" });

  const { start, end } = monthRange();
  const existing = await prisma.mensualidad.findFirst({
    where: { userId, periodStart: start, periodEnd: end },
  });

  if (existing) {
    if (existing.status === "PAGADO") {
      return reply.code(409).send({ error: "Plan already active for this period" });
    }

    const updated = await prisma.mensualidad.update({
      where: { id: existing.id },
      data: {
        planId: plan.id,
        status: "PENDIENTE",
      },
      include: { plan: true },
    });

    return reply.send({ data: updated, pending: true });
  }

  const created = await prisma.mensualidad.create({
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
