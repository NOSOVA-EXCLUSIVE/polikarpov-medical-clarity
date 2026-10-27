import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env/server";

const COOKIE_NAME = "manual_v21_session";
const ISSUER = "medical-clarity:manual-v21";
const AUDIENCE = "manual-patient-cabinet";
const TTL_SECONDS = 12 * 60 * 60;

export type ManualSession = { caseId: string; grantId: string };

export function getManualSessionCookieName() { return COOKIE_NAME; }

export function getManualSessionCookieOptions() {
  return { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const,
    path: "/", maxAge: TTL_SECONDS };
}

export async function createManualSessionToken(session: ManualSession) {
  return new SignJWT({ kind: "manual-v21", grantId: session.grantId })
    .setProtectedHeader({ alg: "HS256" }).setSubject(session.caseId)
    .setIssuer(ISSUER).setAudience(AUDIENCE).setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(env.STAFF_SESSION_SECRET));
}

export async function getManualSession(): Promise<ManualSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.STAFF_SESSION_SECRET), {
      algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE
    });
    if (payload.kind !== "manual-v21" || typeof payload.sub !== "string" ||
        typeof payload.grantId !== "string" || !payload.sub || !payload.grantId) return null;
    return { caseId: payload.sub, grantId: payload.grantId };
  } catch { return null; }
}
