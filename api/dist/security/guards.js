"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const db_1 = require("../db");
const jwt_1 = require("./jwt");
async function requireAuth(request, reply) {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
        reply.code(401).send({ error: "Missing access token" });
        return;
    }
    const token = auth.slice("Bearer ".length);
    try {
        const payload = await (0, jwt_1.verifyAccessToken)(token);
        const deny = await db_1.prisma.accessTokenDenylist.findUnique({ where: { jti: payload.jti } });
        if (deny) {
            reply.code(401).send({ error: "Token revoked" });
            return;
        }
        request.user = payload;
    }
    catch {
        reply.code(401).send({ error: "Invalid token" });
    }
}
function requireRole(roles) {
    return async (request, reply) => {
        await requireAuth(request, reply);
        if (reply.sent)
            return;
        const userRoles = request.user?.roles ?? [];
        const ok = roles.some((role) => userRoles.includes(role));
        if (!ok) {
            reply.code(403).send({ error: "Forbidden" });
        }
    };
}
