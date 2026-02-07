"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifySchema = void 0;
const zod_1 = require("zod");
exports.VerifySchema = zod_1.z.object({
    status: zod_1.z.enum(["APPROVED", "REJECTED"]),
    notes: zod_1.z.string().max(500).optional(),
});
