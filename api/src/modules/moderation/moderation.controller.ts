import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../../db";
import { VerifySchema } from "./moderation.model";

export async function verifyUser(request: FastifyRequest, reply: FastifyReply) {
  const body = VerifySchema.parse(request.body);
  const userId = (request.params as { id: string }).id;
  const moderatorId = request.user?.sub;
  if (!moderatorId) return reply.code(401).send({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { security: true } });
  if (!user || !user.security) return reply.code(404).send({ error: "User not found" });

  const now = new Date();
  const approved = body.status === "APPROVED";

  await prisma.$transaction([
    prisma.verificationRequest.create({
      data: {
        userId,
        method: "STAFF_REVIEW",
        status: body.status,
        notes: body.notes,
        reviewedBy: moderatorId,
        reviewedAt: now,
      },
    }),
    prisma.userSecurity.update({
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

export async function hideReview(request: FastifyRequest, reply: FastifyReply) {
  const id = (request.params as { id: string }).id;
  const moderatorId = request.user?.sub;
  if (!moderatorId) return reply.code(401).send({ error: "Unauthorized" });

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return reply.code(404).send({ error: "Review not found" });

  const updated = await prisma.review.update({
    where: { id },
    data: { isHidden: true, hiddenAt: new Date(), hiddenById: moderatorId },
  });

  return reply.send({ data: updated });
}
