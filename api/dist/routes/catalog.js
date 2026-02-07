"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRoutes = catalogRoutes;
const zod_1 = require("zod");
const db_1 = require("../db");
const SetQuery = zod_1.z.object({
    gameId: zod_1.z.string().uuid(),
});
const CardQuery = zod_1.z.object({
    gameId: zod_1.z.string().uuid().optional(),
    setId: zod_1.z.string().uuid().optional(),
    q: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
async function catalogRoutes(app) {
    app.get("/games", async () => {
        const games = await db_1.prisma.game.findMany({ orderBy: { name: "asc" } });
        return { data: games };
    });
    app.get("/sets", async (request, reply) => {
        const parsed = SetQuery.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Invalid query" });
        }
        const sets = await db_1.prisma.set.findMany({
            where: { gameId: parsed.data.gameId },
            orderBy: { name: "asc" },
        });
        return { data: sets };
    });
    app.get("/cards", async (request, reply) => {
        const parsed = CardQuery.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: "Invalid query" });
        }
        const { page, pageSize, gameId, setId, q } = parsed.data;
        const where = {};
        if (gameId)
            where.gameId = gameId;
        if (setId)
            where.setId = setId;
        if (q) {
            where.name = { contains: q, mode: "insensitive" };
        }
        const [total, data] = await Promise.all([
            db_1.prisma.cardDefinition.count({ where }),
            db_1.prisma.cardDefinition.findMany({
                where,
                orderBy: { name: "asc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return {
            data,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    });
}
