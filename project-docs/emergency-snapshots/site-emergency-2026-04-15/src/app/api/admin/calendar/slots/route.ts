import { NextResponse } from "next/server";

import { createCalendarSlotSchema } from "@/features/booking/schemas";
import { createCalendarSlot } from "@/features/booking/service";
import { getStaffSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  const session = await getStaffSession();

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const formData = await request.formData();
  const parsed = createCalendarSlotSchema.safeParse({
    startsAtIso: formData.get("startsAtIso"),
    durationMinutes: formData.get("durationMinutes"),
    timezone: formData.get("timezone")
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/admin/calendar?error=slot", request.url), 303);
  }

  try {
    await createCalendarSlot({
      actor: session,
      startsAt: new Date(parsed.data.startsAtIso),
      durationMinutes: parsed.data.durationMinutes,
      timezone: parsed.data.timezone
    });

    return NextResponse.redirect(new URL("/admin/calendar?notice=slot_created", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/admin/calendar?error=slot", request.url), 303);
  }
}
