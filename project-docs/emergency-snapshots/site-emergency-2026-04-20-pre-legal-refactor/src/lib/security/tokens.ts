import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env/server";

export function createOpaqueToken(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256")
    .update(`${env.TOKEN_HASH_SECRET}:${token}`, "utf8")
    .digest("hex");
}

export function compareOpaqueToken(rawToken: string, hashedToken: string) {
  const computed = Buffer.from(hashOpaqueToken(rawToken), "utf8");
  const stored = Buffer.from(hashedToken, "utf8");

  if (computed.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(computed, stored);
}
