import { z } from "zod";

export const UploadQuery = z.object({
  purpose: z.enum(["LISTING", "SHIPMENT", "AVATAR", "CHAT", "VERIFICATION"]).optional(),
});

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";
export const UPLOAD_MAX_MB = Number(process.env.UPLOAD_MAX_MB ?? 6);
export const UPLOAD_TTL_HOURS = Number(process.env.UPLOAD_TTL_HOURS ?? 24);

export const VARIANTS = [
  { type: "THUMB" as const, width: 200 },
  { type: "SMALL" as const, width: 600 },
  { type: "MEDIUM" as const, width: 1200 },
];
