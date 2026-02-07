"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingUpdateSchema = exports.ListingCreateSchema = exports.ListingQuery = void 0;
exports.listingSelect = listingSelect;
const zod_1 = require("zod");
exports.ListingQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    q: zod_1.z.string().optional(),
    type: zod_1.z.enum(["FIXED", "AUCTION", "TRADE"]).optional(),
    sellerId: zod_1.z.string().uuid().optional(),
    gameId: zod_1.z.string().uuid().optional(),
    setId: zod_1.z.string().uuid().optional(),
    minPrice: zod_1.z.coerce.number().optional(),
    maxPrice: zod_1.z.coerce.number().optional(),
    condition: zod_1.z.string().optional(),
    language: zod_1.z.string().optional(),
    isFoil: zod_1.z.coerce.boolean().optional(),
    country: zod_1.z.string().min(2).max(2).optional(),
    state: zod_1.z.string().max(100).optional(),
    city: zod_1.z.string().max(100).optional(),
});
exports.ListingCreateSchema = zod_1.z.object({
    type: zod_1.z.enum(["FIXED", "AUCTION", "TRADE"]),
    title: zod_1.z.string().min(3).max(120),
    description: zod_1.z.string().max(4000).optional(),
    condition: zod_1.z.string().optional(),
    language: zod_1.z.string().optional(),
    isFoil: zod_1.z.boolean().optional(),
    currency: zod_1.z.string().default("MXN"),
    askPrice: zod_1.z.number().optional(),
    paymentWindowHours: zod_1.z.number().int().min(1).max(168).optional(),
    shippingFromAddressId: zod_1.z.string().uuid().optional(),
    items: zod_1.z.array(zod_1.z.object({
        cardId: zod_1.z.string().uuid(),
        qty: zod_1.z.number().int().min(1).max(999).default(1),
        notes: zod_1.z.string().optional(),
        inventoryItemId: zod_1.z.string().uuid().optional(),
    })),
    mediaAssetIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
exports.ListingUpdateSchema = exports.ListingCreateSchema.partial().extend({
    status: zod_1.z.enum(["DRAFT", "ACTIVE", "SOLD", "CLOSED", "REMOVED"]).optional(),
});
function listingSelect(isOwner) {
    return {
        id: true,
        sellerId: true,
        type: true,
        status: true,
        title: true,
        description: true,
        condition: true,
        language: true,
        isFoil: true,
        currency: true,
        askPrice: true,
        paymentWindowHours: isOwner,
        createdAt: true,
        updatedAt: true,
        items: {
            include: {
                card: true,
                inventoryItem: true,
            },
        },
        media: {
            include: {
                asset: {
                    include: { variants: true },
                },
            },
        },
        auction: true,
    };
}
