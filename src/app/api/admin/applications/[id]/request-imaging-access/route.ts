import { NextResponse } from "next/server";

import { requestRequirementSchema } from "@/features/admin/schemas";
import { requestApplicationMaterials } from "@/features/admin/service";
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
  const parsed = requestRequirementSchema.safeParse({
    note: formData.get("note")
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL(`/admin/applications/${params.id}?error=imaging_requirement`, request.url),
      303
    );
  }

  try {
    const result = await requestApplicationMaterials({
      actor: session,
      applicationId: params.id,
      type: "IMAGING_ACCESS",
      note: parsed.data.note
    });

    const redirectUrl = new URL(`/admin/applications/${params.id}`, request.url);
    redirectUrl.searchParams.set("materialsUrl", result.materialsUrl);
    redirectUrl.searchParams.set("notice", "imaging_request_created");
    return NextResponse.redirect(redirectUrl, 303);
  } catch {
    return NextResponse.redirect(
      new URL(`/admin/applications/${params.id}?error=imaging_requirement`, request.url),
      303
    );
  }
}
