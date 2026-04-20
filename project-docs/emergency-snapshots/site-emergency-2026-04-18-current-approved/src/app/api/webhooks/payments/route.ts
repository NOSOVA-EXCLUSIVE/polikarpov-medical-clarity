import { NextResponse } from "next/server";

import { handleStripeWebhookEvent, isStripeSignatureValid } from "@/features/booking/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MISSING_SIGNATURE",
          message: "Missing Stripe signature."
        }
      },
      { status: 400 }
    );
  }

  try {
    const rawBody = await request.text();
    const event = isStripeSignatureValid(rawBody, signature);
    const result = await handleStripeWebhookEvent(event);

    return NextResponse.json({
      ok: true,
      data: result
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "WEBHOOK_FAILED",
          message: error instanceof Error ? error.message : "Webhook processing failed."
        }
      },
      { status: 400 }
    );
  }
}
