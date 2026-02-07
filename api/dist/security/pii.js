"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareEmail = prepareEmail;
exports.preparePhone = preparePhone;
exports.encryptAddressField = encryptAddressField;
const crypto_1 = require("./crypto");
const hash_1 = require("./hash");
function prepareEmail(email) {
    const normalized = (0, hash_1.normalizeEmail)(email);
    return {
        emailEnc: (0, crypto_1.encryptString)(normalized),
        emailHash: (0, hash_1.hashEmail)(normalized),
    };
}
function preparePhone(phone) {
    if (!phone) {
        return { phoneEnc: null, phoneHash: null };
    }
    const normalized = (0, hash_1.normalizePhone)(phone);
    return {
        phoneEnc: (0, crypto_1.encryptString)(normalized),
        phoneHash: (0, hash_1.hashPhone)(normalized),
    };
}
function encryptAddressField(value) {
    return (0, crypto_1.encryptNullable)(value);
}
