import { NextResponse } from "next/server";

import { createOfferSchema } from "@/features/admin/schemas";
import { createOfferForApplication } from "@/features/admin/service";
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
  const parsed = createOfferSchema.safeParse({
    productCode: formData.get("productCode"),
    chargeModel: formData.get("chargeModel"),
    amountCents: formData.get("amountCents"),
    currency: formData.get("currency"),
    durationMinutes: formData.get("durationMinutes")
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL(`/admin/applications/${params.id}?error=offer`, request.url),
      303
    );
  }

  try {
    const { productCode, chargeModel, amountCents, currency, durationMinutes } = parsed.data;
    const result = await createOfferForApplication({
      actor: session,
      applicationId: params.id,
      productCode,
      chargeModel,
      amountCents,
      currency,
      durationMinutes
    });

    const redirectUrl = new URL(`/admin/booking-links`, request.url);
    redirectUrl.searchParams.set("bookingUrl", result.bookingUrl);
    redirectUrl.searchParams.set("notice", "offer_created");
    return NextResponse.redirect(redirectUrl, 303);
  } catch {
    return NextResponse.redirect(
      new URL(`/admin/applications/${params.id}?error=offer`, request.url),
      303
    );
  }
}
