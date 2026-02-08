import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../db";
import { decryptString } from "../../security/crypto";
import { hashEmail, hashPhone } from "../../security/hash";
import { buildPagination, paginate } from "../../utils/pagination";
import { chatHub } from "../chat/chat.hub";
import {
  AuctionsAdminQuery,
  DealsAdminQuery,
  GameCreateSchema,
  GameQuery,
  GameUpdateSchema,
  ListingAdminUpdateSchema,
  ListingsAdminQuery,
  PaymentsQuery,
  PlanCreateSchema,
  PlansAdminQuery,
  PlanUpdateSchema,
  ReportUpdateSchema,
  ReportsAdminQuery,
  StoresAdminQuery,
  UsersQuery,
  UserUpdateSchema,
  VerificationDecisionSchema,
  VerificationQuery,
  EventsAdminQuery,
  EventUpdateSchema,
} from "./admin.model";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

export async function listGamesAdmin(request: FastifyRequest, reply: FastifyReply) {
  const parsed = GameQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { q, status } = parsed.data;
  const where: any = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  if (status) where.status = status;

  const data = await prisma.game.findMany({ where, orderBy: { name: "asc" } });
  return reply.send({ data });
}

export async function createGameAdmin(request: FastifyRequest, reply: FastifyReply) {
  const body = GameCreateSchema.parse(request.body);
  const name = body.name.trim();
  const slug = body.slug ? slugify(body.slug) : slugify(name);

  const existing = await prisma.game.findFirst({ where: { OR: [{ name }, { slug }] } });
  if (existing) return reply.code(409).send({ error: "Game already exists" });

  const game = await prisma.game.create({
    data: {
      name,
      slug,
    },
  });

  return reply.code(201).send({ data: game });
}

