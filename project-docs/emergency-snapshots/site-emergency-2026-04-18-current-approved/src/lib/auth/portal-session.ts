import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { env } from "@/lib/env/server";

const COOKIE_NAME = "portal_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type PortalSessionPayload = {
  applicationId: string;
  patientName: string;
  patientEmail: string;
};

export type PortalSession = {
  applicationId: string;
  patientName: string;
  patientEmail: string;
};

function getSessionSecret() {
  return new TextEncoder().encode(env.STAFF_SESSION_SECRET);
}

export function getPortalSessionCookieName() {
  return COOKIE_NAME;
}

export function getPortalSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  };
}

export async function createPortalSessionToken(payload: PortalSessionPayload) {
  return await new SignJWT({
    patientName: payload.patientName,
    patientEmail: payload.patientEmail
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.applicationId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function setPortalSessionCookie(payload: PortalSessionPayload) {
  const token = await createPortalSessionToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, getPortalSessionCookieOptions());
}

export async function clearPortalSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, "", {
    ...getPortalSessionCookieOptions(),
    maxAge: 0
  });
}

export async function getPortalSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());

    if (
      typeof payload.sub !== "string" ||
      typeof payload.patientName !== "string" ||
      typeof payload.patientEmail !== "string"
    ) {
      return null;
    }

    return {
      applicationId: payload.sub,
      patientName: payload.patientName,
      patientEmail: payload.patientEmail
    } satisfies PortalSession;
  } catch {
    return null;
  }
}
