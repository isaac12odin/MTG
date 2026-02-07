"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateScheduledAuctions = activateScheduledAuctions;
exports.closeEndedAuctions = closeEndedAuctions;
exports.expireTradeOffers = expireTradeOffers;
exports.cleanupExpiredMessages = cleanupExpiredMessages;
exports.cleanupExpiredMedia = cleanupExpiredMedia;
exports.expireMensualidades = expireMensualidades;
exports.autoRelistUnpaidAuctions = autoRelistUnpaidAuctions;
exports.recalcReputation = recalcReputation;
const db_1 = require("../db");
const prismaAny = db_1.prisma;
const DEFAULT_AUCTION_RELIST_DELAY_MIN = Number(process.env.DEFAULT_AUCTION_RELIST_DELAY_MIN ?? 10);
function minutesToMs(minutes) {
    return minutes * 60 * 1000;
}
async function activateScheduledAuctions() {
    const now = new Date();
    await db_1.prisma.auction.updateMany({
        where: {
            status: "SCHEDULED",
            startAt: { lte: now },
        },
        data: { status: "LIVE" },
    });
}
async function closeEndedAuctions() {
    const now = new Date();
    const auctions = await db_1.prisma.auction.findMany({
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
            ? await db_1.prisma.bid.findUnique({ where: { id: auction.topBidId } })
            : null;
        await db_1.prisma.$transaction(async (tx) => {
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
            }
            else {
                await tx.listing.update({
                    where: { id: auction.listingId },
                    data: { status: "CLOSED" },
                });
            }
        });
    }
}
async function expireTradeOffers() {
    const now = new Date();
    await db_1.prisma.tradeOffer.updateMany({
        where: {
            status: "PENDING",
            expiresAt: { lte: now },
        },
        data: { status: "EXPIRED" },
    });
}
async function cleanupExpiredMessages() {
    const now = new Date();
    await db_1.prisma.message.deleteMany({
        where: {
            expiresAt: { lte: now },
        },
    });
}
async function cleanupExpiredMedia() {
    const now = new Date();
    await db_1.prisma.mediaAsset.deleteMany({
        where: {
            expiresAt: { lte: now },
        },
    });
}
async function expireMensualidades() {
    const now = new Date();
    await db_1.prisma.mensualidad.updateMany({
        where: {
            status: "PENDIENTE",
            periodEnd: { lt: now },
        },
        data: { status: "VENCIDO" },
    });
}
async function autoRelistUnpaidAuctions() {
    const now = new Date();
    const deals = await db_1.prisma.deal.findMany({
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
        if (!auction)
            continue;
        if (!auction.autoRelistOnUnpaid)
            continue;
        const durationMs = auction.endAt.getTime() - auction.startAt.getTime();
        const delayMinutes = auction.autoRelistAfterHours
            ? auction.autoRelistAfterHours * 60
            : DEFAULT_AUCTION_RELIST_DELAY_MIN;
        const nextStart = new Date(Date.now() + minutesToMs(delayMinutes));
        const nextEnd = new Date(nextStart.getTime() + Math.max(durationMs, minutesToMs(60)));
        await db_1.prisma.$transaction(async (tx) => {
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
async function recalcReputation() {
    const [users, reviewAgg, salesAgg, buysAgg, unpaidAgg, disputeAgg] = await Promise.all([
        db_1.prisma.user.findMany({ select: { id: true } }),
        db_1.prisma.$queryRaw `
      SELECT "targetId" as "userId",
             COUNT(*)::int as "reviewCount",
             SUM(CASE WHEN "rating" >= 4 THEN 1 ELSE 0 END)::int as "positiveCount",
             SUM(CASE WHEN "rating" <= 2 THEN 1 ELSE 0 END)::int as "negativeCount"
      FROM "Review"
      GROUP BY "targetId"
    `,
        db_1.prisma.$queryRaw `
      SELECT "sellerId" as "userId", COUNT(*)::int as "count"
      FROM "Deal"
      WHERE "status" = 'COMPLETED'
      GROUP BY "sellerId"
    `,
        db_1.prisma.$queryRaw `
      SELECT "buyerId" as "userId", COUNT(*)::int as "count"
      FROM "Deal"
      WHERE "status" = 'COMPLETED'
      GROUP BY "buyerId"
    `,
        db_1.prisma.$queryRaw `
      SELECT "buyerId" as "userId", COUNT(*)::int as "count"
      FROM "Deal"
      WHERE "status" = 'UNPAID_RELISTED'
      GROUP BY "buyerId"
    `,
        db_1.prisma.$queryRaw `
      SELECT "userId", COUNT(*)::int as "count"
      FROM (
        SELECT "buyerId" as "userId" FROM "Deal" WHERE "status" = 'DISPUTED'
        UNION ALL
        SELECT "sellerId" as "userId" FROM "Deal" WHERE "status" = 'DISPUTED'
      ) t
      GROUP BY "userId"
    `,
    ]);
    const reviewMap = new Map();
    for (const row of reviewAgg) {
        reviewMap.set(row.userId, row);
    }
    const salesMap = new Map();
    for (const row of salesAgg)
        salesMap.set(row.userId, row.count);
    const buysMap = new Map();
    for (const row of buysAgg)
        buysMap.set(row.userId, row.count);
    const unpaidMap = new Map();
    for (const row of unpaidAgg)
        unpaidMap.set(row.userId, row.count);
    const disputeMap = new Map();
    for (const row of disputeAgg)
        disputeMap.set(row.userId, row.count);
    const updates = users.map((user) => {
        const review = reviewMap.get(user.id);
        const reviewCount = review?.reviewCount ?? 0;
        const positiveCount = review?.positiveCount ?? 0;
        const negativeCount = review?.negativeCount ?? 0;
        const completedSales = salesMap.get(user.id) ?? 0;
        const completedBuys = buysMap.get(user.id) ?? 0;
        const unpaidCount = unpaidMap.get(user.id) ?? 0;
        const disputeCount = disputeMap.get(user.id) ?? 0;
        const score = positiveCount * 10 -
            negativeCount * 15 +
            completedSales * 2 +
            completedBuys * 1 -
            unpaidCount * 20 -
            disputeCount * 10;
        const sellerScore = positiveCount * 8 +
            completedSales * 2 -
            unpaidCount * 20 -
            disputeCount * 10;
        const buyerScore = positiveCount * 4 +
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
        await db_1.prisma.$transaction(updates.slice(i, i + CHUNK_SIZE));
    }
    await db_1.prisma.$executeRaw `
    UPDATE "UserReputation" ur
    SET "sellerRank" = ranked.rn
    FROM (
      SELECT "userId", ROW_NUMBER() OVER (ORDER BY "sellerScore" DESC) AS rn
      FROM "UserReputation"
    ) ranked
    WHERE ur."userId" = ranked."userId"
  `;
    await db_1.prisma.$executeRaw `
    UPDATE "UserReputation" ur
    SET "buyerRank" = ranked.rn
    FROM (
      SELECT "userId", ROW_NUMBER() OVER (ORDER BY "buyerScore" DESC) AS rn
      FROM "UserReputation"
    ) ranked
    WHERE ur."userId" = ranked."userId"
  `;
}
