import type { FastifyReply, FastifyRequest } from "fastify";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";

import { prisma } from "../../db";
import { getActivePlan, getOrCreateUsage } from "../../utils/plan";
import { UploadQuery, UPLOAD_DIR, UPLOAD_MAX_MB, UPLOAD_TTL_HOURS, VARIANTS } from "./media.model";

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function uploadMedia(request: FastifyRequest, reply: FastifyReply) {
  const parsed = UploadQuery.safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: "Invalid query" });

  const userId = request.user?.sub;
  if (!userId) return reply.code(401).send({ error: "Unauthorized" });

  const plan = await getActivePlan(userId);
  if (!plan) return reply.code(402).send({ error: "No active plan" });

  const usage = await getOrCreateUsage(userId);
  if (plan.monthlyImageLimit && usage.imagesUploaded >= plan.monthlyImageLimit) {
    return reply.code(403).send({ error: "Monthly image limit reached" });
  }

  const file = await request.file();
  if (!file) return reply.code(400).send({ error: "Missing file" });

  const buffer = await file.toBuffer();
  const sizeMb = buffer.length / (1024 * 1024);
  if (sizeMb > UPLOAD_MAX_MB) return reply.code(400).send({ error: "File too large" });

  const baseDir = path.join(process.cwd(), UPLOAD_DIR);
  await ensureDir(baseDir);

  const asset = await prisma.mediaAsset.create({
    data: {
      ownerId: userId,
      purpose: parsed.data.purpose ?? "LISTING",
      status: "PENDING",
      storageKey: "",
      mime: file.mimetype,
      size: buffer.length,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  const assetDir = path.join(baseDir, asset.id);
  await ensureDir(assetDir);

  const variants = [] as Array<{
    variant: "THUMB" | "SMALL" | "MEDIUM" | "LARGE";
    key: string;
    mime: string;
    size: number;
    width: number;
    height: number;
  }>;

  for (const v of VARIANTS) {
    const outputName = `${v.type.toLowerCase()}.webp`;
    const outputPath = path.join(assetDir, outputName);

    const out = await sharp(buffer)
      .rotate()
      .resize({ width: v.width, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    await fs.writeFile(outputPath, out);
    const meta = await sharp(out).metadata();

    variants.push({
      variant: v.type,
      key: path.join(UPLOAD_DIR, asset.id, outputName),
      mime: "image/webp",
      size: out.length,
      width: meta.width ?? v.width,
      height: meta.height ?? v.width,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.mediaVariant.createMany({
      data: variants.map((v) => ({
        assetId: asset.id,
        variant: v.variant,
        key: v.key,
        mime: v.mime,
        size: v.size,
        width: v.width,
        height: v.height,
      })),
    });

    await tx.mediaAsset.update({
      where: { id: asset.id },
      data: { status: "READY", storageKey: variants[variants.length - 1]?.key ?? "", processedAt: new Date() },
    });

    await tx.planUsage.update({ where: { id: usage.id }, data: { imagesUploaded: { increment: 1 } } });
  });

  return reply.code(201).send({ data: { assetId: asset.id } });
}
