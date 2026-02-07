"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewQuery = exports.ReviewCreateSchema = void 0;
const zod_1 = require("zod");
exports.ReviewCreateSchema = zod_1.z.object({
    dealId: zod_1.z.string().uuid(),
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().max(1000).optional(),
});
exports.ReviewQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
