import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

import { env } from "@/lib/env/server";

const COOKIE_NAME = "staff_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type StaffSessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
};

type StaffSession = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

function getSessionSecret() {
  return new TextEncoder().encode(env.STAFF_SESSION_SECRET);
}

export async function createStaffSessionToken(payload: StaffSessionPayload) {
  return await new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function setStaffSessionCookie(payload: StaffSessionPayload) {
  const token = await createStaffSessionToken(payload);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearStaffSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getStaffSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "DOCTOR")
    ) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role
    } satisfies StaffSession;
  } catch {
    return null;
  }
}

export async function requireStaffSession() {
  const session = await getStaffSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}
