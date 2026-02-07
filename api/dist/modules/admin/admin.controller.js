"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGamesAdmin = listGamesAdmin;
exports.createGameAdmin = createGameAdmin;
exports.updateGameAdmin = updateGameAdmin;
exports.listVerificationRequests = listVerificationRequests;
exports.decideVerificationRequest = decideVerificationRequest;
exports.listPaymentAlerts = listPaymentAlerts;
exports.verifyPayment = verifyPayment;
const db_1 = require("../../db");
const pagination_1 = require("../../utils/pagination");
const admin_model_1 = require("./admin.model");
function slugify(input) {
    return input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "")
        .slice(0, 80);
}
async function listGamesAdmin(request, reply) {
    const parsed = admin_model_1.GameQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { q, status } = parsed.data;
    const where = {};
    if (q)
        where.name = { contains: q, mode: "insensitive" };
    if (status)
        where.status = status;
    const data = await db_1.prisma.game.findMany({ where, orderBy: { name: "asc" } });
    return reply.send({ data });
}
async function createGameAdmin(request, reply) {
    const body = admin_model_1.GameCreateSchema.parse(request.body);
    const name = body.name.trim();
    const slug = body.slug ? slugify(body.slug) : slugify(name);
    const existing = await db_1.prisma.game.findFirst({ where: { OR: [{ name }, { slug }] } });
    if (existing)
        return reply.code(409).send({ error: "Game already exists" });
    const game = await db_1.prisma.game.create({
        data: {
            name,
            slug,
        },
    });
    return reply.code(201).send({ data: game });
}
async function updateGameAdmin(request, reply) {
    const id = request.params.id;
    const body = admin_model_1.GameUpdateSchema.parse(request.body);
    const existing = await db_1.prisma.game.findUnique({ where: { id } });
    if (!existing)
        return reply.code(404).send({ error: "Not found" });
    const name = body.name?.trim();
    const slug = body.slug ? slugify(body.slug) : body.name ? slugify(body.name) : undefined;
    const updateData = {
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
    };
    const game = await db_1.prisma.$transaction(async (tx) => {
        const updated = await tx.game.update({
            where: { id },
            data: updateData,
        });
        if (body.status === "BANNED") {
            await tx.listing.updateMany({
                where: {
                    items: { some: { card: { gameId: id } } },
                },
                data: { status: "REMOVED" },
            });
        }
        return updated;
    });
    return reply.send({ data: game });
}
async function listVerificationRequests(request, reply) {
    const parsed = admin_model_1.VerificationQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, status } = parsed.data;
    const where = {};
    if (status)
        where.status = status;
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.verificationRequest.count({ where }),
        db_1.prisma.verificationRequest.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: {
                user: { select: { id: true, profile: true, roles: true } },
                reviewer: { select: { id: true, profile: true } },
            },
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function decideVerificationRequest(request, reply) {
    const id = request.params.id;
    const moderatorId = request.user?.sub;
    if (!moderatorId)
        return reply.code(401).send({ error: "Unauthorized" });
    const body = admin_model_1.VerificationDecisionSchema.parse(request.body);
    const requestRow = await db_1.prisma.verificationRequest.findUnique({ where: { id } });
    if (!requestRow)
        return reply.code(404).send({ error: "Not found" });
    const now = new Date();
    const approved = body.status === "APPROVED";
    await db_1.prisma.$transaction([
        db_1.prisma.verificationRequest.update({
            where: { id },
            data: {
                status: body.status,
                notes: body.notes,
                reviewedBy: moderatorId,
                reviewedAt: now,
            },
        }),
        db_1.prisma.userSecurity.update({
            where: { userId: requestRow.userId },
            data: {
                manualVerifiedAt: approved ? now : null,
                manualVerifiedById: approved ? moderatorId : null,
                manualVerificationNotes: body.notes,
            },
        }),
    ]);
    return reply.send({ ok: true, status: body.status });
}
async function listPaymentAlerts(request, reply) {
    const parsed = admin_model_1.PaymentsQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, status, dueInDays } = parsed.data;
    const where = {};
    if (status)
        where.status = status;
    if (dueInDays) {
        const maxDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);
        where.periodEnd = { lte: maxDate };
    }
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.mensualidad.count({ where }),
        db_1.prisma.mensualidad.findMany({
            where,
            orderBy: { periodEnd: "asc" },
            skip,
            take,
            include: {
                user: { select: { id: true, profile: true } },
                plan: true,
            },
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function verifyPayment(request, reply) {
    const id = request.params.id;
    const moderatorId = request.user?.sub;
    if (!moderatorId)
        return reply.code(401).send({ error: "Unauthorized" });
    const mensualidad = await db_1.prisma.mensualidad.findUnique({ where: { id } });
    if (!mensualidad)
        return reply.code(404).send({ error: "Not found" });
    const updated = await db_1.prisma.mensualidad.update({
        where: { id },
        data: {
            status: "PAGADO",
            paidAt: new Date(),
            verifiedById: moderatorId,
        },
    });
    return reply.send({ data: updated });
}
