import { prisma } from "../db";

const prismaAny = prisma as any;

const DEFAULT_AUCTION_RELIST_DELAY_MIN = Number(
  process.env.DEFAULT_AUCTION_RELIST_DELAY_MIN ?? 10
);

function minutesToMs(minutes: number) {
  return minutes * 60 * 1000;
}

export async function activateScheduledAuctions() {
  const now = new Date();
  await prisma.auction.updateMany({
    where: {
      status: "SCHEDULED",
      startAt: { lte: now },
    },
    data: { status: "LIVE" },
  });
}

export async function closeEndedAuctions() {
  const now = new Date();
  const auctions = await prisma.auction.findMany({
    where: {
      status: "LIVE",
      endAt: { lte: now },
    },
    include: {
      listing: true,
    },
  });

  for (const auction of auctions) {
    const topBid = auction.topBidId
      ? await prisma.bid.findUnique({ where: { id: auction.topBidId } })
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.auction.update({
        where: { id: auction.id },
        data: { status: "ENDED" },
      });

      if (topBid) {
        await tx.listing.update({
          where: { id: auction.listingId },
          data: { status: "SOLD" },
        });

        const existingDeal = await tx.deal.findFirst({
          where: { listingId: auction.listingId, status: { in: ["SOLD", "PAYMENT_CONFIRMED", "SHIPPED", "DELIVERED", "COMPLETED"] } },
        });

        if (!existingDeal) {
          const paymentWindowHours = auction.listing.paymentWindowHours ?? 48;
          await tx.deal.create({
            data: {
              listingId: auction.listingId,
              sellerId: auction.listing.sellerId,
              buyerId: topBid.bidderId,
              status: "SOLD",
              paymentDueAt: new Date(Date.now() + paymentWindowHours * 60 * 60 * 1000),
            },
          });
        }
      } else {
        await tx.listing.update({
          where: { id: auction.listingId },
          data: { status: "CLOSED" },
        });
      }
    });
  }
}

export async function expireTradeOffers() {
  const now = new Date();
  await prisma.tradeOffer.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });
}

export async function cleanupExpiredMessages() {
  const now = new Date();
  await prisma.message.deleteMany({
    where: {
      expiresAt: { lte: now },
    },
  });
}

export async function cleanupExpiredMedia() {
  const now = new Date();
  await prisma.mediaAsset.deleteMany({
    where: {
      expiresAt: { lte: now },
    },
  });
}

export async function expireMensualidades() {
  const now = new Date();
  await prisma.mensualidad.updateMany({
    where: {
      status: "PENDIENTE",
      periodEnd: { lt: now },
    },
    data: { status: "VENCIDO" },
  });
}

export async function autoRelistUnpaidAuctions() {
  const now = new Date();
  const deals = await prisma.deal.findMany({
    where: {
      status: "SOLD",
      paymentDueAt: { lt: now },
    },
    include: {
      listing: { include: { auction: true } },
    },
  });

  for (const deal of deals) {
    const auction = deal.listing.auction;
    if (!auction) continue;
    if (!auction.autoRelistOnUnpaid) continue;

    const durationMs = auction.endAt.getTime() - auction.startAt.getTime();
    const delayMinutes = auction.autoRelistAfterHours
      ? auction.autoRelistAfterHours * 60
      : DEFAULT_AUCTION_RELIST_DELAY_MIN;
    const nextStart = new Date(Date.now() + minutesToMs(delayMinutes));
    const nextEnd = new Date(nextStart.getTime() + Math.max(durationMs, minutesToMs(60)));

    await prisma.$transaction(async (tx) => {
      await tx.bid.deleteMany({ where: { auctionId: auction.id } });
      await tx.auction.update({
        where: { id: auction.id },
        data: {
          status: "SCHEDULED",
          startAt: nextStart,
          endAt: nextEnd,
          topBidId: null,
          topAmount: null,
        },
      });

      await tx.listing.update({
        where: { id: deal.listingId },
        data: { status: "ACTIVE" },
      });

      await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: "UNPAID_RELISTED",
          unpaidRelistedAt: new Date(),
        },
      });
    });
  }
}

