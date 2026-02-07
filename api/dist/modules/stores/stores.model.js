"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryQuery = exports.InventoryBulkSchema = exports.InventoryItemSchema = exports.StoreProfileSchema = void 0;
const zod_1 = require("zod");
exports.StoreProfileSchema = zod_1.z.object({
    storeName: zod_1.z.string().min(2).max(120),
    legalName: zod_1.z.string().max(200).optional(),
    taxId: zod_1.z.string().max(50).optional(),
    contactPhone: zod_1.z.string().max(30).optional(),
    addressId: zod_1.z.string().uuid().optional(),
});
exports.InventoryItemSchema = zod_1.z.object({
    cardId: zod_1.z.string().uuid(),
    qty: zod_1.z.number().int().min(1).max(999),
    condition: zod_1.z.string().optional(),
    language: zod_1.z.string().optional(),
    isFoil: zod_1.z.boolean().optional(),
    price: zod_1.z.number().optional(),
    currency: zod_1.z.string().default("MXN"),
    notes: zod_1.z.string().optional(),
    status: zod_1.z.enum(["ACTIVE", "RESERVED", "SOLD", "ARCHIVED"]).optional(),
});
exports.InventoryBulkSchema = zod_1.z.object({
    items: zod_1.z.array(exports.InventoryItemSchema).min(1).max(500),
});
exports.InventoryQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    status: zod_1.z.enum(["ACTIVE", "RESERVED", "SOLD", "ARCHIVED"]).optional(),
    q: zod_1.z.string().optional(),
    gameId: zod_1.z.string().uuid().optional(),
    setId: zod_1.z.string().uuid().optional(),
});
