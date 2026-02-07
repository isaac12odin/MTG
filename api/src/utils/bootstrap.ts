import argon2 from "argon2";
import { prisma } from "../db";
import { prepareEmail } from "../security/pii";

export async function ensureAdminOnStart() {
  const enabled = process.env.ADMIN_BOOTSTRAP_ON_START === "true";
  if (!enabled) return;

  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const existingAdmin = await prisma.userRole.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) return;

  const { emailEnc, emailHash } = prepareEmail(email);
  const existingUser = await prisma.user.findUnique({ where: { emailHash } });
  if (existingUser) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existingUser.id },
        data: { passwordHash: await argon2.hash(password, { type: argon2.argon2id }) },
      }),
      prisma.userRole.create({ data: { userId: existingUser.id, role: "ADMIN" } }),
      prisma.userSecurity.upsert({
        where: { userId: existingUser.id },
        create: { userId: existingUser.id, emailVerifiedAt: new Date(), manualVerifiedAt: new Date() },
        update: { emailVerifiedAt: new Date() },
      }),
      prisma.userProfile.upsert({
        where: { userId: existingUser.id },
        create: { userId: existingUser.id, displayName: "Admin", country: "MX" },
        update: {},
      }),
    ]);
    return;
  }

  await prisma.user.create({
    data: {
      emailEnc,
      emailHash,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      isActive: true,
      roles: { create: [{ role: "ADMIN" }] },
      security: { create: { emailVerifiedAt: new Date(), manualVerifiedAt: new Date() } },
      profile: { create: { displayName: "Admin", country: "MX" } },
    },
  });
}
