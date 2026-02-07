"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGames = listGames;
exports.listSets = listSets;
exports.listCards = listCards;
const db_1 = require("../../db");
const pagination_1 = require("../../utils/pagination");
const catalog_model_1 = require("./catalog.model");
async function listGames(_request, reply) {
    const games = await db_1.prisma.game.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
    });
    return reply.send({ data: games });
}
async function listSets(request, reply) {
    const parsed = catalog_model_1.SetQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const sets = await db_1.prisma.set.findMany({
        where: { gameId: parsed.data.gameId, game: { status: "ACTIVE" } },
        orderBy: { name: "asc" },
    });
    return reply.send({ data: sets });
}
async function listCards(request, reply) {
    const parsed = catalog_model_1.CardQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize, gameId, setId, q } = parsed.data;
    const where = { game: { status: "ACTIVE" } };
    if (gameId)
        where.gameId = gameId;
    if (setId)
        where.setId = setId;
    if (q)
        where.name = { contains: q, mode: "insensitive" };
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.cardDefinition.count({ where }),
        db_1.prisma.cardDefinition.findMany({
            where,
            orderBy: { name: "asc" },
            skip,
            take,
        }),
    ]);
    return reply.send({
        data,
        pagination: (0, pagination_1.buildPagination)(page, pageSize, total),
    });
}
