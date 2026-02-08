import { z } from "zod";
import type { FastifyRequest } from "fastify";

export const PASSWORD_MIN = Number(process.env.PASSWORD_MIN ?? 8);
export const PENDING_REG_TTL_MINUTES = Number(process.env.PENDING_REG_TTL_MINUTES ?? 3);

export const AccountType = z.enum(["BUYER", "SELLER", "STORE"]);

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN),
  phone: z.string().optional().nullable(),
  accountType: AccountType.optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN),
});

export const VerifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
});

export const ResendSchema = z.object({
  email: z.string().email(),
});

export const RefreshSchema = z.object({});
export const LogoutSchema = z.object({});

export const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES ?? 10);
export const MAX_FAILED_LOGINS = Number(process.env.MAX_FAILED_LOGINS ?? 5);
export const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES ?? 15);
export const ACCESS_TTL_MINUTES = Number(process.env.JWT_ACCESS_TTL_MINUTES ?? 15);

export const REFRESH_COOKIE = process.env.REFRESH_COOKIE_NAME ?? "rt";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
const IS_PROD = process.env.NODE_ENV === "production";

export function cookieOptions(maxAgeSeconds?: number) {
  const domain = COOKIE_DOMAIN?.trim();
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: (IS_PROD ? "strict" : "lax") as "strict" | "lax",
    path: "/",
    ...(domain ? { domain } : {}),
    maxAge: maxAgeSeconds,
  };
}

export function getIp(request: FastifyRequest): string | undefined {
  return request.ip;
}
