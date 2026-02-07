import crypto from "crypto";

function decodeKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (trimmed.startsWith("base64:")) {
    return Buffer.from(trimmed.slice(7), "base64");
  }
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  return Buffer.from(trimmed, "base64");
}

function getHashKey(): Buffer {
  const raw = process.env.LOOKUP_HASH_KEY;
  if (!raw) {
    throw new Error("LOOKUP_HASH_KEY is not set");
  }
  const key = decodeKey(raw);
  if (key.length < 32) {
    throw new Error("LOOKUP_HASH_KEY must be at least 32 bytes (base64 or hex)");
  }
  return key;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function hashLookup(value: string): string {
  const key = getHashKey();
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

export function hashEmail(email: string): string {
  return hashLookup(normalizeEmail(email));
}

export function hashPhone(phone: string): string {
  return hashLookup(normalizePhone(phone));
}
