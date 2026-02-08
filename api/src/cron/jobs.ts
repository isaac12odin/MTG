import { prisma } from "../db";

const prismaAny = prisma as any;

const DEFAULT_AUCTION_RELIST_DELAY_MIN = Number(
  process.env.DEFAULT_AUCTION_RELIST_DELAY_MIN ?? 10
);
const PENDING_REG_TTL_MINUTES = Number(process.env.PENDING_REG_TTL_MINUTES ?? 3);

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

export async function cleanupPendingRegistrations() {
  const cutoff = new Date(Date.now() - PENDING_REG_TTL_MINUTES * 60 * 1000);
  await prisma.user.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [{ security: { is: { emailVerifiedAt: null } } }, { security: { is: null } }],
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
  await prisma.$executeRaw`
    WITH reviews AS (
      SELECT "targetId" AS "userId",
             COUNT(*)::int AS "reviewCount",
             SUM(CASE WHEN "rating" >= 4 THEN 1 ELSE 0 END)::int AS "positiveCount",
             SUM(CASE WHEN "rating" <= 2 THEN 1 ELSE 0 END)::int AS "negativeCount"
      FROM "Review"
      GROUP BY "targetId"
    ),
    sales AS (
      SELECT "sellerId" AS "userId", COUNT(*)::int AS "completedSales"
      FROM "Deal"
      WHERE "status" = 'COMPLETED'
      GROUP BY "sellerId"
    ),
    buys AS (
      SELECT "buyerId" AS "userId", COUNT(*)::int AS "completedBuys"
      FROM "Deal"
      WHERE "status" = 'COMPLETED'
      GROUP BY "buyerId"
    ),
    unpaids AS (
      SELECT "buyerId" AS "userId", COUNT(*)::int AS "unpaidCount"
      FROM "Deal"
      WHERE "status" = 'UNPAID_RELISTED'
      GROUP BY "buyerId"
    ),
    disputes AS (
      SELECT "userId", COUNT(*)::int AS "disputeCount"
      FROM (
        SELECT "buyerId" AS "userId" FROM "Deal" WHERE "status" = 'DISPUTED'
        UNION ALL
        SELECT "sellerId" AS "userId" FROM "Deal" WHERE "status" = 'DISPUTED'
      ) t
      GROUP BY "userId"
    )
    INSERT INTO "UserReputation" (
      "userId",
      "score",
      "sellerScore",
      "buyerScore",
      "reviewCount",
      "positiveCount",
      "negativeCount",
      "completedSales",
      "completedBuys",
      "unpaidCount",
      "disputeCount",
      "lastCalculatedAt",
      "updatedAt",
      "createdAt"
    )
    SELECT
      u.id,
      (COALESCE(r."positiveCount", 0) * 10) - (COALESCE(r."negativeCount", 0) * 15)
        + (COALESCE(s."completedSales", 0) * 2) + (COALESCE(b."completedBuys", 0) * 1)
        - (COALESCE(u2."unpaidCount", 0) * 20) - (COALESCE(d."disputeCount", 0) * 10) AS "score",
      (COALESCE(r."positiveCount", 0) * 8) + (COALESCE(s."completedSales", 0) * 2)
        - (COALESCE(u2."unpaidCount", 0) * 20) - (COALESCE(d."disputeCount", 0) * 10) AS "sellerScore",
      (COALESCE(r."positiveCount", 0) * 4) + (COALESCE(b."completedBuys", 0) * 1)
        - (COALESCE(d."disputeCount", 0) * 8) AS "buyerScore",
      COALESCE(r."reviewCount", 0) AS "reviewCount",
      COALESCE(r."positiveCount", 0) AS "positiveCount",
      COALESCE(r."negativeCount", 0) AS "negativeCount",
      COALESCE(s."completedSales", 0) AS "completedSales",
      COALESCE(b."completedBuys", 0) AS "completedBuys",
      COALESCE(u2."unpaidCount", 0) AS "unpaidCount",
      COALESCE(d."disputeCount", 0) AS "disputeCount",
      NOW() AS "lastCalculatedAt",
      NOW() AS "updatedAt",
      NOW() AS "createdAt"
    FROM "User" u
    LEFT JOIN reviews r ON u.id = r."userId"
    LEFT JOIN sales s ON u.id = s."userId"
    LEFT JOIN buys b ON u.id = b."userId"
    LEFT JOIN unpaids u2 ON u.id = u2."userId"
    LEFT JOIN disputes d ON u.id = d."userId"
    ON CONFLICT ("userId") DO UPDATE SET
      "score" = EXCLUDED."score",
      "sellerScore" = EXCLUDED."sellerScore",
      "buyerScore" = EXCLUDED."buyerScore",
      "reviewCount" = EXCLUDED."reviewCount",
      "positiveCount" = EXCLUDED."positiveCount",
      "negativeCount" = EXCLUDED."negativeCount",
      "completedSales" = EXCLUDED."completedSales",
      "completedBuys" = EXCLUDED."completedBuys",
      "unpaidCount" = EXCLUDED."unpaidCount",
      "disputeCount" = EXCLUDED."disputeCount",
      "lastCalculatedAt" = NOW(),
      "updatedAt" = NOW()
  `;

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
