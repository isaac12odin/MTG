"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingRoutes = listingRoutes;
const zod_1 = require("zod");
const db_1 = require("../db");
const guards_1 = require("../security/guards");
const jwt_1 = require("../security/jwt");
const plan_1 = require("../utils/plan");
const ListingQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    q: zod_1.z.string().optional(),
    type: zod_1.z.enum(["FIXED", "AUCTION", "TRADE"]).optional(),
    sellerId: zod_1.z.string().uuid().optional(),
    gameId: zod_1.z.string().uuid().optional(),
    setId: zod_1.z.string().uuid().optional(),
    minPrice: zod_1.z.coerce.number().optional(),
    maxPrice: zod_1.z.coerce.number().optional(),
    condition: zod_1.z.string().optional(),
    language: zod_1.z.string().optional(),
    isFoil: zod_1.z.coerce.boolean().optional(),
});
const ListingCreateSchema = zod_1.z.object({
    type: zod_1.z.enum(["FIXED", "AUCTION", "TRADE"]),
    title: zod_1.z.string().min(3).max(120),
    description: zod_1.z.string().max(4000).optional(),
    condition: zod_1.z.string().optional(),
    language: zod_1.z.string().optional(),
    isFoil: zod_1.z.boolean().optional(),
    currency: zod_1.z.string().default("MXN"),
    askPrice: zod_1.z.number().optional(),
    paymentWindowHours: zod_1.z.number().int().min(1).max(168).optional(),
    shippingFromAddressId: zod_1.z.string().uuid().optional(),
    items: zod_1.z.array(zod_1.z.object({
        cardId: zod_1.z.string().uuid(),
        qty: zod_1.z.number().int().min(1).max(999).default(1),
        notes: zod_1.z.string().optional(),
        inventoryItemId: zod_1.z.string().uuid().optional(),
    })),
    mediaAssetIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
const ListingUpdateSchema = ListingCreateSchema.partial().extend({
    status: zod_1.z.enum(["DRAFT", "ACTIVE", "SOLD", "CLOSED", "REMOVED"]).optional(),
});
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
function listingSelect(isOwner) {
    return {
        id: true,
        sellerId: true,
        type: true,
        status: true,
        title: true,
        description: true,
        condition: true,
        language: true,
        isFoil: true,
        currency: true,
        askPrice: true,
        paymentWindowHours: isOwner,
        createdAt: true,
        updatedAt: true,
        items: {
            include: {
                card: true,
                inventoryItem: true,
            },
        },
        media: {
            include: {
                asset: {
                    include: { variants: true },
                },
            },
        },
        auction: true,
    };
}
async function listingRoutes(app) {
    app.get("/listings", async (request, reply) => {
        const parsed = ListingQuery.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Invalid query" });
        }
        const { page, pageSize, q, type, sellerId, gameId, setId, minPrice, maxPrice, condition, language, isFoil } = parsed.data;
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
        if (gameId || setId) {
            where.items = {
                some: {
                    card: {
                        ...(gameId ? { gameId } : {}),
                        ...(setId ? { setId } : {}),
                    },
                },
            };
        }
        const [total, data] = await Promise.all([
            db_1.prisma.listing.count({ where }),
            db_1.prisma.listing.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: listingSelect(false),
            }),
        ]);
        return {
            data,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    });
    app.get("/listings/:id", async (request, reply) => {
        await maybeAuth(request);
        const id = request.params.id;
        const listing = await db_1.prisma.listing.findUnique({
            where: { id },
            select: listingSelect(false),
        });
        if (!listing)
            return reply.code(404).send({ error: "Not found" });
        const isOwner = request.user?.sub === listing.sellerId;
        if (!isOwner && listing.status !== "ACTIVE") {
            return reply.code(404).send({ error: "Not found" });
        }
        if (isOwner) {
            const full = await db_1.prisma.listing.findUnique({
                where: { id },
                select: listingSelect(true),
            });
            return reply.send({ data: full });
        }
        return reply.send({ data: listing });
    });
    app.get("/me/listings", { preHandler: guards_1.requireAuth }, async (request, reply) => {
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const data = await db_1.prisma.listing.findMany({
            where: { sellerId: userId },
            orderBy: { createdAt: "desc" },
            select: listingSelect(true),
        });
        return reply.send({ data });
    });
    app.post("/listings", { preHandler: (0, guards_1.requireRole)(["SELLER", "STORE"]), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = ListingCreateSchema.parse(request.body);
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const plan = await (0, plan_1.getActivePlan)(userId);
        if (!plan) {
            return reply.code(402).send({ error: "No active plan" });
        }
        const usage = await (0, plan_1.getOrCreateUsage)(userId);
        if (plan.monthlyListingLimit && usage.listingsCreated >= plan.monthlyListingLimit) {
            return reply.code(403).send({ error: "Monthly listing limit reached" });
        }
        if (plan.activeListingLimit) {
            const activeCount = await db_1.prisma.listing.count({
                where: { sellerId: userId, status: "ACTIVE" },
            });
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
                        create: body.mediaAssetIds.map((assetId, index) => ({
                            assetId,
                            sortOrder: index,
                        })),
                    }
                    : undefined,
            },
            select: listingSelect(true),
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
    });
    app.patch("/listings/:id", { preHandler: (0, guards_1.requireRole)(["SELLER", "STORE"]), config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = ListingUpdateSchema.parse(request.body);
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const id = request.params.id;
        const listing = await db_1.prisma.listing.findFirst({ where: { id, sellerId: userId } });
        if (!listing)
            return reply.code(404).send({ error: "Not found" });
        const plan = await (0, plan_1.getActivePlan)(userId);
        if (!plan) {
            return reply.code(402).send({ error: "No active plan" });
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
                    data: body.mediaAssetIds.map((assetId, index) => ({
                        listingId: id,
                        assetId,
                        sortOrder: index,
                    })),
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
            await db_1.prisma.mediaAsset.updateMany({
                where: { id: { in: body.mediaAssetIds } },
                data: { expiresAt: null },
            });
        }
        const updated = await db_1.prisma.listing.findUnique({ where: { id }, select: listingSelect(true) });
        return reply.send({ data: updated });
    });
    app.delete("/listings/:id", { preHandler: (0, guards_1.requireRole)(["SELLER", "STORE"]), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const id = request.params.id;
        const listing = await db_1.prisma.listing.findFirst({ where: { id, sellerId: userId } });
        if (!listing)
            return reply.code(404).send({ error: "Not found" });
        await db_1.prisma.listing.update({
            where: { id },
            data: { status: "REMOVED" },
        });
        return reply.send({ ok: true });
    });
}
