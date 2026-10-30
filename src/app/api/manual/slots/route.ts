import { NextResponse } from "next/server";
import { getPatientAvailableSlots } from "@/features/calendar/service";
import { manualErrorStatus, requireManualPatient } from "@/features/manual-v21/access";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function GET() {
  try {
    const session = await requireManualPatient();
    return NextResponse.json({ slots: await getPatientAvailableSlots(session.caseId, session.grantId) }, { headers });
  } catch (error) {
    return NextResponse.json({ error: "Не удалось получить доступное время. Обновите кабинет и проверьте персональный вход." },
      { status: manualErrorStatus(error), headers });
  }
}
