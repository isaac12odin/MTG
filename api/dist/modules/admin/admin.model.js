"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanUpdateSchema = exports.PlanCreateSchema = exports.PlansAdminQuery = exports.EventUpdateSchema = exports.EventsAdminQuery = exports.StoresAdminQuery = exports.ReportUpdateSchema = exports.ReportsAdminQuery = exports.DealsAdminQuery = exports.AuctionsAdminQuery = exports.ListingAdminUpdateSchema = exports.ListingsAdminQuery = exports.UserUpdateSchema = exports.UsersQuery = exports.AdminPagination = exports.PaymentsQuery = exports.VerificationDecisionSchema = exports.VerificationQuery = exports.GameUpdateSchema = exports.GameCreateSchema = exports.GameQuery = void 0;
const zod_1 = require("zod");
exports.GameQuery = zod_1.z.object({
    q: zod_1.z.string().optional(),
    status: zod_1.z.enum(["ACTIVE", "BANNED"]).optional(),
});
exports.GameCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(80),
    slug: zod_1.z.string().min(2).max(80).optional(),
    status: zod_1.z.enum(["ACTIVE", "BANNED"]).optional(),
});
exports.GameUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(80).optional(),
    slug: zod_1.z.string().min(2).max(80).optional(),
    status: zod_1.z.enum(["ACTIVE", "BANNED"]).optional(),
});
exports.VerificationQuery = zod_1.z.object({
    status: zod_1.z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.VerificationDecisionSchema = zod_1.z.object({
    status: zod_1.z.enum(["APPROVED", "REJECTED"]),
    notes: zod_1.z.string().max(500).optional(),
});
exports.PaymentsQuery = zod_1.z.object({
    status: zod_1.z.enum(["PENDIENTE", "PAGADO", "VENCIDO", "CONDONADO"]).optional(),
    dueInDays: zod_1.z.coerce.number().int().min(1).max(60).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.AdminPagination = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
const RoleEnum = zod_1.z.enum(["ADMIN", "MOD", "ORGANIZER", "STORE", "SELLER", "BUYER"]);
exports.UsersQuery = exports.AdminPagination.extend({
    q: zod_1.z.string().optional(),
    role: RoleEnum.optional(),
    active: zod_1.z.coerce.boolean().optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
});
exports.UserUpdateSchema = zod_1.z.object({
    isActive: zod_1.z.boolean().optional(),
    roles: zod_1.z.array(RoleEnum).optional(),
    manualVerified: zod_1.z.boolean().optional(),
    notes: zod_1.z.string().max(500).optional(),
});
exports.ListingsAdminQuery = exports.AdminPagination.extend({
    q: zod_1.z.string().optional(),
    status: zod_1.z.enum(["DRAFT", "ACTIVE", "SOLD", "CLOSED", "REMOVED"]).optional(),
    type: zod_1.z.enum(["FIXED", "AUCTION", "TRADE"]).optional(),
    sellerId: zod_1.z.string().uuid().optional(),
    gameId: zod_1.z.string().uuid().optional(),
});
exports.ListingAdminUpdateSchema = zod_1.z.object({
    status: zod_1.z.enum(["DRAFT", "ACTIVE", "SOLD", "CLOSED", "REMOVED"]).optional(),
});
exports.AuctionsAdminQuery = exports.AdminPagination.extend({
    status: zod_1.z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELED"]).optional(),
});
exports.DealsAdminQuery = exports.AdminPagination.extend({
    status: zod_1.z
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
exports.ReportsAdminQuery = exports.AdminPagination.extend({
    status: zod_1.z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]).optional(),
});
exports.ReportUpdateSchema = zod_1.z.object({
    status: zod_1.z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]),
});
exports.StoresAdminQuery = exports.AdminPagination.extend({
    q: zod_1.z.string().optional(),
});
exports.EventsAdminQuery = exports.AdminPagination.extend({
    status: zod_1.z.enum(["DRAFT", "PUBLISHED", "FULL", "CANCELED", "ENDED"]).optional(),
});
exports.EventUpdateSchema = zod_1.z.object({
    status: zod_1.z.enum(["DRAFT", "PUBLISHED", "FULL", "CANCELED", "ENDED"]).optional(),
});
exports.PlansAdminQuery = exports.AdminPagination.extend({
    type: zod_1.z.enum(["STORE", "SELLER"]).optional(),
    active: zod_1.z.coerce.boolean().optional(),
});
exports.PlanCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(80),
    type: zod_1.z.enum(["STORE", "SELLER"]),
    priceMXN: zod_1.z.coerce.number().min(0),
    monthlyListingLimit: zod_1.z.coerce.number().int().min(0).optional(),
    activeListingLimit: zod_1.z.coerce.number().int().min(0).optional(),
    monthlyImageLimit: zod_1.z.coerce.number().int().min(0).optional(),
    maxImagesPerListing: zod_1.z.coerce.number().int().min(0).optional(),
    eventLimit: zod_1.z.coerce.number().int().min(0).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.PlanUpdateSchema = exports.PlanCreateSchema.partial();
