import { NextResponse } from "next/server";
import { consumeManualGrant } from "@/features/manual-v21/service";
import { createManualSessionToken, getManualSessionCookieName,
  getManualSessionCookieOptions } from "@/lib/auth/manual-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw new Error("Invalid grant");
    const grant = await consumeManualGrant(token);
    const response = NextResponse.redirect(new URL("/manual/cabinet", request.url), 303);
    response.cookies.set(getManualSessionCookieName(), await createManualSessionToken(grant),
      getManualSessionCookieOptions());
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/manual/cabinet?error=access", request.url), 303);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
}
