import { NextResponse } from "next/server";

import { completeApplicationCase } from "@/features/messages/service";
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
    await completeApplicationCase({
      actor: session,
      applicationId: id
    });

    return NextResponse.redirect(new URL(`/admin/applications/${id}?notice=completed`, request.url), 303);
  } catch {
    return NextResponse.redirect(new URL(`/admin/applications/${id}?error=complete`, request.url), 303);
  }
}
