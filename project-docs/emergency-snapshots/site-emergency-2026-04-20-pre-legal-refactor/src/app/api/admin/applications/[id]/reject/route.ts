import { NextResponse } from "next/server";

import { rejectApplicationSchema } from "@/features/admin/schemas";
import { rejectApplication } from "@/features/admin/service";
import { getStaffSession } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getStaffSession();

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const params = await context.params;
  const formData = await request.formData();
  const parsed = rejectApplicationSchema.safeParse({
    note: formData.get("note")
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL(`/admin/applications/${params.id}?error=reject`, request.url),
      303
    );
  }

  try {
    await rejectApplication({
      actor: session,
      applicationId: params.id,
      note: parsed.data.note
    });

    return NextResponse.redirect(
      new URL(`/admin/applications/${params.id}?notice=rejected`, request.url),
      303
    );
  } catch {
    return NextResponse.redirect(
      new URL(`/admin/applications/${params.id}?error=reject`, request.url),
      303
    );
  }
}
