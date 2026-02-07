"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMessage = createMessage;
const db_1 = require("../../db");
const chat_model_1 = require("./chat.model");
async function createMessage(input) {
    const convo = await db_1.prisma.conversation.findFirst({
        where: {
            id: input.conversationId,
            OR: [{ userAId: input.senderId }, { userBId: input.senderId }],
        },
    });
    if (!convo) {
        return { ok: false, status: 404, error: "Not found" };
    }
    const expiresAt = new Date(Date.now() + chat_model_1.MESSAGE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const message = await db_1.prisma.message.create({
        data: {
            conversationId: input.conversationId,
            senderId: input.senderId,
            text: input.text,
            expiresAt,
        },
    });
    await db_1.prisma.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
    });
    const recipientId = convo.userAId === input.senderId ? convo.userBId : convo.userAId;
    return {
        ok: true,
        message,
        recipientId,
    };
}
