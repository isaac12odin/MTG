import { z } from "zod";

const countryCode = z
  .string()
  .min(2)
  .max(2)
  .transform((value) => value.toUpperCase());

export const ProfileUpdateSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  bio: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: countryCode.optional(),
});

export const AddressCreateSchema = z.object({
  label: z.string().max(60).optional(),
  fullName: z.string().max(120).optional(),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().max(100),
  state: z.string().max(100),
  country: countryCode.default("MX"),
  postalCode: z.string().max(20),
  references: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  isDefault: z.boolean().optional(),
});

export const AddressUpdateSchema = AddressCreateSchema.partial();

export const VerificationRequestSchema = z.object({
  method: z.enum(["VIDEO_CALL", "COMMUNITY"]).default("VIDEO_CALL"),
  notes: z.string().max(500).optional(),
});
