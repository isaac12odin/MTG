import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

const ACCESS_TTL_MINUTES = Number(process.env.JWT_ACCESS_TTL_MINUTES ?? 15);
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);

function getSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): Uint8Array {
  const raw = process.env[name];
  if (!raw) {
    throw new Error(`${name} is not set`);
  }
  return new TextEncoder().encode(raw);
}

export type AccessTokenPayload = {
  sub: string;
  sid: string;
  roles: string[];
  jti: string;
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
  jti: string;
};

export async function signAccessToken(input: {
  userId: string;
  sessionId: string;
  roles: string[];
}) {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({ roles: input.roles, sid: input.sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setSubject(input.userId)
    .setJti(jti)
    .setExpirationTime(`${ACCESS_TTL_MINUTES}m`)
    .setAudience("access")
    .setIssuer("tcg-api")
    .sign(getSecret("JWT_ACCESS_SECRET"));

  return {
    token,
    jti,
    expiresInMinutes: ACCESS_TTL_MINUTES,
  };
}

export async function signRefreshToken(input: {
  userId: string;
  sessionId: string;
}) {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({ sid: input.sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setSubject(input.userId)
    .setJti(jti)
    .setExpirationTime(`${REFRESH_TTL_DAYS}d`)
    .setAudience("refresh")
    .setIssuer("tcg-api")
    .sign(getSecret("JWT_REFRESH_SECRET"));

  return {
    token,
    jti,
    expiresInDays: REFRESH_TTL_DAYS,
  };
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret("JWT_ACCESS_SECRET"), {
    audience: "access",
    issuer: "tcg-api",
  });
  return payload as unknown as AccessTokenPayload;
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret("JWT_REFRESH_SECRET"), {
    audience: "refresh",
    issuer: "tcg-api",
  });
  return payload as unknown as RefreshTokenPayload;
}
