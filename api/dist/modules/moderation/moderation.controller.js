"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUser = verifyUser;
exports.hideReview = hideReview;
const db_1 = require("../../db");
const moderation_model_1 = require("./moderation.model");
async function verifyUser(request, reply) {
    const body = moderation_model_1.VerifySchema.parse(request.body);
    const userId = request.params.id;
    const moderatorId = request.user?.sub;
    if (!moderatorId)
        return reply.code(401).send({ error: "Unauthorized" });
    const user = await db_1.prisma.user.findUnique({ where: { id: userId }, include: { security: true } });
    if (!user || !user.security)
        return reply.code(404).send({ error: "User not found" });
    const now = new Date();
    const approved = body.status === "APPROVED";
    await db_1.prisma.$transaction([
        db_1.prisma.verificationRequest.create({
            data: {
                userId,
                method: "STAFF_REVIEW",
                status: body.status,
                notes: body.notes,
                reviewedBy: moderatorId,
                reviewedAt: now,
            },
        }),
        db_1.prisma.userSecurity.update({
            where: { userId },
            data: {
                manualVerifiedAt: approved ? now : null,
                manualVerifiedById: approved ? moderatorId : null,
                manualVerificationNotes: body.notes,
            },
        }),
    ]);
    return reply.send({ ok: true, status: body.status });
}
async function hideReview(request, reply) {
    const id = request.params.id;
    const moderatorId = request.user?.sub;
    if (!moderatorId)
        return reply.code(401).send({ error: "Unauthorized" });
    const review = await db_1.prisma.review.findUnique({ where: { id } });
    if (!review)
        return reply.code(404).send({ error: "Review not found" });
    const updated = await db_1.prisma.review.update({
        where: { id },
        data: { isHidden: true, hiddenAt: new Date(), hiddenById: moderatorId },
    });
    return reply.send({ data: updated });
}
