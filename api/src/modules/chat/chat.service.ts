import { prisma } from "../../db";
import { MESSAGE_TTL_DAYS } from "./chat.model";

type CreateMessageInput = {
  conversationId: string;
  senderId: string;
  text: string;
};

type CreateMessageResult =
  | {
      ok: true;
      message: {
        id: string;
        conversationId: string;
        senderId: string;
        text: string;
        createdAt: Date;
        expiresAt: Date;
      };
      recipientId: string;
    }
  | { ok: false; status: number; error: string };

export async function createMessage(input: CreateMessageInput): Promise<CreateMessageResult> {
  const convo = await prisma.conversation.findFirst({
    where: {
      id: input.conversationId,
      OR: [{ userAId: input.senderId }, { userBId: input.senderId }],
    },
  });

  if (!convo) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const expiresAt = new Date(Date.now() + MESSAGE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const message = await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      senderId: input.senderId,
      text: input.text,
      expiresAt,
    },
  });

  await prisma.conversation.update({
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
