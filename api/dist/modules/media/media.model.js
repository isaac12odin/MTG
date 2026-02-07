"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VARIANTS = exports.UPLOAD_TTL_HOURS = exports.UPLOAD_MAX_MB = exports.UPLOAD_DIR = exports.UploadQuery = void 0;
const zod_1 = require("zod");
exports.UploadQuery = zod_1.z.object({
    purpose: zod_1.z.enum(["LISTING", "SHIPMENT", "AVATAR", "CHAT", "VERIFICATION"]).optional(),
});
exports.UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";
exports.UPLOAD_MAX_MB = Number(process.env.UPLOAD_MAX_MB ?? 6);
exports.UPLOAD_TTL_HOURS = Number(process.env.UPLOAD_TTL_HOURS ?? 24);
exports.VARIANTS = [
    { type: "THUMB", width: 200 },
    { type: "SMALL", width: 600 },
    { type: "MEDIUM", width: 1200 },
];
