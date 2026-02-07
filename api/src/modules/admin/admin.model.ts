import { z } from "zod";

export const GameQuery = z.object({
  q: z.string().optional(),
  status: z.enum(["ACTIVE", "BANNED"]).optional(),
});

export const GameCreateSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).optional(),
  status: z.enum(["ACTIVE", "BANNED"]).optional(),
});

export const GameUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  slug: z.string().min(2).max(80).optional(),
  status: z.enum(["ACTIVE", "BANNED"]).optional(),
});

export const VerificationQuery = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const VerificationDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().max(500).optional(),
});

export const PaymentsQuery = z.object({
  status: z.enum(["PENDIENTE", "PAGADO", "VENCIDO", "CONDONADO"]).optional(),
  dueInDays: z.coerce.number().int().min(1).max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
