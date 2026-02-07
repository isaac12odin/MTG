import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../db";
import { buildPagination, paginate } from "../../utils/pagination";
import { CardQuery, SetQuery } from "./catalog.model";

export async function listGames(_request: FastifyRequest, reply: FastifyReply) {
  const games = await prisma.game.findMany({ orderBy: { name: "asc" } });
  return reply.send({ data: games });
}

export async function listSets(request: FastifyRequest, reply: FastifyReply) {
  const parsed = SetQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });

  const sets = await prisma.set.findMany({
    where: { gameId: parsed.data.gameId },
    orderBy: { name: "asc" },
  });

  return reply.send({ data: sets });
}

export async function listCards(request: FastifyRequest, reply: FastifyReply) {
  const parsed = CardQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });

  const { page, pageSize, gameId, setId, q } = parsed.data;
  const where: any = {};
  if (gameId) where.gameId = gameId;
  if (setId) where.setId = setId;
  if (q) where.name = { contains: q, mode: "insensitive" };

  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.cardDefinition.count({ where }),
    prisma.cardDefinition.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
    }),
  ]);

  return reply.send({
    data,
    pagination: buildPagination(page, pageSize, total),
  });
}
