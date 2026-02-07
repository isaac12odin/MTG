"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEncrypted = isEncrypted;
exports.encryptString = encryptString;
exports.decryptString = decryptString;
exports.encryptNullable = encryptNullable;
exports.decryptNullable = decryptNullable;
const crypto_1 = __importDefault(require("crypto"));
const process_1 = __importDefault(require("process"));
const buffer_1 = require("buffer");
const ENC_PREFIX = "v1";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
function decodeKey(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("base64:")) {
        return buffer_1.Buffer.from(trimmed.slice(7), "base64");
    }
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return buffer_1.Buffer.from(trimmed, "hex");
    }
    return buffer_1.Buffer.from(trimmed, "base64");
}
function getEncryptionKey() {
    const raw = process_1.default.env.DATA_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error("DATA_ENCRYPTION_KEY is not set");
    }
    const key = decodeKey(raw);
    if (key.length !== 32) {
        throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
    }
    return key;
}
function isEncrypted(value) {
    return value.startsWith(`${ENC_PREFIX}:`);
}
function encryptString(plaintext) {
    if (!plaintext)
        return plaintext;
    if (isEncrypted(plaintext))
        return plaintext;
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGO, key, iv);
    const ciphertext = buffer_1.Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [ENC_PREFIX, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}
function decryptString(value) {
    if (!value)
        return value;
    if (!isEncrypted(value))
        return value;
    const key = getEncryptionKey();
    const parts = value.split(":");
    if (parts.length !== 4 || parts[0] !== ENC_PREFIX) {
        throw new Error("Invalid encrypted payload format");
    }
    const iv = buffer_1.Buffer.from(parts[1], "base64");
    const tag = buffer_1.Buffer.from(parts[2], "base64");
    const data = buffer_1.Buffer.from(parts[3], "base64");
    const decipher = crypto_1.default.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = buffer_1.Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString("utf8");
}
function encryptNullable(value) {
    if (value === null || value === undefined)
        return value;
    return encryptString(value);
}
function decryptNullable(value) {
    if (value === null || value === undefined)
        return value;
    return decryptString(value);
}
