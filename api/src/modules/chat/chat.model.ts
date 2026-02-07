import { z } from "zod";

export const CreateConversationSchema = z.object({
  userId: z.string().uuid(),
  listingId: z.string().uuid().optional(),
});

export const MessageSchema = z.object({
  text: z.string().min(1).max(500),
});

export const MessagesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const MESSAGE_TTL_DAYS = Number(process.env.MESSAGE_TTL_DAYS ?? 40);
