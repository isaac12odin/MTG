"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyNewMessage = notifyNewMessage;
const db_1 = require("../../db");
const crypto_1 = require("../../security/crypto");
const mailer_1 = require("../../security/mailer");
const chat_hub_1 = require("./chat.hub");
const EMAIL_NOTIFICATIONS_ENABLED = process.env.CHAT_EMAIL_NOTIFICATIONS === "true";
const EMAIL_THROTTLE_MINUTES = Number(process.env.CHAT_EMAIL_THROTTLE_MINUTES ?? 5);
const lastEmailAt = new Map();
function shouldSendEmail(recipientId, conversationId) {
    if (!EMAIL_NOTIFICATIONS_ENABLED)
        return false;
    const key = `${recipientId}:${conversationId}`;
    const last = lastEmailAt.get(key) ?? 0;
    if (Date.now() - last < EMAIL_THROTTLE_MINUTES * 60 * 1000) {
        return false;
    }
    lastEmailAt.set(key, Date.now());
    return true;
}
async function notifyNewMessage(params) {
    const { message, senderId, recipientId } = params;
    chat_hub_1.chatHub.broadcastToUsers([senderId, recipientId], {
        type: "message",
        data: message,
    });
    if (!shouldSendEmail(recipientId, message.conversationId))
        return;
    if (chat_hub_1.chatHub.hasActiveSocket(recipientId))
        return;
    const recipient = await db_1.prisma.user.findUnique({
        where: { id: recipientId },
        include: { security: true, profile: true },
    });
    if (!recipient || !recipient.isActive)
        return;
    if (!recipient.security?.emailVerifiedAt)
        return;
    const sender = await db_1.prisma.user.findUnique({
        where: { id: senderId },
        include: { profile: true },
    });
    const recipientEmail = (0, crypto_1.decryptString)(recipient.emailEnc);
    const senderName = sender?.profile?.displayName ?? "Un usuario";
    const subject = "Nuevo mensaje en TCG";
    const text = `Tienes un nuevo mensaje de ${senderName}.\n\nIngresa a la app para responder.`;
    try {
        await (0, mailer_1.sendEmail)({ to: recipientEmail, subject, text });
    }
    catch {
        // ignore mail errors; chat should still work
    }
}
