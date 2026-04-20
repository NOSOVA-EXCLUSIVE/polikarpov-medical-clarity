import { NextResponse } from "next/server";

import { activateApplicationCase } from "@/features/messages/service";
import { getStaffSession } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getStaffSession();

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const { id } = await context.params;

  try {
    const result = await activateApplicationCase({
      actor: session,
      applicationId: id
    });

    const redirectUrl = new URL(`/admin/applications/${id}`, request.url);
    redirectUrl.searchParams.set("notice", "activated");
    redirectUrl.searchParams.set("portalUrl", result.portalUrl);
    return NextResponse.redirect(redirectUrl, 303);
  } catch {
    return NextResponse.redirect(new URL(`/admin/applications/${id}?error=activate`, request.url), 303);
  }
}
