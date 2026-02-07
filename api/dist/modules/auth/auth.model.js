"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_COOKIE = exports.ACCESS_TTL_MINUTES = exports.LOCKOUT_MINUTES = exports.MAX_FAILED_LOGINS = exports.OTP_TTL_MINUTES = exports.LogoutSchema = exports.RefreshSchema = exports.ResendSchema = exports.VerifyEmailSchema = exports.LoginSchema = exports.RegisterSchema = exports.PASSWORD_MIN = void 0;
exports.cookieOptions = cookieOptions;
exports.getIp = getIp;
const zod_1 = require("zod");
exports.PASSWORD_MIN = Number(process.env.PASSWORD_MIN ?? 8);
exports.RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(exports.PASSWORD_MIN),
    phone: zod_1.z.string().optional().nullable(),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(exports.PASSWORD_MIN),
});
exports.VerifyEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    code: zod_1.z.string().min(6).max(6),
});
exports.ResendSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.RefreshSchema = zod_1.z.object({});
exports.LogoutSchema = zod_1.z.object({});
exports.OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES ?? 10);
exports.MAX_FAILED_LOGINS = Number(process.env.MAX_FAILED_LOGINS ?? 5);
exports.LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES ?? 15);
exports.ACCESS_TTL_MINUTES = Number(process.env.JWT_ACCESS_TTL_MINUTES ?? 15);
exports.REFRESH_COOKIE = process.env.REFRESH_COOKIE_NAME ?? "rt";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
const IS_PROD = process.env.NODE_ENV === "production";
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