export async function updateGameAdmin(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const body = GameUpdateSchema.parse(request.body);

  const existing = await prisma.game.findUnique({ where: { id } });
  if (!existing) return reply.code(404).send({ error: "Not found" });

  const name = body.name?.trim();
  const slug = body.slug ? slugify(body.slug) : body.name ? slugify(body.name) : undefined;

  const updateData: any = {
    ...(name ? { name } : {}),
    ...(slug ? { slug } : {}),
  };

  const game = await prisma.$transaction(async (tx) => {
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

export async function listVerificationRequests(request: FastifyRequest, reply: FastifyReply) {
  const parsed = VerificationQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { page, pageSize, status } = parsed.data;
  const where: any = {};
  if (status) where.status = status;

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.verificationRequest.count({ where }),
    prisma.verificationRequest.findMany({
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

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function decideVerificationRequest(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const moderatorId = request.user?.sub;
  if (!moderatorId) return reply.code(401).send({ error: "Unauthorized" });

  const body = VerificationDecisionSchema.parse(request.body);
  const requestRow = await prisma.verificationRequest.findUnique({ where: { id } });
  if (!requestRow) return reply.code(404).send({ error: "Not found" });

  const now = new Date();
  const approved = body.status === "APPROVED";

  await prisma.$transaction([
    prisma.verificationRequest.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes,
        reviewedBy: moderatorId,
        reviewedAt: now,
      },
    }),
    prisma.userSecurity.update({
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

export async function listPaymentAlerts(request: FastifyRequest, reply: FastifyReply) {
  const parsed = PaymentsQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { page, pageSize, status, dueInDays } = parsed.data;
  const where: any = {};
  if (status) where.status = status;
  if (dueInDays) {
    const maxDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000);
    where.periodEnd = { lte: maxDate };
  }

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.mensualidad.count({ where }),
    prisma.mensualidad.findMany({
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

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function verifyPayment(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const moderatorId = request.user?.sub;
  if (!moderatorId) return reply.code(401).send({ error: "Unauthorized" });

  const mensualidad = await prisma.mensualidad.findUnique({ where: { id } });
  if (!mensualidad) return reply.code(404).send({ error: "Not found" });

  const updated = await prisma.mensualidad.update({
    where: { id },
    data: {
      status: "PAGADO",
      paidAt: new Date(),
      verifiedById: moderatorId,
    },
  });

  return reply.send({ data: updated });
}

export async function dashboardStats(_request: FastifyRequest, reply: FastifyReply) {
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    usersLast24h,
    listingsActive,
    listingsLast24h,
    auctionsLive,
    dealsCompletedWeek,
    messagesToday,
    reportsOpen,
    paymentsPending,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.listing.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.auction.count({ where: { status: "LIVE" } }),
    prisma.deal.count({ where: { status: "COMPLETED", createdAt: { gte: weekAgo } } }),
    prisma.message.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.mensualidad.count({ where: { status: "PENDIENTE" } }),
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

export async function listUsersAdmin(request: FastifyRequest, reply: FastifyReply) {
  const parsed = UsersQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { page, pageSize, q, role, active, email, phone } = parsed.data;

  const where: any = {};
  if (typeof active === "boolean") where.isActive = active;
  if (role) where.roles = { some: { role } };
  if (email) where.emailHash = hashEmail(email);
  if (phone) where.phoneHash = hashPhone(phone);
  if (q) {
    where.OR = [
      { profile: { is: { displayName: { contains: q, mode: "insensitive" } } } },
      { storeProfile: { is: { storeName: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const { skip, take } = paginate(page, pageSize);
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
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
    email: decryptString(u.emailEnc),
    phone: u.phoneEnc ? decryptString(u.phoneEnc) : null,
    isActive: u.isActive,
    roles: u.roles.map((r) => r.role),
    profile: u.profile,
    storeProfile: u.storeProfile,
    security: u.security,
    counts: u._count,
    createdAt: u.createdAt,
  }));

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function updateUserAdmin(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const body = UserUpdateSchema.parse(request.body);
  const moderatorId = request.user?.sub;
  if (!moderatorId) return reply.code(401).send({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return reply.code(404).send({ error: "Not found" });

  await prisma.$transaction(async (tx) => {
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

export async function listListingsAdmin(request: FastifyRequest, reply: FastifyReply) {
  const parsed = ListingsAdminQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { page, pageSize, q, status, type, sellerId, gameId } = parsed.data;
  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (sellerId) where.sellerId = sellerId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (gameId) {
    where.items = { some: { card: { gameId } } };
  }

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
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

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function updateListingAdmin(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const body = ListingAdminUpdateSchema.parse(request.body);

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) return reply.code(404).send({ error: "Not found" });

  const updated = await prisma.listing.update({ where: { id }, data: body });
  return reply.send({ data: updated });
}

export async function listAuctionsAdmin(request: FastifyRequest, reply: FastifyReply) {
  const parsed = AuctionsAdminQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { page, pageSize, status } = parsed.data;
  const where: any = {};
  if (status) where.status = status;

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.auction.count({ where }),
    prisma.auction.findMany({
      where,
      orderBy: { endAt: "desc" },
      skip,
      take,
      include: {
        listing: { select: { id: true, title: true, seller: { select: { id: true, profile: true } } } },
      },
    }),
  ]);

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function listDealsAdmin(request: FastifyRequest, reply: FastifyReply) {
  const parsed = DealsAdminQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { page, pageSize, status } = parsed.data;
  const where: any = {};
  if (status) where.status = status;

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.deal.count({ where }),
    prisma.deal.findMany({
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

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function listReportsAdmin(request: FastifyRequest, reply: FastifyReply) {
  const parsed = ReportsAdminQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { page, pageSize, status } = parsed.data;
  const where: any = {};
  if (status) where.status = status;

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
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

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function updateReportAdmin(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const body = ReportUpdateSchema.parse(request.body);

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return reply.code(404).send({ error: "Not found" });

  const resolvedAt = body.status === "RESOLVED" || body.status === "DISMISSED" ? new Date() : null;
  const updated = await prisma.report.update({
    where: { id },
    data: { status: body.status, resolvedAt },
  });

  return reply.send({ data: updated });
}

export async function listStoresAdmin(request: FastifyRequest, reply: FastifyReply) {
  const parsed = StoresAdminQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { page, pageSize, q } = parsed.data;
  const where: any = {};
  if (q) where.storeName = { contains: q, mode: "insensitive" };

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.storeProfile.count({ where }),
    prisma.storeProfile.findMany({
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

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function listEventsAdmin(request: FastifyRequest, reply: FastifyReply) {
  const parsed = EventsAdminQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { page, pageSize, status } = parsed.data;
  const where: any = {};
  if (status) where.status = status;

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      orderBy: { startAt: "desc" },
      skip,
      take,
      include: { organizer: { select: { id: true, profile: true } } },
    }),
  ]);

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function updateEventAdmin(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const body = EventUpdateSchema.parse(request.body);

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return reply.code(404).send({ error: "Not found" });

  const updated = await prisma.event.update({ where: { id }, data: body });
  return reply.send({ data: updated });
}

export async function listPlansAdmin(request: FastifyRequest, reply: FastifyReply) {
  const parsed = PlansAdminQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });
  const { page, pageSize, type, active } = parsed.data;
  const where: any = {};
  if (type) where.type = type;
  if (typeof active === "boolean") where.isActive = active;

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.plan.count({ where }),
    prisma.plan.findMany({
      where,
      orderBy: { priceMXN: "asc" },
      skip,
      take,
    }),
  ]);

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function createPlanAdmin(request: FastifyRequest, reply: FastifyReply) {
  const body = PlanCreateSchema.parse(request.body);
  const plan = await prisma.plan.create({
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

export async function updatePlanAdmin(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const body = PlanUpdateSchema.parse(request.body);
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) return reply.code(404).send({ error: "Not found" });

  const updated = await prisma.plan.update({
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

export async function adminSettings(_request: FastifyRequest, reply: FastifyReply) {
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

export async function listChatActiveUsers(_request: FastifyRequest, reply: FastifyReply) {
  const snapshot = chatHub.getActiveSnapshot();
  const ids = snapshot.perUser.map((p) => p.userId);
  if (ids.length === 0) {
    return reply.send({ data: { totalConnections: 0, users: 0, perUser: [] } });
  }

  const users = await prisma.user.findMany({
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
