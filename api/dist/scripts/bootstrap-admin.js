"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const argon2_1 = __importDefault(require("argon2"));
const db_1 = require("../db");
const pii_1 = require("../security/pii");
async function main() {
    const email = process.env.ADMIN_EMAIL?.trim();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    }
    const existingAdmin = await db_1.prisma.userRole.findFirst({ where: { role: "ADMIN" } });
    if (existingAdmin) {
        console.log("Admin already exists. Skipping bootstrap.");
        return;
    }
    const { emailEnc, emailHash } = (0, pii_1.prepareEmail)(email);
    const passwordHash = await argon2_1.default.hash(password, { type: argon2_1.default.argon2id });
    const existingUser = await db_1.prisma.user.findUnique({ where: { emailHash }, include: { roles: true } });
    if (existingUser) {
        await db_1.prisma.$transaction([
            db_1.prisma.user.update({
                where: { id: existingUser.id },
                data: { passwordHash },
            }),
            db_1.prisma.userRole.upsert({
                where: { userId_role: { userId: existingUser.id, role: "ADMIN" } },
                create: { userId: existingUser.id, role: "ADMIN" },
                update: {},
            }),
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
        console.log(`Promoted existing user to ADMIN: ${email}`);
        return;
    }
    const user = await db_1.prisma.user.create({
        data: {
            emailEnc,
            emailHash,
            passwordHash,
            isActive: true,
            roles: { create: [{ role: "ADMIN" }] },
            security: { create: { emailVerifiedAt: new Date(), manualVerifiedAt: new Date() } },
            profile: { create: { displayName: "Admin", country: "MX" } },
        },
    });
    console.log(`Admin created: ${user.id} (${email})`);
}
main()
    .catch((err) => {
    console.error(err);
    process.exit(1);
})
    .finally(async () => {
    await db_1.prisma.$disconnect();
});
