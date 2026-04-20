import { NextResponse } from "next/server";

import { threadMessageSchema } from "@/features/messages/schemas";
import { sendPatientMessage } from "@/features/messages/service";
import { getPortalSession } from "@/lib/auth/portal-session";

export async function POST(request: Request) {
  const session = await getPortalSession();

  if (!session) {
    return NextResponse.redirect(new URL("/portal/messages?error=session", request.url), 303);
  }

  const formData = await request.formData();
  const parsed = threadMessageSchema.safeParse({
    body: formData.get("body")
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/portal/messages?error=message", request.url), 303);
  }

  try {
    await sendPatientMessage({
      session,
      body: parsed.data.body
    });

    return NextResponse.redirect(new URL("/portal/messages?notice=sent", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/portal/messages?error=message", request.url), 303);
  }
}
