import { NextResponse } from "next/server";

import { holdSlotSchema } from "@/features/booking/schemas";
import { holdBookingSlot } from "@/features/booking/service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;

  try {
    const json = await request.json();
    const input = holdSlotSchema.parse(json);
    const result = await holdBookingSlot(token, input.slotId);

    return NextResponse.json({
      ok: true,
      data: result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удержать слот.";
    const status =
      typeof error === "object" && error && "status" in error && typeof error.status === "number"
        ? error.status
        : 400;

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BOOKING_HOLD_FAILED",
          message
        }
      },
      { status }
    );
  }
}
