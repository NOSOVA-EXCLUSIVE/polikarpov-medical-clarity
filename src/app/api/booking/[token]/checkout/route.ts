import { NextResponse } from "next/server";

import { createCheckoutSchema } from "@/features/booking/schemas";
import { createStripeCheckout } from "@/features/booking/service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;

  const contentType = request.headers.get("content-type") || "";

  try {
    const payload =
      contentType.includes("application/json")
        ? await request.json()
        : Object.fromEntries((await request.formData()).entries());

    const input = createCheckoutSchema.parse(payload);
    const result = await createStripeCheckout(token, input.slotId);

    if (contentType.includes("application/json")) {
      return NextResponse.json({
        ok: true,
        data: result
      });
    }

    return NextResponse.redirect(new URL(result.checkoutUrl), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось перейти к оплате.";
    const status =
      typeof error === "object" && error && "status" in error && typeof error.status === "number"
        ? error.status
        : 400;

    if (contentType.includes("application/json")) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "CHECKOUT_CREATE_FAILED",
            message
          }
        },
        { status }
      );
    }

    const bookingUrl = new URL(`/booking/${token}`, request.url);
    bookingUrl.searchParams.set("error", "checkout");
    bookingUrl.searchParams.set("message", message);
    return NextResponse.redirect(bookingUrl, 303);
  }
}
