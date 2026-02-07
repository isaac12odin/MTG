"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const zod_1 = require("zod");
const argon2_1 = __importDefault(require("argon2"));
const db_1 = require("../db");
const pii_1 = require("../security/pii");
const hash_1 = require("../security/hash");
const otp_1 = require("../security/otp");
const token_hash_1 = require("../security/token-hash");
const mailer_1 = require("../security/mailer");
const jwt_1 = require("../security/jwt");
const guards_1 = require("../security/guards");
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES ?? 10);
const MAX_FAILED_LOGINS = Number(process.env.MAX_FAILED_LOGINS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES ?? 15);
const ACCESS_TTL_MINUTES = Number(process.env.JWT_ACCESS_TTL_MINUTES ?? 15);
const REFRESH_COOKIE = process.env.REFRESH_COOKIE_NAME ?? "rt";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
const IS_PROD = process.env.NODE_ENV === "production";
const RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(12),
    phone: zod_1.z.string().optional().nullable(),
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(12),
});
const VerifyEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    code: zod_1.z.string().min(6).max(6),
});
const ResendSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const RefreshSchema = zod_1.z.object({});
const LogoutSchema = zod_1.z.object({});
function cookieOptions(maxAgeSeconds) {
    return {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: "strict",
        path: "/auth",
        domain: COOKIE_DOMAIN,
        maxAge: maxAgeSeconds,
    };
}
function getIp(request) {
    return request.ip;
}
async function recordLoginAttempt(params) {
    await db_1.prisma.loginAttempt.create({
        data: {
            userId: params.userId,
            emailHash: params.emailHash,
            ip: params.ip,
            userAgent: params.userAgent,
            success: params.success,
        },
    });
}
async function handleFailedLogin(userId) {
    const security = await db_1.prisma.userSecurity.findUnique({ where: { userId } });
    const failedCount = (security?.failedLoginCount ?? 0) + 1;
    const lockoutUntil = failedCount >= MAX_FAILED_LOGINS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : security?.lockoutUntil ?? null;
    await db_1.prisma.userSecurity.update({
        where: { userId },
        data: {
            failedLoginCount: failedCount,
            lockoutUntil,
        },
    });
}
async function resetFailedLogin(userId) {
    await db_1.prisma.userSecurity.update({
        where: { userId },
        data: {
            failedLoginCount: 0,
            lockoutUntil: null,
            lastLoginAt: new Date(),
        },
    });
}
async function createEmailOtp(userId, emailEnc, emailPlain) {
    const code = (0, otp_1.generateOtp)();
    const codeHash = (0, token_hash_1.hashToken)(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await db_1.prisma.emailOtp.create({
        data: {
            userId,
            codeHash,
            sentToEnc: emailEnc,
            expiresAt,
            purpose: "VERIFY_EMAIL",
        },
    });
    await (0, mailer_1.sendVerifyOtpEmail)(emailPlain, code);
}
async function authRoutes(app) {
    app.post("/register", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, async (request, reply) => {
        const body = RegisterSchema.parse(request.body);
        const { emailEnc, emailHash } = (0, pii_1.prepareEmail)(body.email);
        const { phoneEnc, phoneHash } = (0, pii_1.preparePhone)(body.phone ?? null);
        const existing = await db_1.prisma.user.findUnique({ where: { emailHash } });
        if (existing) {
            return reply.code(409).send({ error: "Email already registered" });
        }
        const passwordHash = await argon2_1.default.hash(body.password, {
            type: argon2_1.default.argon2id,
        });
        const user = await db_1.prisma.user.create({
            data: {
                emailEnc,
                emailHash,
                phoneEnc,
                phoneHash,
                passwordHash,
                roles: {
                    create: [{ role: "BUYER" }, { role: "SELLER" }],
                },
                security: {
                    create: {},
                },
            },
        });
        await createEmailOtp(user.id, emailEnc, body.email);
        return reply.code(201).send({
            userId: user.id,
            verificationRequired: true,
        });
    });
    app.post("/otp/resend", { config: { rateLimit: { max: 3, timeWindow: "10 minutes" } } }, async (request, reply) => {
        const body = ResendSchema.parse(request.body);
        const emailHash = (0, hash_1.hashEmail)(body.email);
        const user = await db_1.prisma.user.findUnique({ where: { emailHash }, include: { security: true } });
        if (!user) {
            return reply.send({ ok: true });
        }
        if (user.security?.emailVerifiedAt) {
            return reply.send({ ok: true });
        }
        await createEmailOtp(user.id, user.emailEnc, body.email);
        return reply.send({ ok: true });
    });
    app.post("/verify-email", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, async (request, reply) => {
        const body = VerifyEmailSchema.parse(request.body);
        const emailHash = (0, hash_1.hashEmail)(body.email);
        const user = await db_1.prisma.user.findUnique({ where: { emailHash } });
        if (!user) {
            return reply.code(400).send({ error: "Invalid code" });
        }
        const otp = await db_1.prisma.emailOtp.findFirst({
            where: {
                userId: user.id,
                purpose: "VERIFY_EMAIL",
                consumedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });
        if (!otp || otp.codeHash !== (0, token_hash_1.hashToken)(body.code)) {
            return reply.code(400).send({ error: "Invalid code" });
        }
        await db_1.prisma.$transaction([
            db_1.prisma.emailOtp.update({
                where: { id: otp.id },
                data: { consumedAt: new Date() },
            }),
            db_1.prisma.userSecurity.update({
                where: { userId: user.id },
                data: { emailVerifiedAt: new Date() },
            }),
        ]);
        return reply.send({ ok: true });
    });
    app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (request, reply) => {
        const body = LoginSchema.parse(request.body);
        const emailHash = (0, hash_1.hashEmail)(body.email);
        const user = await db_1.prisma.user.findUnique({
            where: { emailHash },
            include: { roles: true, security: true },
        });
        const ip = getIp(request);
        const userAgent = request.headers["user-agent"];
        if (!user || !user.security) {
            await recordLoginAttempt({ emailHash, ip, userAgent, success: false });
            return reply.code(401).send({ error: "Invalid credentials" });
        }
        if (!user.isActive) {
            return reply.code(403).send({ error: "Account disabled" });
        }
        if (user.security.lockoutUntil && user.security.lockoutUntil > new Date()) {
            return reply.code(429).send({ error: "Account locked. Try later." });
        }
        const ok = await argon2_1.default.verify(user.passwordHash, body.password);
        if (!ok) {
            await handleFailedLogin(user.id);
            await recordLoginAttempt({ userId: user.id, emailHash, ip, userAgent, success: false });
            return reply.code(401).send({ error: "Invalid credentials" });
        }
        if (!user.security.emailVerifiedAt) {
            await createEmailOtp(user.id, user.emailEnc, body.email);
            return reply.code(403).send({ error: "Email not verified" });
        }
        await resetFailedLogin(user.id);
        await recordLoginAttempt({ userId: user.id, emailHash, ip, userAgent, success: true });
        const session = await db_1.prisma.session.create({
            data: {
                userId: user.id,
                ip,
                userAgent,
                deviceName: request.headers["x-device-name"],
            },
        });
        const roles = user.roles.map((r) => r.role);
        const access = await (0, jwt_1.signAccessToken)({
            userId: user.id,
            sessionId: session.id,
            roles,
        });
        const refresh = await (0, jwt_1.signRefreshToken)({ userId: user.id, sessionId: session.id });
        await db_1.prisma.refreshToken.create({
            data: {
                sessionId: session.id,
                userId: user.id,
                tokenHash: (0, token_hash_1.hashToken)(refresh.token),
                jti: refresh.jti,
                expiresAt: new Date(Date.now() + refresh.expiresInDays * 24 * 60 * 60 * 1000),
                ip,
                userAgent,
            },
        });
        reply.setCookie(REFRESH_COOKIE, refresh.token, cookieOptions(refresh.expiresInDays * 24 * 60 * 60));
        return reply.send({
            accessToken: access.token,
            expiresInMinutes: access.expiresInMinutes,
        });
    });
    app.post("/refresh", async (request, reply) => {
        RefreshSchema.parse(request.body);
        const token = request.cookies[REFRESH_COOKIE];
        if (!token) {
            return reply.code(401).send({ error: "Missing refresh token" });
        }
        let payload;
        try {
            payload = await (0, jwt_1.verifyRefreshToken)(token);
        }
        catch (err) {
            return reply.code(401).send({ error: "Invalid refresh token" });
        }
        const stored = await db_1.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
        if (!stored) {
            return reply.code(401).send({ error: "Refresh token not found" });
        }
        const session = await db_1.prisma.session.findUnique({ where: { id: stored.sessionId } });
        if (!session || session.revokedAt) {
            return reply.code(401).send({ error: "Session revoked" });
        }
        if (stored.revokedAt || stored.expiresAt <= new Date()) {
            await db_1.prisma.session.update({
                where: { id: stored.sessionId },
                data: { revokedAt: new Date() },
            });
            await db_1.prisma.refreshToken.updateMany({
                where: { sessionId: stored.sessionId },
                data: { revokedAt: new Date() },
            });
            return reply.code(401).send({ error: "Refresh token revoked" });
        }
        if (stored.tokenHash !== (0, token_hash_1.hashToken)(token)) {
            await db_1.prisma.session.update({
                where: { id: stored.sessionId },
                data: { revokedAt: new Date() },
            });
            await db_1.prisma.refreshToken.updateMany({
                where: { sessionId: stored.sessionId },
                data: { revokedAt: new Date() },
            });
            return reply.code(401).send({ error: "Token reuse detected" });
        }
        const roleRows = await db_1.prisma.userRole.findMany({
            where: { userId: payload.sub },
            select: { role: true },
        });
        const roles = roleRows.map((r) => r.role);
        const access = await (0, jwt_1.signAccessToken)({
            userId: payload.sub,
            sessionId: payload.sid,
            roles,
        });
        const newRefresh = await (0, jwt_1.signRefreshToken)({ userId: payload.sub, sessionId: payload.sid });
        const newRefreshRecord = await db_1.prisma.refreshToken.create({
            data: {
                sessionId: stored.sessionId,
                userId: stored.userId,
                tokenHash: (0, token_hash_1.hashToken)(newRefresh.token),
                jti: newRefresh.jti,
                expiresAt: new Date(Date.now() + newRefresh.expiresInDays * 24 * 60 * 60 * 1000),
            },
        });
        await db_1.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date(), replacedByTokenId: newRefreshRecord.id },
        });
        reply.setCookie(REFRESH_COOKIE, newRefresh.token, cookieOptions(newRefresh.expiresInDays * 24 * 60 * 60));
        return reply.send({ accessToken: access.token, expiresInMinutes: access.expiresInMinutes });
    });
    app.post("/logout", async (request, reply) => {
        LogoutSchema.parse(request.body);
        const refreshToken = request.cookies[REFRESH_COOKIE];
        if (refreshToken) {
            try {
                const payload = await (0, jwt_1.verifyRefreshToken)(refreshToken);
                const stored = await db_1.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
                if (stored) {
                    await db_1.prisma.session.update({
                        where: { id: stored.sessionId },
                        data: { revokedAt: new Date() },
                    });
                    await db_1.prisma.refreshToken.updateMany({
                        where: { sessionId: stored.sessionId },
                        data: { revokedAt: new Date() },
                    });
                }
            }
            catch {
                // ignore invalid refresh token
            }
        }
        const auth = request.headers.authorization;
        if (auth?.startsWith("Bearer ")) {
            const accessToken = auth.slice("Bearer ".length);
            try {
                const payload = await (0, jwt_1.verifyAccessToken)(accessToken);
                await db_1.prisma.accessTokenDenylist.create({
                    data: {
                        jti: payload.jti,
                        expiresAt: new Date(Date.now() + ACCESS_TTL_MINUTES * 60 * 1000),
                    },
                });
            }
            catch {
                // ignore
            }
        }
        reply.clearCookie(REFRESH_COOKIE, cookieOptions());
        return reply.send({ ok: true });
    });
    app.get("/sessions", { preHandler: guards_1.requireAuth }, async (request, reply) => {
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const sessions = await db_1.prisma.session.findMany({
            where: { userId, revokedAt: null },
            orderBy: { createdAt: "desc" },
        });
        return reply.send({ sessions });
    });
    app.delete("/sessions/:id", { preHandler: guards_1.requireAuth }, async (request, reply) => {
        const userId = request.user?.sub;
        if (!userId)
            return reply.code(401).send({ error: "Unauthorized" });
        const sessionId = request.params.id;
        const session = await db_1.prisma.session.findFirst({ where: { id: sessionId, userId } });
        if (!session) {
            return reply.code(404).send({ error: "Session not found" });
        }
        await db_1.prisma.session.update({
            where: { id: sessionId },
            data: { revokedAt: new Date() },
        });
        await db_1.prisma.refreshToken.updateMany({
            where: { sessionId },
            data: { revokedAt: new Date() },
        });
        return reply.send({ ok: true });
    });
}
