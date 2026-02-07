import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../db";
import { buildPagination, paginate } from "../../utils/pagination";
import { getActivePlan } from "../../utils/plan";
import { InventoryBulkSchema, InventoryItemSchema, InventoryQuery, StoreProfileSchema } from "./stores.model";

export async function getStore(request: FastifyRequest, reply: FastifyReply) {
  const storeId = (request.params as { id: string }).id;
  const store = await prisma.user.findUnique({
    where: { id: storeId },
    include: { storeProfile: true, reputation: true },
  });
  if (!store || !store.storeProfile) return reply.code(404).send({ error: "Not found" });

  return reply.send({ data: { id: store.id, storeProfile: store.storeProfile, reputation: store.reputation } });
}

export async function upsertStore(request: FastifyRequest, reply: FastifyReply) {
  const body = StoreProfileSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const profile = await prisma.storeProfile.upsert({
    where: { userId },
    create: { userId, ...body },
    update: body,
  });

  await prisma.userRole.upsert({
    where: { userId_role: { userId, role: "STORE" } },
    create: { userId, role: "STORE" },
    update: {},
  });

  return reply.send({ data: profile });
}

export async function listStoreInventory(request: FastifyRequest, reply: FastifyReply) {
  const storeId = (request.params as { id: string }).id;
  const parsed = InventoryQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });

  const { page, pageSize, status, q, gameId, setId } = parsed.data;
  const where: any = { storeId, status: status ?? "ACTIVE" };
  if (q) where.card = { name: { contains: q, mode: "insensitive" } };
  if (gameId || setId) {
    where.card = { ...(where.card ?? {}), ...(gameId ? { gameId } : {}), ...(setId ? { setId } : {}) };
  }

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.storeInventoryItem.count({ where }),
    prisma.storeInventoryItem.findMany({
      where,
      include: { card: true },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
  ]);

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function listMyInventory(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const parsed = InventoryQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });

  const { page, pageSize, status, q, gameId, setId } = parsed.data;
  const where: any = { storeId: userId };
  if (status) where.status = status;
  if (q) where.card = { name: { contains: q, mode: "insensitive" } };
  if (gameId || setId) {
    where.card = { ...(where.card ?? {}), ...(gameId ? { gameId } : {}), ...(setId ? { setId } : {}) };
  }

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.storeInventoryItem.count({ where }),
    prisma.storeInventoryItem.findMany({
      where,
      include: { card: true },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    }),
  ]);

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function createInventoryItem(request: FastifyRequest, reply: FastifyReply) {
  const body = InventoryItemSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const plan = await getActivePlan(userId);
  if (!plan) return reply.code(402).send({ error: "No active plan" });

  const item = await prisma.storeInventoryItem.create({
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

export async function bulkInventory(request: FastifyRequest, reply: FastifyReply) {
  const body = InventoryBulkSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const plan = await getActivePlan(userId);
  if (!plan) return reply.code(402).send({ error: "No active plan" });

  await prisma.storeInventoryItem.createMany({
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

export async function updateInventoryItem(request: FastifyRequest, reply: FastifyReply) {
  const body = InventoryItemSchema.partial().parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const id = (request.params as { id: string }).id;
  const item = await prisma.storeInventoryItem.findFirst({ where: { id, storeId: userId } });
  if (!item) return reply.code(404).send({ error: "Not found" });

  const updated = await prisma.storeInventoryItem.update({
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

export async function archiveInventoryItem(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const id = (request.params as { id: string }).id;
  const item = await prisma.storeInventoryItem.findFirst({ where: { id, storeId: userId } });
  if (!item) return reply.code(404).send({ error: "Not found" });

  await prisma.storeInventoryItem.update({ where: { id }, data: { status: "ARCHIVED" } });
  return reply.send({ ok: true });
}
