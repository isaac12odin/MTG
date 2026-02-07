"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardQuery = exports.SetQuery = void 0;
const zod_1 = require("zod");
exports.SetQuery = zod_1.z.object({
    gameId: zod_1.z.string().uuid(),
});
exports.CardQuery = zod_1.z.object({
    gameId: zod_1.z.string().uuid().optional(),
    setId: zod_1.z.string().uuid().optional(),
    q: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
