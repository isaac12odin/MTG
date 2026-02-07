"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPublic = listPublic;
exports.getById = getById;
exports.listMine = listMine;
exports.createListing = createListing;
exports.updateListing = updateListing;
exports.removeListing = removeListing;
const db_1 = require("../../db");
const jwt_1 = require("../../security/jwt");
const plan_1 = require("../../utils/plan");
const pagination_1 = require("../../utils/pagination");
const listings_model_1 = require("./listings.model");
async function maybeAuth(request) {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer "))
        return;
    const token = auth.slice("Bearer ".length);
    try {
        const payload = await (0, jwt_1.verifyAccessToken)(token);
        request.user = payload;
    }
    catch {
        return;
    }
}
async function listPublic(request, reply) {
    const parsed = listings_model_1.ListingQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, q, type, sellerId, gameId, setId, minPrice, maxPrice, condition, language, isFoil, country, state, city, } = parsed.data;
    const where = { status: "ACTIVE" };
    if (type)
        where.type = type;
    if (sellerId)
        where.sellerId = sellerId;
    if (condition)
        where.condition = condition;
    if (language)
        where.language = language;
    if (typeof isFoil === "boolean")
        where.isFoil = isFoil;
    if (minPrice || maxPrice) {
        where.askPrice = {};
        if (minPrice)
            where.askPrice.gte = minPrice;
        if (maxPrice)
            where.askPrice.lte = maxPrice;
    }
    if (q) {
        where.OR = [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
        ];
    }
    const itemCardWhere = { game: { status: "ACTIVE" } };
    if (gameId)
        itemCardWhere.gameId = gameId;
    if (setId)
        itemCardWhere.setId = setId;
    where.items = {
        some: {
            card: itemCardWhere,
        },
    };
    if (country || state || city) {
        const shippingFilter = {};
        if (country)
            shippingFilter.country = country.toUpperCase();
        if (state)
            shippingFilter.state = { contains: state, mode: "insensitive" };
        if (city)
            shippingFilter.city = { contains: city, mode: "insensitive" };
        where.shippingFrom = { is: shippingFilter };
    }
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.listing.count({ where }),
        db_1.prisma.listing.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take,
            select: (0, listings_model_1.listingSelect)(false),
        }),
    ]);
    return reply.send({
        data,
        pagination: (0, pagination_1.buildPagination)(page, pageSize, total),
    });
}
async function getById(request, reply) {
    await maybeAuth(request);
    const id = request.params.id;
    const base = await db_1.prisma.listing.findUnique({ where: { id }, select: { sellerId: true, status: true } });
    if (!base)
        return reply.code(404).send({ error: "Not found" });
    const isOwner = request.user?.sub === base.sellerId;
    if (isOwner) {
        const full = await db_1.prisma.listing.findUnique({ where: { id }, select: (0, listings_model_1.listingSelect)(true) });
        return reply.send({ data: full });
    }
    if (base.status !== "ACTIVE") {
        return reply.code(404).send({ error: "Not found" });
    }
    const listing = await db_1.prisma.listing.findFirst({
        where: {
            id,
            items: { some: { card: { game: { status: "ACTIVE" } } } },
        },
        select: (0, listings_model_1.listingSelect)(false),
    });
    if (!listing)
        return reply.code(404).send({ error: "Not found" });
    return reply.send({ data: listing });
}
async function listMine(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const data = await db_1.prisma.listing.findMany({
        where: { sellerId: userId },
        orderBy: { createdAt: "desc" },
        select: (0, listings_model_1.listingSelect)(true),
    });
    return reply.send({ data });
}
async function createListing(request, reply) {
    const body = listings_model_1.ListingCreateSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const plan = await (0, plan_1.getActivePlan)(userId);
    if (!plan)
        return reply.code(402).send({ error: "No active plan" });
    const usage = await (0, plan_1.getOrCreateUsage)(userId);
    if (plan.monthlyListingLimit && usage.listingsCreated >= plan.monthlyListingLimit) {
        return reply.code(403).send({ error: "Monthly listing limit reached" });
    }
    if (plan.activeListingLimit) {
        const activeCount = await db_1.prisma.listing.count({ where: { sellerId: userId, status: "ACTIVE" } });
        if (activeCount >= plan.activeListingLimit) {
            return reply.code(403).send({ error: "Active listing limit reached" });
        }
    }
    if (body.mediaAssetIds && plan.maxImagesPerListing) {
        if (body.mediaAssetIds.length > plan.maxImagesPerListing) {
            return reply.code(400).send({ error: "Too many images for your plan" });
        }
    }
    if (body.mediaAssetIds && body.mediaAssetIds.length > 0) {
        const ownedAssets = await db_1.prisma.mediaAsset.findMany({
            where: { id: { in: body.mediaAssetIds }, ownerId: userId, status: "READY" },
            select: { id: true },
        });
        if (ownedAssets.length !== body.mediaAssetIds.length) {
            return reply.code(400).send({ error: "Invalid media assets" });
        }
    }
    const cardIds = body.items.map((item) => item.cardId);
    const cards = await db_1.prisma.cardDefinition.findMany({
        where: { id: { in: cardIds } },
        include: { game: true },
    });
    if (cards.length !== cardIds.length) {
        return reply.code(400).send({ error: "Invalid cards" });
    }
    if (cards.some((card) => card.game.status !== "ACTIVE")) {
        return reply.code(400).send({ error: "Game is not available" });
    }
    const listing = await db_1.prisma.listing.create({
        data: {
            sellerId: userId,
            type: body.type,
            status: "ACTIVE",
            title: body.title,
            description: body.description,
            condition: body.condition,
            language: body.language,
            isFoil: body.isFoil,
            currency: body.currency,
            askPrice: body.askPrice,
            paymentWindowHours: body.paymentWindowHours,
            shippingFromAddressId: body.shippingFromAddressId,
            items: {
                create: body.items.map((item) => ({
                    cardId: item.cardId,
                    qty: item.qty,
                    notes: item.notes,
                    inventoryItemId: item.inventoryItemId,
                })),
            },
            media: body.mediaAssetIds
                ? {
                    create: body.mediaAssetIds.map((assetId, index) => ({ assetId, sortOrder: index })),
                }
                : undefined,
        },
        select: (0, listings_model_1.listingSelect)(true),
    });
    if (body.mediaAssetIds && body.mediaAssetIds.length > 0) {
        await db_1.prisma.mediaAsset.updateMany({
            where: { id: { in: body.mediaAssetIds } },
            data: { expiresAt: null },
        });
    }
    await db_1.prisma.planUsage.update({
        where: { id: usage.id },
        data: {
            listingsCreated: { increment: 1 },
            listingItemsCreated: { increment: body.items.length },
        },
    });
    return reply.code(201).send({ data: listing });
}
async function updateListing(request, reply) {
    const body = listings_model_1.ListingUpdateSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const id = request.params.id;
    const listing = await db_1.prisma.listing.findFirst({ where: { id, sellerId: userId } });
    if (!listing)
        return reply.code(404).send({ error: "Not found" });
    const plan = await (0, plan_1.getActivePlan)(userId);
    if (!plan)
        return reply.code(402).send({ error: "No active plan" });
    if (body.mediaAssetIds && plan.maxImagesPerListing) {
        if (body.mediaAssetIds.length > plan.maxImagesPerListing) {
            return reply.code(400).send({ error: "Too many images for your plan" });
        }
    }
    if (body.mediaAssetIds && body.mediaAssetIds.length > 0) {
        const ownedAssets = await db_1.prisma.mediaAsset.findMany({
            where: { id: { in: body.mediaAssetIds }, ownerId: userId, status: "READY" },
            select: { id: true },
        });
        if (ownedAssets.length !== body.mediaAssetIds.length) {
            return reply.code(400).send({ error: "Invalid media assets" });
        }
    }
    await db_1.prisma.$transaction(async (tx) => {
        if (body.items) {
            await tx.listingItem.deleteMany({ where: { listingId: id } });
            await tx.listingItem.createMany({
                data: body.items.map((item) => ({
                    listingId: id,
                    cardId: item.cardId,
                    qty: item.qty ?? 1,
                    notes: item.notes,
                    inventoryItemId: item.inventoryItemId,
                })),
            });
        }
        if (body.mediaAssetIds) {
            await tx.listingMedia.deleteMany({ where: { listingId: id } });
            await tx.listingMedia.createMany({
                data: body.mediaAssetIds.map((assetId, index) => ({ listingId: id, assetId, sortOrder: index })),
            });
        }
        await tx.listing.update({
            where: { id },
            data: {
                type: body.type,
                status: body.status,
                title: body.title,
                description: body.description,
                condition: body.condition,
                language: body.language,
                isFoil: body.isFoil,
                currency: body.currency,
                askPrice: body.askPrice,
                paymentWindowHours: body.paymentWindowHours,
                shippingFromAddressId: body.shippingFromAddressId,
            },
        });
    });
    if (body.mediaAssetIds && body.mediaAssetIds.length > 0) {
        await db_1.prisma.mediaAsset.updateMany({ where: { id: { in: body.mediaAssetIds } }, data: { expiresAt: null } });
    }
    const updated = await db_1.prisma.listing.findUnique({ where: { id }, select: (0, listings_model_1.listingSelect)(true) });
    return reply.send({ data: updated });
}
async function removeListing(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const id = request.params.id;
    const listing = await db_1.prisma.listing.findFirst({ where: { id, sellerId: userId } });
    if (!listing)
        return reply.code(404).send({ error: "Not found" });
    await db_1.prisma.listing.update({ where: { id }, data: { status: "REMOVED" } });
    return reply.send({ ok: true });
}
