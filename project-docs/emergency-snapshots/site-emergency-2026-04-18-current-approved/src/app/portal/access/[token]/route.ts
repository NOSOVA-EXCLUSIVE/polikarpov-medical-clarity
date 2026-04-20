import { NextResponse } from "next/server";

import {
  createPortalSessionToken,
  getPortalSessionCookieName,
  getPortalSessionCookieOptions
} from "@/lib/auth/portal-session";
import { consumePortalAccessToken } from "@/features/messages/service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;

  try {
    const result = await consumePortalAccessToken(token);
    const sessionToken = await createPortalSessionToken(result);
    const response = NextResponse.redirect(new URL("/portal/messages", request.url), 303);

    response.cookies.set(
      getPortalSessionCookieName(),
      sessionToken,
      getPortalSessionCookieOptions()
    );

    return response;
  } catch {
    return NextResponse.redirect(new URL("/portal/messages?error=access", request.url), 303);
  }
}
