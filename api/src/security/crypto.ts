import crypto from "crypto";
import process from "process";
import { Buffer } from "buffer";

const ENC_PREFIX = "v1";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

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

function getEncryptionKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("DATA_ENCRYPTION_KEY is not set");
  }
  const key = decodeKey(raw);
  if (key.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
  }
  return key;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(`${ENC_PREFIX}:`);
}

export function encryptString(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (isEncrypted(plaintext)) return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [ENC_PREFIX, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptString(value: string): string {
  if (!value) return value;
  if (!isEncrypted(value)) return value;

  const key = getEncryptionKey();
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== ENC_PREFIX) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const data = Buffer.from(parts[3], "base64");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}

export function encryptNullable(value?: string | null): string | null | undefined {
  if (value === null || value === undefined) return value;
  return encryptString(value);
}

export function decryptNullable(value?: string | null): string | null | undefined {
  if (value === null || value === undefined) return value;
  return decryptString(value);
}
