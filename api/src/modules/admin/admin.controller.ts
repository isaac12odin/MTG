import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../db";
import { buildPagination, paginate } from "../../utils/pagination";
import {
  GameCreateSchema,
  GameQuery,
  GameUpdateSchema,
  PaymentsQuery,
  VerificationDecisionSchema,
  VerificationQuery,
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
