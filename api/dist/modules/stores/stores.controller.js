"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStore = getStore;
exports.upsertStore = upsertStore;
exports.listStoreInventory = listStoreInventory;
exports.listMyInventory = listMyInventory;
exports.createInventoryItem = createInventoryItem;
exports.bulkInventory = bulkInventory;
exports.updateInventoryItem = updateInventoryItem;
exports.archiveInventoryItem = archiveInventoryItem;
const db_1 = require("../../db");
const pagination_1 = require("../../utils/pagination");
const plan_1 = require("../../utils/plan");
const stores_model_1 = require("./stores.model");
async function getStore(request, reply) {
    const storeId = request.params.id;
    const store = await db_1.prisma.user.findUnique({
        where: { id: storeId },
        include: { storeProfile: true, reputation: true },
    });
    if (!store || !store.storeProfile)
        return reply.code(404).send({ error: "Not found" });
    return reply.send({ data: { id: store.id, storeProfile: store.storeProfile, reputation: store.reputation } });
}
async function upsertStore(request, reply) {
    const body = stores_model_1.StoreProfileSchema.parse(request.body);
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
}
async function listStoreInventory(request, reply) {
    const storeId = request.params.id;
    const parsed = stores_model_1.InventoryQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, status, q, gameId, setId } = parsed.data;
    const where = { storeId, status: status ?? "ACTIVE" };
    if (q)
        where.card = { name: { contains: q, mode: "insensitive" } };
    if (gameId || setId) {
        where.card = { ...(where.card ?? {}), ...(gameId ? { gameId } : {}), ...(setId ? { setId } : {}) };
    }
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.storeInventoryItem.count({ where }),
        db_1.prisma.storeInventoryItem.findMany({
            where,
            include: { card: true },
            orderBy: { updatedAt: "desc" },
            skip,
            take,
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function listMyInventory(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const parsed = stores_model_1.InventoryQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, status, q, gameId, setId } = parsed.data;
    const where = { storeId: userId };
    if (status)
        where.status = status;
    if (q)
        where.card = { name: { contains: q, mode: "insensitive" } };
    if (gameId || setId) {
        where.card = { ...(where.card ?? {}), ...(gameId ? { gameId } : {}), ...(setId ? { setId } : {}) };
    }
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.storeInventoryItem.count({ where }),
        db_1.prisma.storeInventoryItem.findMany({
            where,
            include: { card: true },
            orderBy: { updatedAt: "desc" },
            skip,
            take,
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function createInventoryItem(request, reply) {
    const body = stores_model_1.InventoryItemSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const plan = await (0, plan_1.getActivePlan)(userId);
    if (!plan)
        return reply.code(402).send({ error: "No active plan" });
    const card = await db_1.prisma.cardDefinition.findUnique({
        where: { id: body.cardId },
        include: { game: true },
    });
    if (!card || card.game.status !== "ACTIVE") {
        return reply.code(400).send({ error: "Game is not available" });
    }
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
}
async function bulkInventory(request, reply) {
    const body = stores_model_1.InventoryBulkSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const plan = await (0, plan_1.getActivePlan)(userId);
    if (!plan)
        return reply.code(402).send({ error: "No active plan" });
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
}
async function updateInventoryItem(request, reply) {
    const body = stores_model_1.InventoryItemSchema.partial().parse(request.body);
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
}
async function archiveInventoryItem(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const id = request.params.id;
    const item = await db_1.prisma.storeInventoryItem.findFirst({ where: { id, storeId: userId } });
    if (!item)
        return reply.code(404).send({ error: "Not found" });
    await db_1.prisma.storeInventoryItem.update({ where: { id }, data: { status: "ARCHIVED" } });
    return reply.send({ ok: true });
}
