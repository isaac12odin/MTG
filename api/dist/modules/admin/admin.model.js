"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsQuery = exports.VerificationDecisionSchema = exports.VerificationQuery = exports.GameUpdateSchema = exports.GameCreateSchema = exports.GameQuery = void 0;
const zod_1 = require("zod");
exports.GameQuery = zod_1.z.object({
    q: zod_1.z.string().optional(),
    status: zod_1.z.enum(["ACTIVE", "BANNED"]).optional(),
});
exports.GameCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(80),
    slug: zod_1.z.string().min(2).max(80).optional(),
    status: zod_1.z.enum(["ACTIVE", "BANNED"]).optional(),
});
exports.GameUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(80).optional(),
    slug: zod_1.z.string().min(2).max(80).optional(),
    status: zod_1.z.enum(["ACTIVE", "BANNED"]).optional(),
});
exports.VerificationQuery = zod_1.z.object({
    status: zod_1.z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.VerificationDecisionSchema = zod_1.z.object({
    status: zod_1.z.enum(["APPROVED", "REJECTED"]),
    notes: zod_1.z.string().max(500).optional(),
});
exports.PaymentsQuery = zod_1.z.object({
    status: zod_1.z.enum(["PENDIENTE", "PAGADO", "VENCIDO", "CONDONADO"]).optional(),
    dueInDays: zod_1.z.coerce.number().int().min(1).max(60).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
