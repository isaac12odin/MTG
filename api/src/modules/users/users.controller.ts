import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../db";
import { decryptNullable, decryptString } from "../../security/crypto";
import {
  AddressCreateSchema,
  AddressUpdateSchema,
  ProfileUpdateSchema,
  VerificationRequestSchema,
} from "./users.model";

export async function getMe(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      security: true,
      reputation: true,
      followers: true,
      following: true,
      roles: true,
    },
  });
  if (!user) return reply.code(404).send({ error: "Not found" });

  return reply.send({
    data: {
      id: user.id,
      email: decryptString(user.emailEnc),
      phone: decryptNullable(user.phoneEnc),
      profile: user.profile,
      security: {
        emailVerifiedAt: user.security?.emailVerifiedAt ?? null,
        manualVerifiedAt: user.security?.manualVerifiedAt ?? null,
      },
      reputation: user.reputation,
      counts: {
        followers: user.followers.length,
        following: user.following.length,
      },
      roles: user.roles.map((r) => r.role),
    },
  });
}

export async function upsertProfile(request: FastifyRequest, reply: FastifyReply) {
  const body = ProfileUpdateSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  if (Object.keys(body).length === 0) {
    return reply.code(400).send({ error: "No changes provided" });
  }

  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (!existing && !body.displayName) {
    return reply.code(400).send({ error: "displayName is required to create profile" });
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      displayName: body.displayName ?? "User",
      bio: body.bio,
      city: body.city,
      country: body.country,
    },
    update: {
      displayName: body.displayName,
      bio: body.bio,
      city: body.city,
      country: body.country,
    },
  });

  return reply.send({ data: profile });
}

export async function listAddresses(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return reply.send({ data: addresses });
}

export async function createAddress(request: FastifyRequest, reply: FastifyReply) {
  const body = AddressCreateSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return tx.address.create({
      data: {
        userId,
        label: body.label,
        fullName: body.fullName,
        line1: body.line1,
        line2: body.line2,
        city: body.city,
        state: body.state,
        country: body.country,
        postalCode: body.postalCode,
        references: body.references,
        phone: body.phone,
        isDefault: body.isDefault ?? false,
      },
    });
  });

  return reply.code(201).send({ data: address });
}

export async function updateAddress(request: FastifyRequest, reply: FastifyReply) {
  const body = AddressUpdateSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const id = (request.params as { id: string }).id;
  const existing = await prisma.address.findFirst({ where: { id, userId } });
  if (!existing) return reply.code(404).send({ error: "Not found" });

  const updated = await prisma.$transaction(async (tx) => {
    if (body.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return tx.address.update({
      where: { id },
      data: {
        label: body.label,
        fullName: body.fullName,
        line1: body.line1,
        line2: body.line2,
        city: body.city,
        state: body.state,
        country: body.country,
        postalCode: body.postalCode,
        references: body.references,
        phone: body.phone,
        isDefault: body.isDefault,
      },
    });
  });

  return reply.send({ data: updated });
}

export async function deleteAddress(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const id = (request.params as { id: string }).id;
  const existing = await prisma.address.findFirst({ where: { id, userId } });
  if (!existing) return reply.code(404).send({ error: "Not found" });

  await prisma.address.delete({ where: { id } });
  return reply.send({ ok: true });
}

export async function setDefaultAddress(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const id = (request.params as { id: string }).id;
  const existing = await prisma.address.findFirst({ where: { id, userId } });
  if (!existing) return reply.code(404).send({ error: "Not found" });

  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id }, data: { isDefault: true } }),
  ]);

  return reply.send({ ok: true });
}

export async function requestVerification(request: FastifyRequest, reply: FastifyReply) {
  const body = VerificationRequestSchema.parse(request.body);
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const existing = await prisma.verificationRequest.findFirst({
    where: { userId, status: "PENDING" },
  });

  if (existing) {
    return reply.send({ data: existing });
  }

  const created = await prisma.verificationRequest.create({
    data: {
      userId,
      method: body.method,
      status: "PENDING",
      notes: body.notes,
    },
  });

  return reply.code(201).send({ data: created });
}

export async function followUser(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });
  const targetId = (request.params as { id: string }).id;
  if (targetId === userId) return reply.code(400).send({ error: "Cannot follow yourself" });

  const existing = await prisma.userFollow.findFirst({
    where: { followerId: userId, followingId: targetId },
  });
  if (existing) return reply.send({ data: existing });

  const follow = await prisma.userFollow.create({
    data: { followerId: userId, followingId: targetId },
  });
  return reply.code(201).send({ data: follow });
}

export async function unfollowUser(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });
  const targetId = (request.params as { id: string }).id;

  await prisma.userFollow.deleteMany({
    where: { followerId: userId, followingId: targetId },
  });
  return reply.send({ ok: true });
}

export async function listFollowers(request: FastifyRequest, reply: FastifyReply) {
  const targetId = (request.params as { id: string }).id;
  const followers = await prisma.userFollow.findMany({
    where: { followingId: targetId },
    include: { follower: { select: { id: true, profile: true } } },
    orderBy: { createdAt: "desc" },
  });
  return reply.send({ data: followers });
}

export async function listFollowing(request: FastifyRequest, reply: FastifyReply) {
  const targetId = (request.params as { id: string }).id;
  const following = await prisma.userFollow.findMany({
    where: { followerId: targetId },
    include: { following: { select: { id: true, profile: true } } },
    orderBy: { createdAt: "desc" },
  });
  return reply.send({ data: following });
}

export async function getPublicProfile(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { profile: true, reputation: true, followers: true, following: true },
  });
  if (!user) return reply.code(404).send({ error: "Not found" });

  return reply.send({
    data: {
      id: user.id,
      profile: user.profile,
      reputation: user.reputation,
      counts: {
        followers: user.followers.length,
        following: user.following.length,
      },
    },
  });
}
