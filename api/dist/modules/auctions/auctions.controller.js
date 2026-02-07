"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuctions = listAuctions;
exports.getAuction = getAuction;
exports.createAuction = createAuction;
exports.placeBid = placeBid;
const db_1 = require("../../db");
const pagination_1 = require("../../utils/pagination");
const auctions_model_1 = require("./auctions.model");
async function listAuctions(request, reply) {
    const parsed = auctions_model_1.AuctionQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, status, country, state, city } = parsed.data;
    const where = {};
    if (status)
        where.status = status;
    const listingWhere = {
        items: { some: { card: { game: { status: "ACTIVE" } } } },
    };
    if (country || state || city) {
        const shippingFilter = {};
        if (country)
            shippingFilter.country = country.toUpperCase();
        if (state)
            shippingFilter.state = { contains: state, mode: "insensitive" };
        if (city)
            shippingFilter.city = { contains: city, mode: "insensitive" };
        listingWhere.shippingFrom = { is: shippingFilter };
    }
    where.listing = listingWhere;
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.auction.count({ where }),
        db_1.prisma.auction.findMany({
            where,
            include: { listing: { include: { shippingFrom: true } } },
            orderBy: { endAt: "asc" },
            skip,
            take,
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function getAuction(request, reply) {
    const id = request.params.id;
    const auction = await db_1.prisma.auction.findFirst({
        where: { id, listing: { items: { some: { card: { game: { status: "ACTIVE" } } } } } },
        include: { listing: true, bids: true },
    });
    if (!auction)
        return reply.code(404).send({ error: "Not found" });
    return reply.send({ data: auction });
}
async function createAuction(request, reply) {
    const body = auctions_model_1.AuctionCreateSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const listing = await db_1.prisma.listing.findFirst({ where: { id: body.listingId, sellerId: userId } });
    if (!listing)
        return reply.code(404).send({ error: "Listing not found" });
    if (listing.type !== "AUCTION")
        return reply.code(400).send({ error: "Listing is not auction type" });
    const existing = await db_1.prisma.auction.findUnique({ where: { listingId: body.listingId } });
    if (existing)
        return reply.code(409).send({ error: "Auction already exists" });
    const auction = await db_1.prisma.auction.create({
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
async function placeBid(request, reply) {
    const body = auctions_model_1.BidSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const security = await db_1.prisma.userSecurity.findUnique({ where: { userId } });
    if (!security?.manualVerifiedAt)
        return reply.code(403).send({ error: "User not verified" });
    const auctionId = request.params.id;
    const now = new Date();
    const result = await db_1.prisma.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT id FROM "Auction" WHERE id = ${auctionId} FOR UPDATE`;
        const auction = await tx.auction.findUnique({ where: { id: auctionId }, include: { listing: true } });
        if (!auction)
            return { error: "Auction not found" };
        if (auction.status !== "LIVE" || auction.startAt > now || auction.endAt < now) {
            return { error: "Auction not live" };
        }
        if (auction.listing.sellerId === userId)
            return { error: "Cannot bid on your own listing" };
        const minBid = Math.max(auction.startPrice.toNumber(), auction.topAmount ? auction.topAmount.toNumber() + auction.increment.toNumber() : 0);
        if (body.amount < minBid)
            return { error: `Bid too low. Minimum ${minBid}` };
        const bid = await tx.bid.create({
            data: { auctionId: auction.id, bidderId: userId, amount: body.amount },
        });
        let auctionUpdate = { topBidId: bid.id, topAmount: bid.amount };
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
        return { bid, dealCreated };
    });
    if (result.error)
        return reply.code(400).send({ error: result.error });
    return reply.code(201).send({ data: result });
}
