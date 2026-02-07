import type { FastifyInstance } from "fastify";
import type { RawData } from "ws";

import { prisma } from "../../db";
import { verifyAccessToken } from "../../security/jwt";
import { MessageSchema } from "./chat.model";
import { createMessage } from "./chat.service";
import { notifyNewMessage } from "./chat.notify";
import { chatHub } from "./chat.hub";

type WsInbound =
  | { type: "ping" }
  | { type: "join"; conversationId: string }
  | { type: "message"; conversationId: string; text: string };

const HEARTBEAT_INTERVAL_MS = Number(process.env.WS_HEARTBEAT_INTERVAL_MS ?? 30000);
const HEARTBEAT_TIMEOUT_MS = Number(process.env.WS_HEARTBEAT_TIMEOUT_MS ?? 30000);

function extractToken(req: { headers: Record<string, string | string[] | undefined>; raw: { url?: string } }) {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
  }
  const url = req.raw.url ?? "";
  const query = url.split("?")[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  return params.get("token");
}

function parsePayload(raw: RawData): WsInbound | null {
  const text = typeof raw === "string" ? raw : raw.toString();
  try {
    const payload = JSON.parse(text);
    if (!payload || typeof payload.type !== "string") return null;
    return payload as WsInbound;
  } catch {
    return null;
  }
}

export async function registerChatWebsocket(app: FastifyInstance) {
  app.get("/ws/chat", { websocket: true }, async (socket, req) => {
    const token = extractToken(req);
    if (!token) {
      socket.send(JSON.stringify({ type: "error", error: "Unauthorized" }));
      socket.close(1008, "Unauthorized");
      return;
    }

    let userId = "";
    try {
      const payload = await verifyAccessToken(token);
      const deny = await prisma.accessTokenDenylist.findUnique({ where: { jti: payload.jti } });
      if (deny) {
        socket.send(JSON.stringify({ type: "error", error: "Token revoked" }));
        socket.close(1008, "Token revoked");
        return;
      }
      userId = payload.sub;
    } catch {
      socket.send(JSON.stringify({ type: "error", error: "Invalid token" }));
      socket.close(1008, "Invalid token");
      return;
    }

    chatHub.addSocket(userId, socket);
    socket.send(JSON.stringify({ type: "ready", userId }));

    let isAlive = true;

    socket.on("pong", () => {
      isAlive = true;
    });

    const heartbeat = setInterval(() => {
      if (!isAlive) {
        try {
          socket.terminate();
        } catch {
          // ignore
        }
        return;
      }
      isAlive = false;
      try {
        socket.ping();
      } catch {
        // ignore ping failures
      }
    }, HEARTBEAT_INTERVAL_MS);

    const heartbeatTimeout = setTimeout(() => {
      if (!isAlive) {
        try {
          socket.terminate();
        } catch {
          // ignore
        }
      }
    }, HEARTBEAT_TIMEOUT_MS);

    socket.on("close", () => {
      clearInterval(heartbeat);
      clearTimeout(heartbeatTimeout);
      chatHub.removeSocket(userId, socket);
    });

    socket.on("message", async (raw: RawData) => {
      const payload = parsePayload(raw);
      if (!payload) {
        socket.send(JSON.stringify({ type: "error", error: "Invalid payload" }));
        return;
      }

      if (payload.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (payload.type === "join") {
        const convo = await prisma.conversation.findFirst({
          where: {
            id: payload.conversationId,
            OR: [{ userAId: userId }, { userBId: userId }],
          },
        });
        if (!convo) {
          socket.send(JSON.stringify({ type: "error", error: "Conversation not found" }));
          return;
        }
        chatHub.markJoined(userId, socket, payload.conversationId);
        socket.send(JSON.stringify({ type: "joined", conversationId: payload.conversationId }));
        return;
      }

      if (payload.type === "message") {
        const parsed = MessageSchema.safeParse({ text: payload.text });
        if (!parsed.success) {
          socket.send(JSON.stringify({ type: "error", error: "Invalid message" }));
          return;
        }

        const result = await createMessage({
          conversationId: payload.conversationId,
          senderId: userId,
          text: parsed.data.text,
        });

        if (!result.ok) {
          socket.send(JSON.stringify({ type: "error", error: result.error }));
          return;
        }

        await notifyNewMessage({
          message: result.message,
          senderId: userId,
          recipientId: result.recipientId,
        });

        chatHub.markJoined(userId, socket, payload.conversationId);
        return;
      }
    });
  });
}
