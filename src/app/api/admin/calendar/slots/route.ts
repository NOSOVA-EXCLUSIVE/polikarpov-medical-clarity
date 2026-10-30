import { NextResponse } from "next/server";

import { createCalendarSlotSchema } from "@/features/booking/schemas";
import { createCalendarSlot } from "@/features/booking/service";
import { assertManualSameOrigin, requireManualStaff } from "@/features/manual-v21/access";
import { localDateTimeToUtc } from "@/features/calendar/time";

function calendarRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/calendar", request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof requireManualStaff>>;
  try { assertManualSameOrigin(request); session = await requireManualStaff(); }
  catch { return NextResponse.json({ error: "Требуется действующий вход врача и запрос с этого сайта." }, { status: 403 }); }

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

  let startsAt: Date | null = null;
  try {
    const [date, time] = parsed.data.startsAtLocal.split("T");
    startsAt = localDateTimeToUtc(date, time, parsed.data.timezone);
  } catch { /* Invalid and ambiguous local times are rejected without shifting them. */ }

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
  } catch {
    return calendarRedirect(request, {
      error: "slot",
      message: "Не удалось открыть интервал. Проверьте время, часовой пояс и пересечения с записями."
    });
  }
}
