"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReview = createReview;
exports.listUserReviews = listUserReviews;
exports.getReputation = getReputation;
const db_1 = require("../../db");
const pagination_1 = require("../../utils/pagination");
const reviews_model_1 = require("./reviews.model");
async function createReview(request, reply) {
    const body = reviews_model_1.ReviewCreateSchema.parse(request.body);
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
}
async function listUserReviews(request, reply) {
    const userId = request.params.id;
    const parsed = reviews_model_1.ReviewQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize } = parsed.data;
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.review.count({ where: { targetId: userId } }),
        db_1.prisma.review.findMany({
            where: { targetId: userId },
            include: { author: { select: { id: true, profile: true } } },
            orderBy: { createdAt: "desc" },
            skip,
            take,
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function getReputation(request, reply) {
    const userId = request.params.id;
    const rep = await db_1.prisma.review.aggregate({
        where: { targetId: userId },
        _avg: { rating: true },
        _count: { _all: true },
    });
    if (rep._count._all === 0)
        return reply.send({ data: null });
    return reply.send({
        data: {
            userId,
            averageRating: rep._avg.rating ?? 0,
            totalReviews: rep._count._all,
        },
    });
}
