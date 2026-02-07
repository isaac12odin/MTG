"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_TTL_DAYS = exports.MessagesQuery = exports.MessageSchema = exports.CreateConversationSchema = void 0;
const zod_1 = require("zod");
exports.CreateConversationSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    listingId: zod_1.z.string().uuid().optional(),
});
exports.MessageSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(500),
});
exports.MessagesQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.MESSAGE_TTL_DAYS = Number(process.env.MESSAGE_TTL_DAYS ?? 40);
