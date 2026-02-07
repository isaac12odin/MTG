"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashToken = hashToken;
const crypto_1 = __importDefault(require("crypto"));
function decodeKey(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("base64:")) {
        return Buffer.from(trimmed.slice(7), "base64");
    }
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        return Buffer.from(trimmed, "hex");
    }
    return Buffer.from(trimmed, "base64");
}
function getTokenHashKey() {
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
function hashToken(token) {
    const key = getTokenHashKey();
    return crypto_1.default.createHmac("sha256", key).update(token).digest("hex");
}
