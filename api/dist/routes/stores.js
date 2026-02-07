"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeRoutes = storeRoutes;
const zod_1 = require("zod");
const db_1 = require("../db");
const guards_1 = require("../security/guards");
const plan_1 = require("../utils/plan");
const StoreProfileSchema = zod_1.z.object({
    storeName: zod_1.z.string().min(2).max(120),
    legalName: zod_1.z.string().max(200).optional(),
    taxId: zod_1.z.string().max(50).optional(),
    contactPhone: zod_1.z.string().max(30).optional(),
    addressId: zod_1.z.string().uuid().optional(),
});
const InventoryItemSchema = zod_1.z.object({
    cardId: zod_1.z.string().uuid(),
    qty: zod_1.z.number().int().min(1).max(999),
    condition: zod_1.z.string().optional(),
    language: zod_1.z.string().optional(),
    isFoil: zod_1.z.boolean().optional(),
    price: zod_1.z.number().optional(),
    currency: zod_1.z.string().default("MXN"),
    notes: zod_1.z.string().optional(),
    status: zod_1.z.enum(["ACTIVE", "RESERVED", "SOLD", "ARCHIVED"]).optional(),
});
const InventoryBulkSchema = zod_1.z.object({
    items: zod_1.z.array(InventoryItemSchema).min(1).max(500),
});
const InventoryQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    status: zod_1.z.enum(["ACTIVE", "RESERVED", "SOLD", "ARCHIVED"]).optional(),
    q: zod_1.z.string().optional(),
    gameId: zod_1.z.string().uuid().optional(),
    setId: zod_1.z.string().uuid().optional(),
});
async function storeRoutes(app) {
    app.get("/stores/:id", async (request, reply) => {
        const storeId = request.params.id;
        const store = await db_1.prisma.user.findUnique({
            where: { id: storeId },
            include: {
                storeProfile: true,
                reputation: true,
            },
        });
        if (!store || !store.storeProfile)
            return reply.code(404).send({ error: "Not found" });
        return reply.send({
            data: {
                id: store.id,
                storeProfile: store.storeProfile,
                reputation: store.reputation,
            },
        });
    });
    app.post("/me/store", { preHandler: guards_1.requireAuth, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = StoreProfileSchema.parse(request.body);
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const profile = await db_1.prisma.storeProfile.upsert({
            where: { userId },
            create: { userId, ...body },
            update: body,
        });
        await db_1.prisma.userRole.upsert({
            where: { userId_role: { userId, role: "STORE" } },
            create: { userId, role: "STORE" },
            update: {},
        });
        return reply.send({ data: profile });
    });
    app.get("/stores/:id/inventory", async (request, reply) => {
        const storeId = request.params.id;
        const parsed = InventoryQuery.safeParse(request.query);
        if (!parsed.success)
            return reply.code(400).send({ error: "Invalid query" });
        const { page, pageSize, status, q, gameId, setId } = parsed.data;
        const where = { storeId, status: status ?? "ACTIVE" };
        if (q) {
            where.card = { name: { contains: q, mode: "insensitive" } };
        }
        if (gameId || setId) {
            where.card = {
                ...(where.card ?? {}),
                ...(gameId ? { gameId } : {}),
                ...(setId ? { setId } : {}),
            };
        }
        const [total, data] = await Promise.all([
            db_1.prisma.storeInventoryItem.count({ where }),
            db_1.prisma.storeInventoryItem.findMany({
                where,
                include: { card: true },
                orderBy: { updatedAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return reply.send({
            data,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    });
    app.get("/me/inventory", { preHandler: (0, guards_1.requireRole)(["STORE"]) }, async (request, reply) => {
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const parsed = InventoryQuery.safeParse(request.query);
        if (!parsed.success)
            return reply.code(400).send({ error: "Invalid query" });
        const { page, pageSize, status, q, gameId, setId } = parsed.data;
        const where = { storeId: userId };
        if (status)
            where.status = status;
        if (q) {
            where.card = { name: { contains: q, mode: "insensitive" } };
        }
        if (gameId || setId) {
            where.card = {
                ...(where.card ?? {}),
                ...(gameId ? { gameId } : {}),
                ...(setId ? { setId } : {}),
            };
        }
        const [total, data] = await Promise.all([
            db_1.prisma.storeInventoryItem.count({ where }),
            db_1.prisma.storeInventoryItem.findMany({
                where,
                include: { card: true },
                orderBy: { updatedAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return reply.send({
            data,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    });
    app.post("/inventory", { preHandler: (0, guards_1.requireRole)(["STORE"]), config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = InventoryItemSchema.parse(request.body);
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const plan = await (0, plan_1.getActivePlan)(userId);
        if (!plan)
            return reply.code(402).send({ error: "No active plan" });
        const item = await db_1.prisma.storeInventoryItem.create({
            data: {
                storeId: userId,
                cardId: body.cardId,
                qty: body.qty,
                condition: body.condition,
                language: body.language,
                isFoil: body.isFoil,
                price: body.price,
                currency: body.currency,
                status: body.status ?? "ACTIVE",
                notes: body.notes,
            },
        });
        return reply.code(201).send({ data: item });
    });
    app.post("/inventory/bulk", { preHandler: (0, guards_1.requireRole)(["STORE"]), config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = InventoryBulkSchema.parse(request.body);
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const plan = await (0, plan_1.getActivePlan)(userId);
        if (!plan)
            return reply.code(402).send({ error: "No active plan" });
        await db_1.prisma.storeInventoryItem.createMany({
            data: body.items.map((item) => ({
                storeId: userId,
                cardId: item.cardId,
                qty: item.qty,
                condition: item.condition,
                language: item.language,
                isFoil: item.isFoil,
                price: item.price,
                currency: item.currency ?? "MXN",
                status: item.status ?? "ACTIVE",
                notes: item.notes,
            })),
        });
        return reply.code(201).send({ ok: true, count: body.items.length });
    });
    app.patch("/inventory/:id", { preHandler: (0, guards_1.requireRole)(["STORE"]), config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = InventoryItemSchema.partial().parse(request.body);
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const id = request.params.id;
        const item = await db_1.prisma.storeInventoryItem.findFirst({ where: { id, storeId: userId } });
        if (!item)
            return reply.code(404).send({ error: "Not found" });
        const updated = await db_1.prisma.storeInventoryItem.update({
            where: { id },
            data: {
                cardId: body.cardId,
                qty: body.qty,
                condition: body.condition,
                language: body.language,
                isFoil: body.isFoil,
                price: body.price,
                currency: body.currency,
                status: body.status,
                notes: body.notes,
            },
        });
        return reply.send({ data: updated });
    });
    app.delete("/inventory/:id", { preHandler: (0, guards_1.requireRole)(["STORE"]), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const id = request.params.id;
        const item = await db_1.prisma.storeInventoryItem.findFirst({ where: { id, storeId: userId } });
        if (!item)
            return reply.code(404).send({ error: "Not found" });
        await db_1.prisma.storeInventoryItem.update({ where: { id }, data: { status: "ARCHIVED" } });
        return reply.send({ ok: true });
    });
}
