import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../security/guards";
import { createConversation, listConversations, listMessages, sendMessage } from "./chat.controller";

export async function chatRoutes(app: FastifyInstance) {
  app.get("/conversations", { preHandler: requireAuth }, listConversations);
  app.post(
    "/conversations",
    { preHandler: requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    createConversation
  );
  app.get("/conversations/:id/messages", { preHandler: requireAuth }, listMessages);
  app.post(
    "/conversations/:id/messages",
    { preHandler: requireAuth, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    sendMessage
  );
}
