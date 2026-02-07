import { z } from "zod";

export const ListingQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  type: z.enum(["FIXED", "AUCTION", "TRADE"]).optional(),
  sellerId: z.string().uuid().optional(),
  gameId: z.string().uuid().optional(),
  setId: z.string().uuid().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  condition: z.string().optional(),
  language: z.string().optional(),
  isFoil: z.coerce.boolean().optional(),
});

export const ListingCreateSchema = z.object({
  type: z.enum(["FIXED", "AUCTION", "TRADE"]),
  title: z.string().min(3).max(120),
  description: z.string().max(4000).optional(),
  condition: z.string().optional(),
  language: z.string().optional(),
  isFoil: z.boolean().optional(),
  currency: z.string().default("MXN"),
  askPrice: z.number().optional(),
  paymentWindowHours: z.number().int().min(1).max(168).optional(),
  shippingFromAddressId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      cardId: z.string().uuid(),
      qty: z.number().int().min(1).max(999).default(1),
      notes: z.string().optional(),
      inventoryItemId: z.string().uuid().optional(),
    })
  ),
  mediaAssetIds: z.array(z.string().uuid()).optional(),
});

export const ListingUpdateSchema = ListingCreateSchema.partial().extend({
  status: z.enum(["DRAFT", "ACTIVE", "SOLD", "CLOSED", "REMOVED"]).optional(),
});

export function listingSelect(isOwner: boolean) {
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
  } as const;
}
