"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoutes = chatRoutes;
const zod_1 = require("zod");
const db_1 = require("../db");
const guards_1 = require("../security/guards");
const MESSAGE_TTL_DAYS = Number(process.env.MESSAGE_TTL_DAYS ?? 40);
const CreateConversationSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    listingId: zod_1.z.string().uuid().optional(),
});
const MessageSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(500),
});
const MessagesQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
async function chatRoutes(app) {
    app.get("/conversations", { preHandler: guards_1.requireAuth }, async (request, reply) => {
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const conversations = await db_1.prisma.conversation.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            include: {
                listing: true,
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        return reply.send({ data: conversations });
    });
    app.post("/conversations", { preHandler: guards_1.requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = CreateConversationSchema.parse(request.body);
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        if (userId === body.userId)
            return reply.code(400).send({ error: "Invalid user" });
        const [userAId, userBId] = userId < body.userId ? [userId, body.userId] : [body.userId, userId];
        const existing = await db_1.prisma.conversation.findFirst({
            where: {
                userAId,
                userBId,
                listingId: body.listingId ?? null,
            },
        });
        const convo = existing
            ? await db_1.prisma.conversation.update({
                where: { id: existing.id },
                data: { updatedAt: new Date() },
            })
            : await db_1.prisma.conversation.create({
                data: {
                    userAId,
                    userBId,
                    listingId: body.listingId ?? null,
                },
            });
        return reply.code(201).send({ data: convo });
    });
    app.get("/conversations/:id/messages", { preHandler: guards_1.requireAuth }, async (request, reply) => {
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const id = request.params.id;
        const convo = await db_1.prisma.conversation.findFirst({
            where: { id, OR: [{ userAId: userId }, { userBId: userId }] },
        });
        if (!convo)
            return reply.code(404).send({ error: "Not found" });
        const parsed = MessagesQuery.safeParse(request.query);
        if (!parsed.success)
            return reply.code(400).send({ error: "Invalid query" });
        const { page, pageSize } = parsed.data;
        const [total, data] = await Promise.all([
            db_1.prisma.message.count({ where: { conversationId: id } }),
            db_1.prisma.message.findMany({
                where: { conversationId: id },
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
    app.post("/conversations/:id/messages", { preHandler: guards_1.requireAuth, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = MessageSchema.parse(request.body);
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const id = request.params.id;
        const convo = await db_1.prisma.conversation.findFirst({
            where: { id, OR: [{ userAId: userId }, { userBId: userId }] },
        });
        if (!convo)
            return reply.code(404).send({ error: "Not found" });
        const expiresAt = new Date(Date.now() + MESSAGE_TTL_DAYS * 24 * 60 * 60 * 1000);
        const message = await db_1.prisma.message.create({
            data: {
                conversationId: id,
                senderId: userId,
                text: body.text,
                expiresAt,
            },
        });
        await db_1.prisma.conversation.update({
            where: { id },
            data: { updatedAt: new Date() },
        });
        return reply.code(201).send({ data: message });
    });
}