export async function recalcReputation() {
  type ReviewAggRow = {
    userId: string;
    reviewCount: number;
    positiveCount: number;
    negativeCount: number;
  };
  type CountRow = { userId: string; count: number };

  const [users, reviewAgg, salesAgg, buysAgg, unpaidAgg, disputeAgg] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.$queryRaw<ReviewAggRow[]>`
      SELECT "targetId" as "userId",
             COUNT(*)::int as "reviewCount",
             SUM(CASE WHEN "rating" >= 4 THEN 1 ELSE 0 END)::int as "positiveCount",
             SUM(CASE WHEN "rating" <= 2 THEN 1 ELSE 0 END)::int as "negativeCount"
      FROM "Review"
      GROUP BY "targetId"
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT "sellerId" as "userId", COUNT(*)::int as "count"
      FROM "Deal"
      WHERE "status" = 'COMPLETED'
      GROUP BY "sellerId"
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT "buyerId" as "userId", COUNT(*)::int as "count"
      FROM "Deal"
      WHERE "status" = 'COMPLETED'
      GROUP BY "buyerId"
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT "buyerId" as "userId", COUNT(*)::int as "count"
      FROM "Deal"
      WHERE "status" = 'UNPAID_RELISTED'
      GROUP BY "buyerId"
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT "userId", COUNT(*)::int as "count"
      FROM (
        SELECT "buyerId" as "userId" FROM "Deal" WHERE "status" = 'DISPUTED'
        UNION ALL
        SELECT "sellerId" as "userId" FROM "Deal" WHERE "status" = 'DISPUTED'
      ) t
      GROUP BY "userId"
    `,
  ]);

  const reviewMap = new Map<string, ReviewAggRow>();
  for (const row of reviewAgg) {
    reviewMap.set(row.userId, row);
  }

  const salesMap = new Map<string, number>();
  for (const row of salesAgg) salesMap.set(row.userId, row.count);

  const buysMap = new Map<string, number>();
  for (const row of buysAgg) buysMap.set(row.userId, row.count);

  const unpaidMap = new Map<string, number>();
  for (const row of unpaidAgg) unpaidMap.set(row.userId, row.count);

  const disputeMap = new Map<string, number>();
  for (const row of disputeAgg) disputeMap.set(row.userId, row.count);

  const updates = users.map((user) => {
    const review = reviewMap.get(user.id);
    const reviewCount = review?.reviewCount ?? 0;
    const positiveCount = review?.positiveCount ?? 0;
    const negativeCount = review?.negativeCount ?? 0;
    const completedSales = salesMap.get(user.id) ?? 0;
    const completedBuys = buysMap.get(user.id) ?? 0;
    const unpaidCount = unpaidMap.get(user.id) ?? 0;
    const disputeCount = disputeMap.get(user.id) ?? 0;

    const score =
      positiveCount * 10 -
      negativeCount * 15 +
      completedSales * 2 +
      completedBuys * 1 -
      unpaidCount * 20 -
      disputeCount * 10;
    const sellerScore =
      positiveCount * 8 +
      completedSales * 2 -
      unpaidCount * 20 -
      disputeCount * 10;
    const buyerScore =
      positiveCount * 4 +
      completedBuys * 1 -
      disputeCount * 8;

    return prismaAny.userReputation.upsert({
      where: { userId: user.id },
      update: {
        score,
        sellerScore,
        buyerScore,
        reviewCount,
        positiveCount,
        negativeCount,
        completedSales,
        completedBuys,
        unpaidCount,
        disputeCount,
        lastCalculatedAt: new Date(),
      },
      create: {
        userId: user.id,
        score,
        sellerScore,
        buyerScore,
        reviewCount,
        positiveCount,
        negativeCount,
        completedSales,
        completedBuys,
        unpaidCount,
        disputeCount,
        lastCalculatedAt: new Date(),
      },
    });
  });

  const CHUNK_SIZE = 200;
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    await prisma.$transaction(updates.slice(i, i + CHUNK_SIZE));
  }

  await prisma.$executeRaw`
    UPDATE "UserReputation" ur
    SET "sellerRank" = ranked.rn
    FROM (
      SELECT "userId", ROW_NUMBER() OVER (ORDER BY "sellerScore" DESC) AS rn
      FROM "UserReputation"
    ) ranked
    WHERE ur."userId" = ranked."userId"
  `;

  await prisma.$executeRaw`
    UPDATE "UserReputation" ur
    SET "buyerRank" = ranked.rn
    FROM (
      SELECT "userId", ROW_NUMBER() OVER (ORDER BY "buyerScore" DESC) AS rn
      FROM "UserReputation"
    ) ranked
    WHERE ur."userId" = ranked."userId"
  `;
}
