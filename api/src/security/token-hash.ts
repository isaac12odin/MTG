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

function getTokenHashKey(): Buffer {
  const raw = process.env.TOKEN_HASH_KEY;
  if (!raw) {
    throw new Error("TOKEN_HASH_KEY is not set");
  }
  const key = decodeKey(raw);
  if (key.length < 32) {
    throw new Error("TOKEN_HASH_KEY must be at least 32 bytes (base64 or hex)");
  }
  return key;
}

export function hashToken(token: string): string {
  const key = getTokenHashKey();
  return crypto.createHmac("sha256", key).update(token).digest("hex");
}
