import { NextResponse } from "next/server";

import { createCalendarSlotSchema } from "@/features/booking/schemas";
import { createCalendarSlot } from "@/features/booking/service";
import { getStaffSession } from "@/lib/auth/session";

function calendarRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/calendar", request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

function parseLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day, hours, minutes] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    0,
    0
  );

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export async function POST(request: Request) {
  const session = await getStaffSession();

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const formData = await request.formData();
  const parsed = createCalendarSlotSchema.safeParse({
    startsAtLocal: formData.get("startsAtLocal"),
    durationMinutes: formData.get("durationMinutes"),
    timezone: formData.get("timezone")
  });

  if (!parsed.success) {
    return calendarRedirect(request, {
      error: "slot",
      message:
        parsed.error.issues[0]?.message ??
        "Проверьте дату, время и длительность слота."
    });
  }

  const startsAt = parseLocalDateTime(parsed.data.startsAtLocal);

  if (!startsAt) {
    return calendarRedirect(request, {
      error: "slot",
      message: "Не удалось прочитать выбранные дату и время."
    });
  }

  try {
    await createCalendarSlot({
      actor: session,
      startsAt,
      durationMinutes: parsed.data.durationMinutes,
      timezone: parsed.data.timezone
    });

    return calendarRedirect(request, { notice: "slot_created" });
  } catch (error) {
    return calendarRedirect(request, {
      error: "slot",
      message:
        error instanceof Error && error.message
          ? error.message
          : "Не удалось обновить календарь. Повторите попытку."
    });
  }
}
