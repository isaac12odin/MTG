import { z } from "zod";

export const SubscribePlanSchema = z.object({
  planId: z.string().uuid(),
});
