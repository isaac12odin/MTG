import { encryptNullable, encryptString } from "./crypto";
import { hashEmail, hashPhone, normalizeEmail, normalizePhone } from "./hash";

export function prepareEmail(email: string): { emailEnc: string; emailHash: string } {
  const normalized = normalizeEmail(email);
  return {
    emailEnc: encryptString(normalized),
    emailHash: hashEmail(normalized),
  };
}

export function preparePhone(phone?: string | null): { phoneEnc: string | null; phoneHash: string | null } {
  if (!phone) {
    return { phoneEnc: null, phoneHash: null };
  }
  const normalized = normalizePhone(phone);
  return {
    phoneEnc: encryptString(normalized),
    phoneHash: hashPhone(normalized),
  };
}

export function encryptAddressField(value?: string | null): string | null | undefined {
  return encryptNullable(value);
}
