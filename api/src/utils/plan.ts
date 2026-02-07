import { prisma } from "../db";

export type ActivePlan = {
  planId: string;
  monthlyListingLimit?: number | null;
  activeListingLimit?: number | null;
  monthlyImageLimit?: number | null;
  maxImagesPerListing?: number | null;
  eventLimit?: number | null;
};

export async function getActivePlan(userId: string): Promise<ActivePlan | null> {
  const now = new Date();
  const mensualidad = await prisma.mensualidad.findFirst({
    where: {
      userId,
      status: "PAGADO",
      periodStart: { lte: now },
      periodEnd: { gt: now },
    },
    include: { plan: true },
    orderBy: { periodStart: "desc" },
  });

  if (!mensualidad) return null;

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

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export async function getOrCreateUsage(userId: string) {
  const { start, end } = monthRange();
  return prisma.planUsage.upsert({
    where: { userId_periodStart_periodEnd: { userId, periodStart: start, periodEnd: end } },
    update: {},
    create: { userId, periodStart: start, periodEnd: end },
  });
}
