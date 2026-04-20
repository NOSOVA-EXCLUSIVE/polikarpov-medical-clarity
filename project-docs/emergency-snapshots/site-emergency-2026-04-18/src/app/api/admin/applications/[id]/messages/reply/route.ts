import { NextResponse } from "next/server";

import { staffReplySchema } from "@/features/admin/schemas";
import { sendStaffMessage } from "@/features/messages/service";
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
  const formData = await request.formData();
  const parsed = staffReplySchema.safeParse({
    body: formData.get("body")
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL(`/admin/applications/${id}?error=reply`, request.url), 303);
  }

  try {
    await sendStaffMessage({
      actor: session,
      applicationId: id,
      body: parsed.data.body
    });

    return NextResponse.redirect(new URL(`/admin/applications/${id}?notice=message_sent`, request.url), 303);
  } catch {
    return NextResponse.redirect(new URL(`/admin/applications/${id}?error=reply`, request.url), 303);
  }
}
