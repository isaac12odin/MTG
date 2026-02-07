"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRoutes = reviewRoutes;
const zod_1 = require("zod");
const db_1 = require("../db");
const guards_1 = require("../security/guards");
const ReviewCreateSchema = zod_1.z.object({
    dealId: zod_1.z.string().uuid(),
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().max(1000).optional(),
});
const ReviewQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
async function reviewRoutes(app) {
    app.post("/reviews", { preHandler: guards_1.requireAuth, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = ReviewCreateSchema.parse(request.body);
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const deal = await db_1.prisma.deal.findUnique({ where: { id: body.dealId } });
        if (!deal)
            return reply.code(404).send({ error: "Deal not found" });
        const allowed = deal.buyerId === userId || deal.sellerId === userId;
        if (!allowed)
            return reply.code(403).send({ error: "Not allowed" });
        if (deal.status !== "DELIVERED" && deal.status !== "COMPLETED") {
            return reply.code(400).send({ error: "Deal not completed" });
        }
        const targetId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;
        const review = await db_1.prisma.review.create({
            data: {
                dealId: deal.id,
                authorId: userId,
                targetId,
                rating: body.rating,
                comment: body.comment,
            },
        });
        return reply.code(201).send({ data: review });
    });
    app.get("/users/:id/reviews", async (request, reply) => {
        const userId = request.params.id;
        const parsed = ReviewQuery.safeParse(request.query);
        if (!parsed.success)
            return reply.code(400).send({ error: "Invalid query" });
        const { page, pageSize } = parsed.data;
        const [total, data] = await Promise.all([
            db_1.prisma.review.count({ where: { targetId: userId, isHidden: false } }),
            db_1.prisma.review.findMany({
                where: { targetId: userId, isHidden: false },
                include: { author: { select: { id: true, profile: true } } },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return reply.send({
            data,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    });
    app.get("/users/:id/reputation", async (request, reply) => {
        const userId = request.params.id;
        const rep = await db_1.prisma.userReputation.findUnique({ where: { userId } });
        if (!rep)
            return reply.send({ data: null });
        return reply.send({ data: rep });
    });
}
