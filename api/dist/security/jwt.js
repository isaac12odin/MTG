"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
const jose_1 = require("jose");
const crypto_1 = __importDefault(require("crypto"));
const ACCESS_TTL_MINUTES = Number(process.env.JWT_ACCESS_TTL_MINUTES ?? 15);
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);
function getSecret(name) {
    const raw = process.env[name];
    if (!raw) {
        throw new Error(`${name} is not set`);
    }
    return new TextEncoder().encode(raw);
}
async function signAccessToken(input) {
    const jti = crypto_1.default.randomUUID();
    const token = await new jose_1.SignJWT({ roles: input.roles, sid: input.sessionId })
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
async function signRefreshToken(input) {
    const jti = crypto_1.default.randomUUID();
    const token = await new jose_1.SignJWT({ sid: input.sessionId })
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
async function verifyAccessToken(token) {
    const { payload } = await (0, jose_1.jwtVerify)(token, getSecret("JWT_ACCESS_SECRET"), {
        audience: "access",
        issuer: "tcg-api",
    });
    return payload;
}
async function verifyRefreshToken(token) {
    const { payload } = await (0, jose_1.jwtVerify)(token, getSecret("JWT_REFRESH_SECRET"), {
        audience: "refresh",
        issuer: "tcg-api",
    });
    return payload;
}
