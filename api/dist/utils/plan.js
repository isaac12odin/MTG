"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivePlan = getActivePlan;
exports.monthRange = monthRange;
exports.getOrCreateUsage = getOrCreateUsage;
const db_1 = require("../db");
async function getActivePlan(userId) {
    const now = new Date();
    const mensualidad = await db_1.prisma.mensualidad.findFirst({
        where: {
            userId,
            status: "PAGADO",
            periodStart: { lte: now },
            periodEnd: { gt: now },
        },
        include: { plan: true },
        orderBy: { periodStart: "desc" },
    });
    if (!mensualidad)
        return null;
    const plan = mensualidad.plan;
    return {
        planId: plan.id,
        monthlyListingLimit: plan.monthlyListingLimit,
        activeListingLimit: plan.activeListingLimit,
        monthlyImageLimit: plan.monthlyImageLimit,
        maxImagesPerListing: plan.maxImagesPerListing,
        eventLimit: plan.eventLimit,
    };
}
function monthRange(date = new Date()) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
}
async function getOrCreateUsage(userId) {
    const { start, end } = monthRange();
    return db_1.prisma.planUsage.upsert({
        where: { userId_periodStart_periodEnd: { userId, periodStart: start, periodEnd: end } },
        update: {},
        create: { userId, periodStart: start, periodEnd: end },
    });
}
