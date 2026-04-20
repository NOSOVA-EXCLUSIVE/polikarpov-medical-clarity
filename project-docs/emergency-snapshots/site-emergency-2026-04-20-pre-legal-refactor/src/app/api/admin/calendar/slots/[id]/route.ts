import { NextResponse } from "next/server";

import { updateCalendarSlotSchema } from "@/features/booking/schemas";
import { updateCalendarSlotStatus } from "@/features/booking/service";
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
  const parsed = updateCalendarSlotSchema.safeParse({
    action: formData.get("action"),
    note: formData.get("note")
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/admin/calendar?error=slot", request.url), 303);
  }

  try {
    await updateCalendarSlotStatus({
      actor: session,
      slotId: id,
      action: parsed.data.action,
      note: parsed.data.note
    });

    return NextResponse.redirect(new URL("/admin/calendar?notice=slot_updated", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/admin/calendar?error=slot", request.url), 303);
  }
}
