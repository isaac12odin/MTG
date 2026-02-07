import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../db";
import { buildPagination, paginate } from "../../utils/pagination";
import { ReviewCreateSchema, ReviewQuery } from "./reviews.model";

export async function createReview(request: FastifyRequest, reply: FastifyReply) {
  const body = ReviewCreateSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const deal = await prisma.deal.findUnique({ where: { id: body.dealId } });
  if (!deal) return reply.code(404).send({ error: "Deal not found" });

  const allowed = deal.buyerId === userId || deal.sellerId === userId;
  if (!allowed) return reply.code(403).send({ error: "Not allowed" });

  if (deal.status !== "DELIVERED" && deal.status !== "COMPLETED") {
    return reply.code(400).send({ error: "Deal not completed" });
  }

  const targetId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;

  const review = await prisma.review.create({
    data: {
      dealId: deal.id,
      authorId: userId,
      targetId,
      rating: body.rating,
      comment: body.comment,
    },
  });

  return reply.code(201).send({ data: review });
}

export async function listUserReviews(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.params as { id: string }).id;
  const parsed = ReviewQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });

  const { page, pageSize } = parsed.data;
  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.review.count({ where: { targetId: userId } }),
    prisma.review.findMany({
      where: { targetId: userId },
      include: { author: { select: { id: true, profile: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function getReputation(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request.params as { id: string }).id;
  const rep = await prisma.review.aggregate({
    where: { targetId: userId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  if (rep._count._all === 0) return reply.send({ data: null });

  return reply.send({
    data: {
      userId,
      averageRating: rep._avg.rating ?? 0,
      totalReviews: rep._count._all,
    },
  });
}
