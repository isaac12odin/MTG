"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listConversations = listConversations;
exports.createConversation = createConversation;
exports.listMessages = listMessages;
exports.sendMessage = sendMessage;
const db_1 = require("../../db");
const pagination_1 = require("../../utils/pagination");
const chat_model_1 = require("./chat.model");
const chat_service_1 = require("./chat.service");
const chat_notify_1 = require("./chat.notify");
async function listConversations(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const conversations = await db_1.prisma.conversation.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        include: {
            listing: true,
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
    });
    return reply.send({ data: conversations });
}
async function createConversation(request, reply) {
    const body = chat_model_1.CreateConversationSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    if (userId === body.userId)
        return reply.code(400).send({ error: "Invalid user" });
    const [userAId, userBId] = userId < body.userId ? [userId, body.userId] : [body.userId, userId];
    const existing = await db_1.prisma.conversation.findFirst({
        where: { userAId, userBId, listingId: body.listingId ?? null },
    });
    const convo = existing
        ? await db_1.prisma.conversation.update({ where: { id: existing.id }, data: { updatedAt: new Date() } })
        : await db_1.prisma.conversation.create({
            data: { userAId, userBId, listingId: body.listingId ?? null },
        });
    return reply.code(201).send({ data: convo });
}
async function listMessages(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const id = request.params.id;
    const convo = await db_1.prisma.conversation.findFirst({
        where: { id, OR: [{ userAId: userId }, { userBId: userId }] },
    });
    if (!convo)
        return reply.code(404).send({ error: "Not found" });
    const parsed = chat_model_1.MessagesQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const { page, pageSize } = parsed.data;
    const { skip, take } = (0, pagination_1.paginate)(page, pageSize);
    const [total, data] = await Promise.all([
        db_1.prisma.message.count({ where: { conversationId: id } }),
        db_1.prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: "desc" },
            skip,
            take,
        }),
    ]);
    return reply.send({ data, pagination: (0, pagination_1.buildPagination)(page, pageSize, total) });
}
async function sendMessage(request, reply) {
    const body = chat_model_1.MessageSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const id = request.params.id;
    const result = await (0, chat_service_1.createMessage)({ conversationId: id, senderId: userId, text: body.text });
    if (!result.ok)
        return reply.code(result.status).send({ error: result.error });
    await (0, chat_notify_1.notifyNewMessage)({
        message: result.message,
        senderId: userId,
        recipientId: result.recipientId,
    });
    return reply.code(201).send({ data: result.message });
}
