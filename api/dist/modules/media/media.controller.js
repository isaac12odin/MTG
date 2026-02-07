"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMedia = uploadMedia;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const sharp_1 = __importDefault(require("sharp"));
const db_1 = require("../../db");
const plan_1 = require("../../utils/plan");
const media_model_1 = require("./media.model");
async function ensureDir(dir) {
    await promises_1.default.mkdir(dir, { recursive: true });
}
async function uploadMedia(request, reply) {
    const parsed = media_model_1.UploadQuery.safeParse(request.query);
    if (!parsed.success)
        return reply.code(400).send({ error: "Invalid query" });
    const userId = request.user?.sub;
    if (!userId)
        return reply.code(401).send({ error: "Unauthorized" });
    const plan = await (0, plan_1.getActivePlan)(userId);
    if (!plan)
        return reply.code(402).send({ error: "No active plan" });
    const usage = await (0, plan_1.getOrCreateUsage)(userId);
    if (plan.monthlyImageLimit && usage.imagesUploaded >= plan.monthlyImageLimit) {
        return reply.code(403).send({ error: "Monthly image limit reached" });
    }
    const file = await request.file();
    if (!file)
        return reply.code(400).send({ error: "Missing file" });
    const buffer = await file.toBuffer();
    const sizeMb = buffer.length / (1024 * 1024);
    if (sizeMb > media_model_1.UPLOAD_MAX_MB)
        return reply.code(400).send({ error: "File too large" });
    const baseDir = path_1.default.join(process.cwd(), media_model_1.UPLOAD_DIR);
    await ensureDir(baseDir);
    const asset = await db_1.prisma.mediaAsset.create({
        data: {
            ownerId: userId,
            purpose: parsed.data.purpose ?? "LISTING",
            status: "PENDING",
            storageKey: "",
            mime: file.mimetype,
            size: buffer.length,
            expiresAt: new Date(Date.now() + media_model_1.UPLOAD_TTL_HOURS * 60 * 60 * 1000),
        },
    });
    const assetDir = path_1.default.join(baseDir, asset.id);
    await ensureDir(assetDir);
    const variants = [];
    for (const v of media_model_1.VARIANTS) {
        const outputName = `${v.type.toLowerCase()}.webp`;
        const outputPath = path_1.default.join(assetDir, outputName);
        const out = await (0, sharp_1.default)(buffer)
            .rotate()
            .resize({ width: v.width, withoutEnlargement: true })
            .webp({ quality: 75 })
            .toBuffer();
        await promises_1.default.writeFile(outputPath, out);
        const meta = await (0, sharp_1.default)(out).metadata();
        variants.push({
            variant: v.type,
            key: path_1.default.join(media_model_1.UPLOAD_DIR, asset.id, outputName),
            mime: "image/webp",
            size: out.length,
            width: meta.width ?? v.width,
            height: meta.height ?? v.width,
        });
    }
    await db_1.prisma.$transaction(async (tx) => {
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
