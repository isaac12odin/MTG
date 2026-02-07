import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../db";
import { verifyAccessToken } from "../../security/jwt";
import { getActivePlan, getOrCreateUsage } from "../../utils/plan";
import { buildPagination, paginate } from "../../utils/pagination";
import { ListingCreateSchema, ListingQuery, ListingUpdateSchema, listingSelect } from "./listings.model";

async function maybeAuth(request: FastifyRequest) {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return;
  const token = auth.slice("Bearer ".length);
  try {
    const payload = await verifyAccessToken(token);
    request.user = payload;
  } catch {
    return;
  }
}

export async function listPublic(request: FastifyRequest, reply: FastifyReply) {
  const parsed = ListingQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });

  const {
    page,
    pageSize,
    q,
    type,
    sellerId,
    gameId,
    setId,
    minPrice,
    maxPrice,
    condition,
    language,
    isFoil,
    country,
    state,
    city,
  } = parsed.data;

  const where: any = { status: "ACTIVE" };
  if (type) where.type = type;
  if (sellerId) where.sellerId = sellerId;
  if (condition) where.condition = condition;
  if (language) where.language = language;
  if (typeof isFoil === "boolean") where.isFoil = isFoil;
  if (minPrice || maxPrice) {
    where.askPrice = {};
    if (minPrice) where.askPrice.gte = minPrice;
    if (maxPrice) where.askPrice.lte = maxPrice;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  const itemCardWhere: any = { game: { status: "ACTIVE" } };
  if (gameId) itemCardWhere.gameId = gameId;
  if (setId) itemCardWhere.setId = setId;
  where.items = {
    some: {
      card: itemCardWhere,
    },
  };
  if (country || state || city) {
    const shippingFilter: any = {};
    if (country) shippingFilter.country = country.toUpperCase();
    if (state) shippingFilter.state = { contains: state, mode: "insensitive" };
    if (city) shippingFilter.city = { contains: city, mode: "insensitive" };
    where.shippingFrom = { is: shippingFilter };
  }

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: listingSelect(false),
    }),
  ]);

  return reply.send({
    data,
    pagination: buildPagination(page, pageSize, total),
  });
}

export async function getById(request: FastifyRequest, reply: FastifyReply) {
  await maybeAuth(request);
  const id = (request.params as { id: string }).id;
  const base = await prisma.listing.findUnique({ where: { id }, select: { sellerId: true, status: true } });
  if (!base) return reply.code(404).send({ error: "Not found" });

  const isOwner = request.user?.sub === base.sellerId;
  if (isOwner) {
    const full = await prisma.listing.findUnique({ where: { id }, select: listingSelect(true) });
    return reply.send({ data: full });
  }

  if (base.status !== "ACTIVE") {
    return reply.code(404).send({ error: "Not found" });
  }

  const listing = await prisma.listing.findFirst({
    where: {
      id,
      items: { some: { card: { game: { status: "ACTIVE" } } } },
    },
    select: listingSelect(false),
  });
  if (!listing) return reply.code(404).send({ error: "Not found" });

  return reply.send({ data: listing });
}

export async function listMine(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const data = await prisma.listing.findMany({
    where: { sellerId: userId },
    orderBy: { createdAt: "desc" },
    select: listingSelect(true),
  });

  return reply.send({ data });
}

export async function createListing(request: FastifyRequest, reply: FastifyReply) {
  const body = ListingCreateSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const plan = await getActivePlan(userId);
  if (!plan) return reply.code(402).send({ error: "No active plan" });

  const usage = await getOrCreateUsage(userId);
  if (plan.monthlyListingLimit && usage.listingsCreated >= plan.monthlyListingLimit) {
    return reply.code(403).send({ error: "Monthly listing limit reached" });
  }

  if (plan.activeListingLimit) {
    const activeCount = await prisma.listing.count({ where: { sellerId: userId, status: "ACTIVE" } });
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
    const ownedAssets = await prisma.mediaAsset.findMany({
      where: { id: { in: body.mediaAssetIds }, ownerId: userId, status: "READY" },
      select: { id: true },
    });
    if (ownedAssets.length !== body.mediaAssetIds.length) {
      return reply.code(400).send({ error: "Invalid media assets" });
    }
  }

  const cardIds = body.items.map((item) => item.cardId);
  const cards = await prisma.cardDefinition.findMany({
    where: { id: { in: cardIds } },
    include: { game: true },
  });
  if (cards.length !== cardIds.length) {
    return reply.code(400).send({ error: "Invalid cards" });
  }
  if (cards.some((card) => card.game.status !== "ACTIVE")) {
    return reply.code(400).send({ error: "Game is not available" });
  }

  const listing = await prisma.listing.create({
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
    select: listingSelect(true),
  });

  if (body.mediaAssetIds && body.mediaAssetIds.length > 0) {
    await prisma.mediaAsset.updateMany({
      where: { id: { in: body.mediaAssetIds } },
      data: { expiresAt: null },
    });
  }

  await prisma.planUsage.update({
    where: { id: usage.id },
    data: {
      listingsCreated: { increment: 1 },
      listingItemsCreated: { increment: body.items.length },
    },
  });

  return reply.code(201).send({ data: listing });
}

export async function updateListing(request: FastifyRequest, reply: FastifyReply) {
  const body = ListingUpdateSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const id = (request.params as { id: string }).id;
  const listing = await prisma.listing.findFirst({ where: { id, sellerId: userId } });
  if (!listing) return reply.code(404).send({ error: "Not found" });

  const plan = await getActivePlan(userId);
  if (!plan) return reply.code(402).send({ error: "No active plan" });

  if (body.mediaAssetIds && plan.maxImagesPerListing) {
    if (body.mediaAssetIds.length > plan.maxImagesPerListing) {
      return reply.code(400).send({ error: "Too many images for your plan" });
    }
  }

  if (body.mediaAssetIds && body.mediaAssetIds.length > 0) {
    const ownedAssets = await prisma.mediaAsset.findMany({
      where: { id: { in: body.mediaAssetIds }, ownerId: userId, status: "READY" },
      select: { id: true },
    });
    if (ownedAssets.length !== body.mediaAssetIds.length) {
      return reply.code(400).send({ error: "Invalid media assets" });
    }
  }

  await prisma.$transaction(async (tx) => {
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
    await prisma.mediaAsset.updateMany({ where: { id: { in: body.mediaAssetIds } }, data: { expiresAt: null } });
  }

  const updated = await prisma.listing.findUnique({ where: { id }, select: listingSelect(true) });
  return reply.send({ data: updated });
}

export async function removeListing(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const id = (request.params as { id: string }).id;
  const listing = await prisma.listing.findFirst({ where: { id, sellerId: userId } });
  if (!listing) return reply.code(404).send({ error: "Not found" });

  await prisma.listing.update({ where: { id }, data: { status: "REMOVED" } });
  return reply.send({ ok: true });
}
