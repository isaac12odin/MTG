import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../db";
import { buildPagination, paginate } from "../../utils/pagination";
import { CreateConversationSchema, MessageSchema, MessagesQuery } from "./chat.model";
import { createMessage } from "./chat.service";
import { notifyNewMessage } from "./chat.notify";

export async function listConversations(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: { id: true, profile: true } },
      userB: { select: { id: true, profile: true } },
      listing: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return reply.send({ data: conversations });
}

export async function createConversation(request: FastifyRequest, reply: FastifyReply) {
  const body = CreateConversationSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });
  if (userId === body.userId) return reply.code(400).send({ error: "Invalid user" });

  const [userAId, userBId] = userId < body.userId ? [userId, body.userId] : [body.userId, userId];

  const existing = await prisma.conversation.findFirst({
    where: { userAId, userBId, listingId: body.listingId ?? null },
  });

  const convo = existing
    ? await prisma.conversation.update({ where: { id: existing.id }, data: { updatedAt: new Date() } })
    : await prisma.conversation.create({
        data: { userAId, userBId, listingId: body.listingId ?? null },
      });

  return reply.code(201).send({ data: convo });
}

export async function listMessages(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const id = (request.params as { id: string }).id;
  const convo = await prisma.conversation.findFirst({
    where: { id, OR: [{ userAId: userId }, { userBId: userId }] },
  });
  if (!convo) return reply.code(404).send({ error: "Not found" });

  const parsed = MessagesQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });

  const { page, pageSize } = parsed.data;
  const { skip, take } = paginate(page, pageSize);
  const [total, data] = await Promise.all([
    prisma.message.count({ where: { conversationId: id } }),
    prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  return reply.send({ data, pagination: buildPagination(page, pageSize, total) });
}

export async function sendMessage(request: FastifyRequest, reply: FastifyReply) {
  const body = MessageSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const id = (request.params as { id: string }).id;
  const result = await createMessage({ conversationId: id, senderId: userId, text: body.text });
  if (!result.ok) return reply.code(result.status).send({ error: result.error });

  await notifyNewMessage({
    message: result.message,
    senderId: userId,
    recipientId: result.recipientId,
  });

  return reply.code(201).send({ data: result.message });
}
