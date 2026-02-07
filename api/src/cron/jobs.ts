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
  const users = await prisma.user.findMany({
    select: {
      id: true,
      roles: { select: { role: true } },
    },
  });

  for (const user of users) {
    const [reviewCount, positiveCount, negativeCount, completedSales, completedBuys, unpaidCount, disputeCount] =
      await Promise.all([
        prisma.review.count({ where: { targetId: user.id } }),
        prisma.review.count({ where: { targetId: user.id, rating: { gte: 4 } } }),
        prisma.review.count({ where: { targetId: user.id, rating: { lte: 2 } } }),
        prisma.deal.count({ where: { sellerId: user.id, status: "COMPLETED" } }),
        prisma.deal.count({ where: { buyerId: user.id, status: "COMPLETED" } }),
        prisma.deal.count({ where: { buyerId: user.id, status: "UNPAID_RELISTED" } }),
        prisma.deal.count({ where: { status: "DISPUTED", OR: [{ buyerId: user.id }, { sellerId: user.id }] } }),
      ]);

    const score = positiveCount * 10 - negativeCount * 15 + completedSales * 2 + completedBuys * 1 - unpaidCount * 20 - disputeCount * 10;
    const sellerScore = positiveCount * 8 + completedSales * 2 - unpaidCount * 20 - disputeCount * 10;
    const buyerScore = positiveCount * 4 + completedBuys * 1 - disputeCount * 8;

    await prismaAny.userReputation.upsert({
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
  }

  const reputations = await prismaAny.userReputation.findMany({
    orderBy: { sellerScore: "desc" },
  });

  let sellerRank = 1;
  for (const rep of reputations) {
    await prismaAny.userReputation.update({
      where: { userId: rep.userId },
      data: { sellerRank },
    });
    sellerRank += 1;
  }

  const buyerRanks = await prismaAny.userReputation.findMany({
    orderBy: { buyerScore: "desc" },
  });

  let buyerRank = 1;
  for (const rep of buyerRanks) {
    await prismaAny.userReputation.update({
      where: { userId: rep.userId },
      data: { buyerRank },
    });
    buyerRank += 1;
  }
}
