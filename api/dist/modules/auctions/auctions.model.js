"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuctionQuery = exports.BidSchema = exports.AuctionCreateSchema = void 0;
const zod_1 = require("zod");
exports.AuctionCreateSchema = zod_1.z.object({
    listingId: zod_1.z.string().uuid(),
    startAt: zod_1.z.coerce.date(),
    endAt: zod_1.z.coerce.date(),
    startPrice: zod_1.z.number().min(0),
    increment: zod_1.z.number().min(1),
    reservePrice: zod_1.z.number().optional(),
    buyNowPrice: zod_1.z.number().optional(),
    autoRelistOnUnpaid: zod_1.z.boolean().optional(),
    autoRelistAfterHours: zod_1.z.number().int().min(1).max(168).optional(),
});
exports.BidSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
});
exports.AuctionQuery = zod_1.z.object({
    status: zod_1.z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELED"]).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    country: zod_1.z.string().min(2).max(2).optional(),
    state: zod_1.z.string().max(100).optional(),
    city: zod_1.z.string().max(100).optional(),
});
