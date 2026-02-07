import type { FastifyReply, FastifyRequest } from "fastify";
import argon2 from "argon2";

import { prisma } from "../../db";
import { prepareEmail, preparePhone } from "../../security/pii";
import { hashEmail } from "../../security/hash";
import { generateOtp } from "../../security/otp";
import { hashToken } from "../../security/token-hash";
import { sendVerifyOtpEmail } from "../../security/mailer";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../../security/jwt";

import {
  ACCESS_TTL_MINUTES,
  cookieOptions,
  getIp,
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGINS,
  OTP_TTL_MINUTES,
  REFRESH_COOKIE,
  RegisterSchema,
  LoginSchema,
  VerifyEmailSchema,
  ResendSchema,
  RefreshSchema,
  LogoutSchema,
} from "./auth.model";

async function recordLoginAttempt(params: {
  userId?: string;
  emailHash?: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
}) {
  await prisma.loginAttempt.create({
    data: {
      userId: params.userId,
      emailHash: params.emailHash,
      ip: params.ip,
      userAgent: params.userAgent,
      success: params.success,
    },
  });
}

async function handleFailedLogin(userId: string) {
  const security = await prisma.userSecurity.findUnique({ where: { userId } });
  const failedCount = (security?.failedLoginCount ?? 0) + 1;
  const lockoutUntil =
    failedCount >= MAX_FAILED_LOGINS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
      : security?.lockoutUntil ?? null;

  await prisma.userSecurity.update({
    where: { userId },
    data: {
      failedLoginCount: failedCount,
      lockoutUntil,
    },
  });
}

async function resetFailedLogin(userId: string) {
  await prisma.userSecurity.update({
    where: { userId },
    data: {
      failedLoginCount: 0,
      lockoutUntil: null,
      lastLoginAt: new Date(),
    },
  });
}

async function createEmailOtp(userId: string, emailEnc: string, emailPlain: string) {
  const code = generateOtp();
  const codeHash = hashToken(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.emailOtp.create({
    data: {
      userId,
      codeHash,
      sentToEnc: emailEnc,
      expiresAt,
      purpose: "VERIFY_EMAIL",
    },
  });

  await sendVerifyOtpEmail(emailPlain, code);
}

export async function register(request: FastifyRequest, reply: FastifyReply) {
  const body = RegisterSchema.parse(request.body);
  const { emailEnc, emailHash } = prepareEmail(body.email);
  const { phoneEnc, phoneHash } = preparePhone(body.phone ?? null);

  const existing = await prisma.user.findUnique({ where: { emailHash } });
  if (existing) {
    return reply.code(409).send({ error: "Email already registered" });
  }

  const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });

  const user = await prisma.user.create({
    data: {
      emailEnc,
      emailHash,
      phoneEnc,
      phoneHash,
      passwordHash,
      roles: { create: [{ role: "BUYER" }, { role: "SELLER" }] },
      security: { create: {} },
    },
  });

  await createEmailOtp(user.id, emailEnc, body.email);

  return reply.code(201).send({ userId: user.id, verificationRequired: true });
}

export async function resendOtp(request: FastifyRequest, reply: FastifyReply) {
  const body = ResendSchema.parse(request.body);
  const emailHash = hashEmail(body.email);
  const user = await prisma.user.findUnique({ where: { emailHash }, include: { security: true } });

  if (!user) return reply.send({ ok: true });
  if (user.security?.emailVerifiedAt) return reply.send({ ok: true });

  await createEmailOtp(user.id, user.emailEnc, body.email);
  return reply.send({ ok: true });
}

export async function verifyEmail(request: FastifyRequest, reply: FastifyReply) {
  const body = VerifyEmailSchema.parse(request.body);
  const emailHash = hashEmail(body.email);
  const user = await prisma.user.findUnique({ where: { emailHash } });
  if (!user) return reply.code(400).send({ error: "Invalid code" });

  const otp = await prisma.emailOtp.findFirst({
    where: {
      userId: user.id,
      purpose: "VERIFY_EMAIL",
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || otp.codeHash !== hashToken(body.code)) {
    return reply.code(400).send({ error: "Invalid code" });
  }

  await prisma.$transaction([
    prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    prisma.userSecurity.update({ where: { userId: user.id }, data: { emailVerifiedAt: new Date() } }),
  ]);

  return reply.send({ ok: true });
}

export async function login(request: FastifyRequest, reply: FastifyReply) {
  const body = LoginSchema.parse(request.body);
  const emailHash = hashEmail(body.email);
  const user = await prisma.user.findUnique({
    where: { emailHash },
    include: { roles: true, security: true },
  });

  const ip = getIp(request);
  const userAgent = request.headers["user-agent"];

  if (!user || !user.security) {
    await recordLoginAttempt({ emailHash, ip, userAgent, success: false });
    return reply.code(401).send({ error: "Invalid credentials" });
  }
  if (!user.isActive) return reply.code(403).send({ error: "Account disabled" });

  if (user.security.lockoutUntil && user.security.lockoutUntil > new Date()) {
    return reply.code(429).send({ error: "Account locked. Try later." });
  }

  const ok = await argon2.verify(user.passwordHash, body.password);
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

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      ip,
      userAgent,
      deviceName: request.headers["x-device-name"] as string | undefined,
    },
  });

  const roles = user.roles.map((r) => r.role);
  const access = await signAccessToken({ userId: user.id, sessionId: session.id, roles });
  const refresh = await signRefreshToken({ userId: user.id, sessionId: session.id });

  await prisma.refreshToken.create({
    data: {
      sessionId: session.id,
      userId: user.id,
      tokenHash: hashToken(refresh.token),
      jti: refresh.jti,
      expiresAt: new Date(Date.now() + refresh.expiresInDays * 24 * 60 * 60 * 1000),
      ip,
      userAgent,
    },
  });

  reply.setCookie(REFRESH_COOKIE, refresh.token, cookieOptions(refresh.expiresInDays * 24 * 60 * 60));
  return reply.send({ accessToken: access.token, expiresInMinutes: access.expiresInMinutes });
}

