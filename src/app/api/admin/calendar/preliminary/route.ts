import { NextResponse } from "next/server";
import { z } from "zod";
import { assertManualSameOrigin, manualErrorStatus, requireManualStaff } from "@/features/manual-v21/access";
import { changePreliminarySlot, getAdminCalendarMonth, getAvailablePreliminarySlots, openPreliminarySlots } from "@/features/calendar/service";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const id = z.string().trim().min(1).max(160);
const open = z.object({ action: z.literal("open"), dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(31),
  startTime: z.string().max(5), endTime: z.string().max(5), durationMinutes: z.number().int().min(15).max(240),
  timezone: z.string().min(1).max(100).optional(), timeZone: z.string().min(1).max(100).optional()
}).strict().superRefine((input, context) => {
  if ((!input.timezone && !input.timeZone) || (input.timezone && input.timeZone && input.timezone !== input.timeZone)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["timezone"], message: "Укажите один часовой пояс." });
  }
});
const change = z.object({ action: z.enum(["block", "release"]), slotId: id, note: z.string().max(500).optional() }).strict();

function failure(error: unknown) {
  const code = error instanceof Error && /^CALENDAR_[A-Z_]+$/.test(error.message) ? error.message : "CALENDAR_REQUEST_FAILED";
  const messages: Record<string, string> = {
    CALENDAR_INTERVAL_OCCUPIED: "Интервал пересекается с уже открытым временем или существующей записью. Изменения не сохранены.",
    CALENDAR_SLOT_RESERVED: "Время уже выбрано пациентом. Перенесите или отмените беседу из обращения.",
    CALENDAR_SLOT_CHANGED: "Состояние изменилось. Обновите календарь.",
    CALENDAR_FUTURE_REQUIRED: "Откройте время в будущем.",
    CALENDAR_WINDOW_INVALID: "Проверьте начало, окончание и длительность: интервал должен делиться на целые слоты.",
    CALENDAR_LOCAL_TIME_AMBIGUOUS: "Выбранное время неоднозначно из-за перевода часов. Выберите соседнее время.",
    CALENDAR_LOCAL_TIME_NONEXISTENT: "Выбранное время отсутствует из-за перевода часов. Выберите другое время.",
    CALENDAR_WINDOW_DST_TRANSITION: "Период пересекает перевод часов. Откройте интервалы до или после перевода отдельно.",
    CALENDAR_TOO_MANY_SLOTS: "Слишком много интервалов. Уточните период календаря."
  };
  return NextResponse.json({ error: messages[code] ?? "Действие не выполнено. Проверьте вход, даты, часовой пояс и состояние календаря.", code },
    { status: error instanceof z.ZodError ? 400 : manualErrorStatus(error), headers });
}

export async function GET(request: Request) {
  try {
    await requireManualStaff();
    const url = new URL(request.url);
    if (url.searchParams.get("available") === "1") {
      const caseId = id.parse(url.searchParams.get("caseId"));
      return NextResponse.json({ slots: await getAvailablePreliminarySlots(caseId) }, { headers });
    }
    const timezone = url.searchParams.get("timezone");
    const timeZone = url.searchParams.get("timeZone");
    if (timezone && timeZone && timezone !== timeZone) throw new Error("CALENDAR_TIMEZONE_INVALID");
    const calendar = await getAdminCalendarMonth({ month: url.searchParams.get("month") ?? undefined, timezone: timezone ?? timeZone ?? undefined });
    return NextResponse.json(calendar, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    assertManualSameOrigin(request);
    const actor = await requireManualStaff();
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return NextResponse.json({ error: "Ожидается JSON." }, { status: 415, headers });
    const text = await request.text();
    if (text.length > 32000) return NextResponse.json({ error: "Слишком большой запрос." }, { status: 413, headers });
    const raw = JSON.parse(text);
    if (raw?.action === "open") {
      const input = open.parse(raw);
      const slots = await openPreliminarySlots({ ...input, timezone: input.timezone ?? input.timeZone!, actor });
      return NextResponse.json({ success: true, status: "saved", created: slots.length, createdCount: slots.length, slots }, { headers });
    }
    const input = change.parse(raw);
    return NextResponse.json({ success: true, status: "saved", ...await changePreliminarySlot({ ...input, actor }) }, { headers });
  } catch (error) { return failure(error); }
}
