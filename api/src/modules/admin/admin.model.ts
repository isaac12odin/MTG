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

export const AdminPagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const RoleEnum = z.enum(["ADMIN", "MOD", "ORGANIZER", "STORE", "SELLER", "BUYER"]);

export const UsersQuery = AdminPagination.extend({
  q: z.string().optional(),
  role: RoleEnum.optional(),
  active: z.coerce.boolean().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const UserUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  roles: z.array(RoleEnum).optional(),
  manualVerified: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export const ListingsAdminQuery = AdminPagination.extend({
  q: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "SOLD", "CLOSED", "REMOVED"]).optional(),
  type: z.enum(["FIXED", "AUCTION", "TRADE"]).optional(),
  sellerId: z.string().uuid().optional(),
  gameId: z.string().uuid().optional(),
});

export const ListingAdminUpdateSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "SOLD", "CLOSED", "REMOVED"]).optional(),
});

export const AuctionsAdminQuery = AdminPagination.extend({
  status: z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELED"]).optional(),
});

export const DealsAdminQuery = AdminPagination.extend({
  status: z
    .enum([
      "SOLD",
      "PAYMENT_CONFIRMED",
      "SHIPPED",
      "DELIVERED",
      "COMPLETED",
      "DISPUTED",
      "CANCELED",
      "UNPAID_RELISTED",
    ])
    .optional(),
});

export const ReportsAdminQuery = AdminPagination.extend({
  status: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]).optional(),
});

export const ReportUpdateSchema = z.object({
  status: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]),
});

export const StoresAdminQuery = AdminPagination.extend({
  q: z.string().optional(),
});

export const EventsAdminQuery = AdminPagination.extend({
  status: z.enum(["DRAFT", "PUBLISHED", "FULL", "CANCELED", "ENDED"]).optional(),
});

export const EventUpdateSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "FULL", "CANCELED", "ENDED"]).optional(),
});

export const PlansAdminQuery = AdminPagination.extend({
  type: z.enum(["STORE", "SELLER"]).optional(),
  active: z.coerce.boolean().optional(),
});

export const PlanCreateSchema = z.object({
  name: z.string().min(2).max(80),
  type: z.enum(["STORE", "SELLER"]),
  priceMXN: z.coerce.number().min(0),
  monthlyListingLimit: z.coerce.number().int().min(0).optional(),
  activeListingLimit: z.coerce.number().int().min(0).optional(),
  monthlyImageLimit: z.coerce.number().int().min(0).optional(),
  maxImagesPerListing: z.coerce.number().int().min(0).optional(),
  eventLimit: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const PlanUpdateSchema = PlanCreateSchema.partial();
