import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db";
import { verifyAccessToken } from "./jwt";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing access token" });
    return;
  }

  const token = auth.slice("Bearer ".length);
  try {
    const payload = await verifyAccessToken(token);
    const deny = await prisma.accessTokenDenylist.findUnique({ where: { jti: payload.jti } });
    if (deny) {
      reply.code(401).send({ error: "Token revoked" });
      return;
    }
    request.user = payload;
  } catch {
    reply.code(401).send({ error: "Invalid token" });
  }
}

export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (reply.sent) return;
    const userRoles = request.user?.roles ?? [];
    const ok = roles.some((role) => userRoles.includes(role));
    if (!ok) {
      reply.code(403).send({ error: "Forbidden" });
    }
  };
}
