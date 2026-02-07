import { z } from "zod";
import type { FastifyRequest } from "fastify";

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  phone: z.string().optional().nullable(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
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
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict" as const,
    path: "/auth",
    domain: COOKIE_DOMAIN,
    maxAge: maxAgeSeconds,
  };
}

export function getIp(request: FastifyRequest): string | undefined {
  return request.ip;
}
