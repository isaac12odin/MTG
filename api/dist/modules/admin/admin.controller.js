"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGamesAdmin = listGamesAdmin;
exports.createGameAdmin = createGameAdmin;
exports.updateGameAdmin = updateGameAdmin;
exports.listVerificationRequests = listVerificationRequests;
exports.decideVerificationRequest = decideVerificationRequest;
exports.listPaymentAlerts = listPaymentAlerts;
exports.verifyPayment = verifyPayment;
exports.dashboardStats = dashboardStats;
exports.listUsersAdmin = listUsersAdmin;
exports.updateUserAdmin = updateUserAdmin;
exports.listListingsAdmin = listListingsAdmin;
exports.updateListingAdmin = updateListingAdmin;
exports.listAuctionsAdmin = listAuctionsAdmin;
exports.listDealsAdmin = listDealsAdmin;
exports.listReportsAdmin = listReportsAdmin;
exports.updateReportAdmin = updateReportAdmin;
exports.listStoresAdmin = listStoresAdmin;
exports.listEventsAdmin = listEventsAdmin;
exports.updateEventAdmin = updateEventAdmin;
exports.listPlansAdmin = listPlansAdmin;
exports.createPlanAdmin = createPlanAdmin;
exports.updatePlanAdmin = updatePlanAdmin;
exports.adminSettings = adminSettings;
exports.listChatActiveUsers = listChatActiveUsers;
const db_1 = require("../../db");
const crypto_1 = require("../../security/crypto");
const hash_1 = require("../../security/hash");
const pagination_1 = require("../../utils/pagination");
const chat_hub_1 = require("../chat/chat.hub");
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
async function dashboardStats(_request, reply) {
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const [usersTotal, usersLast24h, listingsActive, listingsLast24h, auctionsLive, dealsCompletedWeek, messagesToday, reportsOpen, paymentsPending,] = await Promise.all([
        db_1.prisma.user.count(),
        db_1.prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
        db_1.prisma.listing.count({ where: { status: "ACTIVE" } }),
        db_1.prisma.listing.count({ where: { createdAt: { gte: dayAgo } } }),
        db_1.prisma.auction.count({ where: { status: "LIVE" } }),
        db_1.prisma.deal.count({ where: { status: "COMPLETED", createdAt: { gte: weekAgo } } }),
        db_1.prisma.message.count({ where: { createdAt: { gte: dayAgo } } }),
        db_1.prisma.report.count({ where: { status: "OPEN" } }),
        db_1.prisma.mensualidad.count({ where: { status: "PENDIENTE" } }),
    ]);
    return reply.send({
        data: {
            usersTotal,
            usersLast24h,
            listingsActive,
            listingsLast24h,
            auctionsLive,
            dealsCompletedWeek,
            messagesToday,
            reportsOpen,
            paymentsPending,
        },
    });
}
async function listUsersAdmin(request, reply) {
    const parsed = admin_model_1.UsersQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, q, role, active, email, phone } = parsed.data;
    const where = {};
    if (typeof active === "boolean")
        where.isActive = active;
    if (role)
        where.roles = { some: { role } };
    if (email)
        where.emailHash = (0, hash_1.hashEmail)(email);
    if (phone)
        where.phoneHash = (0, hash_1.hashPhone)(phone);
    if (q) {
        where.OR = [
            { profile: { is: { displayName: { contains: q, mode: "insensitive" } } } },
            { storeProfile: { is: { storeName: { contains: q, mode: "insensitive" } } } },
        ];
    }
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, rows] = await Promise.all([
        db_1.prisma.user.count({ where }),
        db_1.prisma.user.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: {
                profile: true,
                storeProfile: true,
                roles: true,
                security: true,
                _count: { select: { listings: true, dealsAsSeller: true, dealsAsBuyer: true } },
            },
        }),
    ]);
    const data = rows.map((u) => ({
        id: u.id,
        email: (0, crypto_1.decryptString)(u.emailEnc),
        phone: u.phoneEnc ? (0, crypto_1.decryptString)(u.phoneEnc) : null,
        isActive: u.isActive,
        roles: u.roles.map((r) => r.role),
        profile: u.profile,
        storeProfile: u.storeProfile,
        security: u.security,
        counts: u._count,
        createdAt: u.createdAt,
    }));
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function updateUserAdmin(request, reply) {
    const id = request.params.id;
    const body = admin_model_1.UserUpdateSchema.parse(request.body);
    const moderatorId = request.user?.sub;
    if (!moderatorId)
        return reply.code(401).send({ error: "Unauthorized" });
    const user = await db_1.prisma.user.findUnique({ where: { id } });
    if (!user)
        return reply.code(404).send({ error: "Not found" });
    await db_1.prisma.$transaction(async (tx) => {
        if (typeof body.isActive === "boolean") {
            await tx.user.update({ where: { id }, data: { isActive: body.isActive } });
        }
        if (body.roles) {
            const roles = [...new Set(body.roles)];
            await tx.userRole.deleteMany({ where: { userId: id, role: { notIn: roles } } });
            const existing = await tx.userRole.findMany({ where: { userId: id } });
            const existingSet = new Set(existing.map((r) => r.role));
            const toCreate = roles.filter((r) => !existingSet.has(r)).map((role) => ({ userId: id, role }));
            if (toCreate.length) {
                await tx.userRole.createMany({ data: toCreate });
            }
        }
        if (typeof body.manualVerified === "boolean") {
            const now = body.manualVerified ? new Date() : null;
            await tx.userSecurity.upsert({
                where: { userId: id },
                create: {
                    userId: id,
                    manualVerifiedAt: now,
                    manualVerifiedById: now ? moderatorId : null,
                    manualVerificationNotes: body.notes,
                },
                update: {
                    manualVerifiedAt: now,
                    manualVerifiedById: now ? moderatorId : null,
                    manualVerificationNotes: body.notes,
                },
            });
        }
    });
    return reply.send({ ok: true });
}
async function listListingsAdmin(request, reply) {
    const parsed = admin_model_1.ListingsAdminQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, q, status, type, sellerId, gameId } = parsed.data;
    const where = {};
    if (status)
        where.status = status;
    if (type)
        where.type = type;
    if (sellerId)
        where.sellerId = sellerId;
    if (q) {
        where.OR = [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
        ];
    }
    if (gameId) {
        where.items = { some: { card: { gameId } } };
    }
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.listing.count({ where }),
        db_1.prisma.listing.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: {
                seller: { select: { id: true, profile: true } },
                items: { take: 1, include: { card: { include: { game: true } } } },
                auction: true,
            },
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function updateListingAdmin(request, reply) {
    const id = request.params.id;
    const body = admin_model_1.ListingAdminUpdateSchema.parse(request.body);
    const listing = await db_1.prisma.listing.findUnique({ where: { id } });
    if (!listing)
        return reply.code(404).send({ error: "Not found" });
    const updated = await db_1.prisma.listing.update({ where: { id }, data: body });
    return reply.send({ data: updated });
}
async function listAuctionsAdmin(request, reply) {
    const parsed = admin_model_1.AuctionsAdminQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, status } = parsed.data;
    const where = {};
    if (status)
        where.status = status;
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.auction.count({ where }),
        db_1.prisma.auction.findMany({
            where,
            orderBy: { endAt: "desc" },
            skip,
            take,
            include: {
                listing: { select: { id: true, title: true, seller: { select: { id: true, profile: true } } } },
            },
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function listDealsAdmin(request, reply) {
    const parsed = admin_model_1.DealsAdminQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, status } = parsed.data;
    const where = {};
    if (status)
        where.status = status;
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.deal.count({ where }),
        db_1.prisma.deal.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: {
                listing: { select: { id: true, title: true } },
                seller: { select: { id: true, profile: true } },
                buyer: { select: { id: true, profile: true } },
                shipment: true,
            },
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function listReportsAdmin(request, reply) {
    const parsed = admin_model_1.ReportsAdminQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, status } = parsed.data;
    const where = {};
    if (status)
        where.status = status;
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.report.count({ where }),
        db_1.prisma.report.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: {
                reporter: { select: { id: true, profile: true } },
                targetUser: { select: { id: true, profile: true } },
                listing: { select: { id: true, title: true } },
            },
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function updateReportAdmin(request, reply) {
    const id = request.params.id;
    const body = admin_model_1.ReportUpdateSchema.parse(request.body);
    const report = await db_1.prisma.report.findUnique({ where: { id } });
    if (!report)
        return reply.code(404).send({ error: "Not found" });
    const resolvedAt = body.status === "RESOLVED" || body.status === "DISMISSED" ? new Date() : null;
    const updated = await db_1.prisma.report.update({
        where: { id },
        data: { status: body.status, resolvedAt },
    });
    return reply.send({ data: updated });
}
async function listStoresAdmin(request, reply) {
    const parsed = admin_model_1.StoresAdminQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, q } = parsed.data;
    const where = {};
    if (q)
        where.storeName = { contains: q, mode: "insensitive" };
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.storeProfile.count({ where }),
        db_1.prisma.storeProfile.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take,
            include: {
                user: { select: { id: true, profile: true, roles: true, security: true } },
                address: true,
            },
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function listEventsAdmin(request, reply) {
    const parsed = admin_model_1.EventsAdminQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, status } = parsed.data;
    const where = {};
    if (status)
        where.status = status;
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.event.count({ where }),
        db_1.prisma.event.findMany({
            where,
            orderBy: { startAt: "desc" },
            skip,
            take,
            include: { organizer: { select: { id: true, profile: true } } },
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function updateEventAdmin(request, reply) {
    const id = request.params.id;
    const body = admin_model_1.EventUpdateSchema.parse(request.body);
    const event = await db_1.prisma.event.findUnique({ where: { id } });
    if (!event)
        return reply.code(404).send({ error: "Not found" });
    const updated = await db_1.prisma.event.update({ where: { id }, data: body });
    return reply.send({ data: updated });
}
async function listPlansAdmin(request, reply) {
    const parsed = admin_model_1.PlansAdminQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, type, active } = parsed.data;
    const where = {};
    if (type)
        where.type = type;
    if (typeof active === "boolean")
        where.isActive = active;
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.plan.count({ where }),
        db_1.prisma.plan.findMany({
            where,
            orderBy: { priceMXN: "asc" },
            skip,
            take,
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function createPlanAdmin(request, reply) {
    const body = admin_model_1.PlanCreateSchema.parse(request.body);
    const plan = await db_1.prisma.plan.create({
        data: {
            name: body.name,
            type: body.type,
            priceMXN: body.priceMXN,
            monthlyListingLimit: body.monthlyListingLimit ?? null,
            activeListingLimit: body.activeListingLimit ?? null,
            monthlyImageLimit: body.monthlyImageLimit ?? null,
            maxImagesPerListing: body.maxImagesPerListing ?? null,
            eventLimit: body.eventLimit ?? null,
            isActive: body.isActive ?? true,
        },
    });
    return reply.code(201).send({ data: plan });
}
async function updatePlanAdmin(request, reply) {
    const id = request.params.id;
    const body = admin_model_1.PlanUpdateSchema.parse(request.body);
    const plan = await db_1.prisma.plan.findUnique({ where: { id } });
    if (!plan)
        return reply.code(404).send({ error: "Not found" });
    const updated = await db_1.prisma.plan.update({
        where: { id },
        data: {
            name: body.name,
            type: body.type,
            priceMXN: body.priceMXN,
            monthlyListingLimit: body.monthlyListingLimit ?? undefined,
            activeListingLimit: body.activeListingLimit ?? undefined,
            monthlyImageLimit: body.monthlyImageLimit ?? undefined,
            maxImagesPerListing: body.maxImagesPerListing ?? undefined,
            eventLimit: body.eventLimit ?? undefined,
            isActive: body.isActive,
        },
    });
    return reply.send({ data: updated });
}
async function adminSettings(_request, reply) {
    return reply.send({
        data: {
            jobsEnabled: process.env.RUN_JOBS !== "false",
            messageTtlDays: Number(process.env.MESSAGE_TTL_DAYS ?? 30),
            uploadMaxMb: Number(process.env.UPLOAD_MAX_MB ?? 6),
            uploadTtlHours: Number(process.env.UPLOAD_TTL_HOURS ?? 24),
            refreshDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
        },
    });
}
async function listChatActiveUsers(_request, reply) {
    const snapshot = chat_hub_1.chatHub.getActiveSnapshot();
    const ids = snapshot.perUser.map((p) => p.userId);
    if (ids.length === 0) {
        return reply.send({ data: { totalConnections: 0, users: 0, perUser: [] } });
    }
    const users = await db_1.prisma.user.findMany({
        where: { id: { in: ids } },
        include: { profile: true, roles: true },
    });
    const map = new Map(users.map((u) => [u.id, u]));
    const perUser = snapshot.perUser.map((row) => {
        const user = map.get(row.userId);
        return {
            userId: row.userId,
            connections: row.connections,
            joinedConversations: row.joinedConversations,
            displayName: user?.profile?.displayName ?? user?.id?.slice(0, 6),
            roles: user?.roles?.map((r) => r.role) ?? [],
        };
    });
    return reply.send({
        data: {
            totalConnections: snapshot.totalConnections,
            users: snapshot.users,
            perUser,
        },
    });
}
