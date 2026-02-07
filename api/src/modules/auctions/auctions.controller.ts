import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../db";
import { buildPagination, paginate } from "../../utils/pagination";
import { AuctionCreateSchema, AuctionQuery, BidSchema } from "./auctions.model";

export async function listAuctions(request: FastifyRequest, reply: FastifyReply) {
  const parsed = AuctionQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });

  const { page, pageSize, status } = parsed.data;
  const where: any = {};
  if (status) where.status = status;

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.auction.count({ where }),
    prisma.auction.findMany({
      where,
      include: { listing: true },
      orderBy: { endAt: "asc" },
      skip,
      take,
    }),
  ]);

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function getAuction(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: { listing: true, bids: true },
  });
  if (!auction) return reply.code(404).send({ error: "Not found" });

  return reply.send({ data: auction });
}

export async function createAuction(request: FastifyRequest, reply: FastifyReply) {
  const body = AuctionCreateSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const listing = await prisma.listing.findFirst({ where: { id: body.listingId, sellerId: userId } });
  if (!listing) return reply.code(404).send({ error: "Listing not found" });
  if (listing.type !== "AUCTION") return reply.code(400).send({ error: "Listing is not auction type" });

  const existing = await prisma.auction.findUnique({ where: { listingId: body.listingId } });
  if (existing) return reply.code(409).send({ error: "Auction already exists" });

  const auction = await prisma.auction.create({
    data: {
      listingId: listing.id,
      status: body.startAt <= new Date() ? "LIVE" : "SCHEDULED",
      startAt: body.startAt,
      endAt: body.endAt,
      startPrice: body.startPrice,
      increment: body.increment,
      reservePrice: body.reservePrice,
      buyNowPrice: body.buyNowPrice,
      autoRelistOnUnpaid: body.autoRelistOnUnpaid ?? false,
      autoRelistAfterHours: body.autoRelistAfterHours,
    },
  });

  return reply.code(201).send({ data: auction });
}

export async function placeBid(request: FastifyRequest, reply: FastifyReply) {
  const body = BidSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const security = await prisma.userSecurity.findUnique({ where: { userId } });
  if (!security?.manualVerifiedAt) return reply.code(403).send({ error: "User not verified" });

  const auctionId = (request.params as { id: string }).id;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Auction" WHERE id = ${auctionId} FOR UPDATE`;
    const auction = await tx.auction.findUnique({ where: { id: auctionId }, include: { listing: true } });
    if (!auction) return { error: "Auction not found" } as const;
    if (auction.status !== "LIVE" || auction.startAt > now || auction.endAt < now) {
      return { error: "Auction not live" } as const;
    }
    if (auction.listing.sellerId === userId) return { error: "Cannot bid on your own listing" } as const;

    const minBid = Math.max(
      auction.startPrice.toNumber(),
      auction.topAmount ? auction.topAmount.toNumber() + auction.increment.toNumber() : 0
    );
    if (body.amount < minBid) return { error: `Bid too low. Minimum ${minBid}` } as const;

    const bid = await tx.bid.create({
      data: { auctionId: auction.id, bidderId: userId, amount: body.amount },
    });

    let auctionUpdate: any = { topBidId: bid.id, topAmount: bid.amount };
    let dealCreated = false;

    if (auction.buyNowPrice && body.amount >= auction.buyNowPrice.toNumber()) {
      auctionUpdate.status = "ENDED";
      await tx.listing.update({ where: { id: auction.listingId }, data: { status: "SOLD" } });
      await tx.deal.create({
        data: {
          listingId: auction.listingId,
          sellerId: auction.listing.sellerId,
          buyerId: userId,
          status: "SOLD",
          paymentDueAt: new Date(Date.now() + (auction.listing.paymentWindowHours ?? 48) * 60 * 60 * 1000),
        },
      });
      dealCreated = true;
    }

    await tx.auction.update({ where: { id: auction.id }, data: auctionUpdate });

    return { bid, dealCreated } as const;
  });

  if ((result as any).error) return reply.code(400).send({ error: (result as any).error });

  return reply.code(201).send({ data: result });
}
