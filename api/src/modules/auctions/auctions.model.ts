import { z } from "zod";

export const AuctionCreateSchema = z.object({
  listingId: z.string().uuid(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  startPrice: z.number().min(0),
  increment: z.number().min(1),
  reservePrice: z.number().optional(),
  buyNowPrice: z.number().optional(),
  autoRelistOnUnpaid: z.boolean().optional(),
  autoRelistAfterHours: z.number().int().min(1).max(168).optional(),
});

export const BidSchema = z.object({
  amount: z.number().positive(),
});

export const AuctionQuery = z.object({
  status: z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  country: z.string().min(2).max(2).optional(),
  state: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
});
