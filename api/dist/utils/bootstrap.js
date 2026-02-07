"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAdminOnStart = ensureAdminOnStart;
const argon2_1 = __importDefault(require("argon2"));
const db_1 = require("../db");
const pii_1 = require("../security/pii");
async function ensureAdminOnStart() {
    const enabled = process.env.ADMIN_BOOTSTRAP_ON_START === "true";
    if (!enabled)
        return;
    const email = process.env.ADMIN_EMAIL?.trim();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password)
        return;
    const existingAdmin = await db_1.prisma.userRole.findFirst({ where: { role: "ADMIN" } });
    if (existingAdmin)
        return;
    const { emailEnc, emailHash } = (0, pii_1.prepareEmail)(email);
    const existingUser = await db_1.prisma.user.findUnique({ where: { emailHash } });
    if (existingUser) {
        await db_1.prisma.$transaction([
            db_1.prisma.user.update({
                where: { id: existingUser.id },
                data: { passwordHash: await argon2_1.default.hash(password, { type: argon2_1.default.argon2id }) },
            }),
            db_1.prisma.userRole.create({ data: { userId: existingUser.id, role: "ADMIN" } }),
            db_1.prisma.userSecurity.upsert({
                where: { userId: existingUser.id },
                create: { userId: existingUser.id, emailVerifiedAt: new Date(), manualVerifiedAt: new Date() },
                update: { emailVerifiedAt: new Date() },
            }),
            db_1.prisma.userProfile.upsert({
                where: { userId: existingUser.id },
                create: { userId: existingUser.id, displayName: "Admin", country: "MX" },
                update: {},
            }),
        ]);
        return;
    }
    await db_1.prisma.user.create({
        data: {
            emailEnc,
            emailHash,
            passwordHash: await argon2_1.default.hash(password, { type: argon2_1.default.argon2id }),
            isActive: true,
            roles: { create: [{ role: "ADMIN" }] },
            security: { create: { emailVerifiedAt: new Date(), manualVerifiedAt: new Date() } },
            profile: { create: { displayName: "Admin", country: "MX" } },
        },
    });
}
