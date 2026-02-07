"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = getMe;
exports.upsertProfile = upsertProfile;
exports.listAddresses = listAddresses;
exports.createAddress = createAddress;
exports.updateAddress = updateAddress;
exports.deleteAddress = deleteAddress;
exports.setDefaultAddress = setDefaultAddress;
exports.requestVerification = requestVerification;
const db_1 = require("../../db");
const crypto_1 = require("../../security/crypto");
const users_model_1 = require("./users.model");
async function getMe(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const user = await db_1.prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, security: true, reputation: true },
    });
    if (!user)
        return reply.code(404).send({ error: "Not found" });
    return reply.send({
        data: {
            id: user.id,
            email: (0, crypto_1.decryptString)(user.emailEnc),
            phone: (0, crypto_1.decryptNullable)(user.phoneEnc),
            profile: user.profile,
            security: {
                emailVerifiedAt: user.security?.emailVerifiedAt ?? null,
                manualVerifiedAt: user.security?.manualVerifiedAt ?? null,
            },
            reputation: user.reputation,
        },
    });
}
async function upsertProfile(request, reply) {
    const body = users_model_1.ProfileUpdateSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    if (Object.keys(body).length === 0) {
        return reply.code(400).send({ error: "No changes provided" });
    }
    const existing = await db_1.prisma.userProfile.findUnique({ where: { userId } });
    if (!existing && !body.displayName) {
        return reply.code(400).send({ error: "displayName is required to create profile" });
    }
    const profile = await db_1.prisma.userProfile.upsert({
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
async function listAddresses(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const addresses = await db_1.prisma.address.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return reply.send({ data: addresses });
}
async function createAddress(request, reply) {
    const body = users_model_1.AddressCreateSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const address = await db_1.prisma.$transaction(async (tx) => {
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
async function updateAddress(request, reply) {
    const body = users_model_1.AddressUpdateSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const id = request.params.id;
    const existing = await db_1.prisma.address.findFirst({ where: { id, userId } });
    if (!existing)
        return reply.code(404).send({ error: "Not found" });
    const updated = await db_1.prisma.$transaction(async (tx) => {
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
async function deleteAddress(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const id = request.params.id;
    const existing = await db_1.prisma.address.findFirst({ where: { id, userId } });
    if (!existing)
        return reply.code(404).send({ error: "Not found" });
    await db_1.prisma.address.delete({ where: { id } });
    return reply.send({ ok: true });
}
async function setDefaultAddress(request, reply) {
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const id = request.params.id;
    const existing = await db_1.prisma.address.findFirst({ where: { id, userId } });
    if (!existing)
        return reply.code(404).send({ error: "Not found" });
    await db_1.prisma.$transaction([
        db_1.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
        db_1.prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return reply.send({ ok: true });
}
async function requestVerification(request, reply) {
    const body = users_model_1.VerificationRequestSchema.parse(request.body);
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const existing = await db_1.prisma.verificationRequest.findFirst({
        where: { userId, status: "PENDING" },
    });
    if (existing) {
        return reply.send({ data: existing });
    }
    const created = await db_1.prisma.verificationRequest.create({
        data: {
            userId,
            method: body.method,
            status: "PENDING",
            notes: body.notes,
        },
    });
    return reply.code(201).send({ data: created });
}
