import { z } from "zod";

export const VerifySchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().max(500).optional(),
});