export async function refresh(request: FastifyRequest, reply: FastifyReply) {
  RefreshSchema.parse(request.body);
  const token = request.cookies[REFRESH_COOKIE];
  if (!token) return reply.code(401).send({ error: "Missing refresh token" });

  let payload;
  try {
    payload = await verifyRefreshToken(token);
  } catch {
    return reply.code(401).send({ error: "Invalid refresh token" });
  }

  const stored = await prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
  if (!stored) return reply.code(401).send({ error: "Refresh token not found" });

  const session = await prisma.session.findUnique({ where: { id: stored.sessionId } });
  if (!session || session.revokedAt) return reply.code(401).send({ error: "Session revoked" });

  if (stored.revokedAt || stored.expiresAt <= new Date()) {
    await prisma.session.update({ where: { id: stored.sessionId }, data: { revokedAt: new Date() } });
    await prisma.refreshToken.updateMany({ where: { sessionId: stored.sessionId }, data: { revokedAt: new Date() } });
    return reply.code(401).send({ error: "Refresh token revoked" });
  }

  if (stored.tokenHash !== hashToken(token)) {
    await prisma.session.update({ where: { id: stored.sessionId }, data: { revokedAt: new Date() } });
    await prisma.refreshToken.updateMany({ where: { sessionId: stored.sessionId }, data: { revokedAt: new Date() } });
    return reply.code(401).send({ error: "Token reuse detected" });
  }

  const roleRows = await prisma.userRole.findMany({ where: { userId: payload.sub }, select: { role: true } });
  const roles = roleRows.map((r) => r.role);

  const access = await signAccessToken({ userId: payload.sub, sessionId: payload.sid, roles });
  const newRefresh = await signRefreshToken({ userId: payload.sub, sessionId: payload.sid });
  const newRefreshRecord = await prisma.refreshToken.create({
    data: {
      sessionId: stored.sessionId,
      userId: stored.userId,
      tokenHash: hashToken(newRefresh.token),
      jti: newRefresh.jti,
      expiresAt: new Date(Date.now() + newRefresh.expiresInDays * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedByTokenId: newRefreshRecord.id },
  });

  reply.setCookie(REFRESH_COOKIE, newRefresh.token, cookieOptions(newRefresh.expiresInDays * 24 * 60 * 60));
  return reply.send({ accessToken: access.token, expiresInMinutes: access.expiresInMinutes });
}

export async function logout(request: FastifyRequest, reply: FastifyReply) {
  LogoutSchema.parse(request.body);
  const refreshToken = request.cookies[REFRESH_COOKIE];
  if (refreshToken) {
    try {
      const payload = await verifyRefreshToken(refreshToken);
      const stored = await prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
      if (stored) {
        await prisma.session.update({ where: { id: stored.sessionId }, data: { revokedAt: new Date() } });
        await prisma.refreshToken.updateMany({ where: { sessionId: stored.sessionId }, data: { revokedAt: new Date() } });
      }
    } catch {
      // ignore invalid refresh token
    }
  }

  const auth = request.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const accessToken = auth.slice("Bearer ".length);
    try {
      const payload = await verifyAccessToken(accessToken);
      await prisma.accessTokenDenylist.create({
        data: { jti: payload.jti, expiresAt: new Date(Date.now() + ACCESS_TTL_MINUTES * 60 * 1000) },
      });
    } catch {
      // ignore
    }
  }

  reply.clearCookie(REFRESH_COOKIE, cookieOptions());
  return reply.send({ ok: true });
}

export async function listSessions(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return reply.send({ sessions });
}

export async function deleteSession(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const sessionId = (request.params as { id: string }).id;
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });
  if (!session) return reply.code(404).send({ error: "Session not found" });

  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  await prisma.refreshToken.updateMany({ where: { sessionId }, data: { revokedAt: new Date() } });

  return reply.send({ ok: true });
}
