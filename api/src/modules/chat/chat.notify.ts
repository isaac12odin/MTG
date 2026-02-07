import { prisma } from "../../db";
import { decryptString } from "../../security/crypto";
import { sendEmail } from "../../security/mailer";
import { chatHub } from "./chat.hub";

const EMAIL_NOTIFICATIONS_ENABLED = process.env.CHAT_EMAIL_NOTIFICATIONS === "true";
const EMAIL_THROTTLE_MINUTES = Number(process.env.CHAT_EMAIL_THROTTLE_MINUTES ?? 5);

const lastEmailAt = new Map<string, number>();

function shouldSendEmail(recipientId: string, conversationId: string) {
  if (!EMAIL_NOTIFICATIONS_ENABLED) return false;
  const key = `${recipientId}:${conversationId}`;
  const last = lastEmailAt.get(key) ?? 0;
  if (Date.now() - last < EMAIL_THROTTLE_MINUTES * 60 * 1000) {
    return false;
  }
  lastEmailAt.set(key, Date.now());
  return true;
}

export async function notifyNewMessage(params: {
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    text: string;
    createdAt: Date;
    expiresAt: Date;
  };
  senderId: string;
  recipientId: string;
}) {
  const { message, senderId, recipientId } = params;

  chatHub.broadcastToUsers([senderId, recipientId], {
    type: "message",
    data: message,
  });

  if (!shouldSendEmail(recipientId, message.conversationId)) return;
  if (chatHub.hasActiveSocket(recipientId, message.conversationId)) return;

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    include: { security: true, profile: true },
  });

  if (!recipient || !recipient.isActive) return;
  if (!recipient.security?.emailVerifiedAt) return;

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    include: { profile: true },
  });

  const recipientEmail = decryptString(recipient.emailEnc);
  const senderName = sender?.profile?.displayName ?? "Un usuario";

  const subject = "Nuevo mensaje en TCG";
  const text = `Tienes un nuevo mensaje de ${senderName}.\n\nIngresa a la app para responder.`;

  try {
    await sendEmail({ to: recipientEmail, subject, text });
  } catch {
    // ignore mail errors; chat should still work
  }
}
