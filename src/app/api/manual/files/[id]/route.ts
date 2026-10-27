import { NextResponse } from "next/server";
import { requireManualPatient, manualErrorStatus } from "@/features/manual-v21/access";
import { getManualDeliverableResponse } from "@/features/manual-v21/delivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireManualPatient();
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return new NextResponse(null, { status: 404 });
    return await getManualDeliverableResponse({ caseId: session.caseId, id, range: request.headers.get("range") });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error && error.status === 416 ? 416 : manualErrorStatus(error);
    return NextResponse.json({ error: "Материал недоступен. Проверьте вход и срок доступа к обращению." },
      { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  }
}
