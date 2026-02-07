import { z } from "zod";

export const StoreProfileSchema = z.object({
  storeName: z.string().min(2).max(120),
  legalName: z.string().max(200).optional(),
  taxId: z.string().max(50).optional(),
  contactPhone: z.string().max(30).optional(),
  addressId: z.string().uuid().optional(),
});

export const InventoryItemSchema = z.object({
  cardId: z.string().uuid(),
  qty: z.number().int().min(1).max(999),
  condition: z.string().optional(),
  language: z.string().optional(),
  isFoil: z.boolean().optional(),
  price: z.number().optional(),
  currency: z.string().default("MXN"),
  notes: z.string().optional(),
  status: z.enum(["ACTIVE", "RESERVED", "SOLD", "ARCHIVED"]).optional(),
});

export const InventoryBulkSchema = z.object({
  items: z.array(InventoryItemSchema).min(1).max(500),
});

export const InventoryQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["ACTIVE", "RESERVED", "SOLD", "ARCHIVED"]).optional(),
  q: z.string().optional(),
  gameId: z.string().uuid().optional(),
  setId: z.string().uuid().optional(),
});
