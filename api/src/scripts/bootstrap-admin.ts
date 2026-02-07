import "dotenv/config";
import argon2 from "argon2";
import { prisma } from "../db";
import { prepareEmail } from "../security/pii";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  }

  const existingAdmin = await prisma.userRole.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) {
    console.log("Admin already exists. Skipping bootstrap.");
    return;
  }

  const { emailEnc, emailHash } = prepareEmail(email);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const existingUser = await prisma.user.findUnique({ where: { emailHash }, include: { roles: true } });

  if (existingUser) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existingUser.id },
        data: { passwordHash },
      }),
      prisma.userRole.upsert({
        where: { userId_role: { userId: existingUser.id, role: "ADMIN" } },
        create: { userId: existingUser.id, role: "ADMIN" },
        update: {},
      }),
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

    console.log(`Promoted existing user to ADMIN: ${email}`);
    return;
  }

  const user = await prisma.user.create({
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
    await prisma.$disconnect();
  });
