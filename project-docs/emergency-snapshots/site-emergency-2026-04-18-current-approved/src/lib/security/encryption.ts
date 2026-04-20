import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionSeed() {
  return (
    process.env.ENCRYPTION_KEY_BASE64?.trim() ||
    process.env.TOKEN_HASH_SECRET?.trim() ||
    "local-questionnaire-fallback-key"
  );
}

function getKey() {
  const raw = Buffer.from(getEncryptionSeed(), "base64");

  if (raw.length === 32) {
    return raw;
  }

  return createHash("sha256").update(raw).digest();
}

export function encryptSensitiveField(plainText: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSensitiveField(cipherText: string) {
  const payload = Buffer.from(cipherText, "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = payload.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
