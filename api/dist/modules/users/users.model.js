"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressUpdateSchema = exports.AddressCreateSchema = exports.ProfileUpdateSchema = void 0;
const zod_1 = require("zod");
const countryCode = zod_1.z
    .string()
    .min(2)
    .max(2)
    .transform((value) => value.toUpperCase());
exports.ProfileUpdateSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(2).max(80).optional(),
    bio: zod_1.z.string().max(500).optional(),
    city: zod_1.z.string().max(100).optional(),
    country: countryCode.optional(),
});
exports.AddressCreateSchema = zod_1.z.object({
    label: zod_1.z.string().max(60).optional(),
    fullName: zod_1.z.string().max(120).optional(),
    line1: zod_1.z.string().min(3).max(200),
    line2: zod_1.z.string().max(200).optional(),
    city: zod_1.z.string().max(100),
    state: zod_1.z.string().max(100),
    country: countryCode.default("MX"),
    postalCode: zod_1.z.string().max(20),
    references: zod_1.z.string().max(200).optional(),
    phone: zod_1.z.string().max(30).optional(),
    isDefault: zod_1.z.boolean().optional(),
});
exports.AddressUpdateSchema = exports.AddressCreateSchema.partial();
