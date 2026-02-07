import { z } from "zod";

export const SetQuery = z.object({
  gameId: z.string().uuid(),
});

export const CardQuery = z.object({
  gameId: z.string().uuid().optional(),
  setId: z.string().uuid().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
