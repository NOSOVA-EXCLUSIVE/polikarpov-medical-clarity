import { NextResponse } from "next/server";
import { assertManualSameOrigin, manualErrorStatus, requireManualStaff } from "@/features/manual-v21/access";
import { completeManualDeliverableUpload } from "@/features/manual-v21/delivery";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertManualSameOrigin(request);
    const actor = await requireManualStaff();
    if (Number(request.headers.get("content-length") || 0) > 1024) return new NextResponse(null, { status: 413 });
    const { id } = await context.params;
    const body: unknown = await request.json();
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !body || typeof body !== "object" || !("id" in body) ||
        typeof body.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(body.id)) {
      return NextResponse.json({ error: "Недопустимый идентификатор загрузки." }, { status: 400 });
    }
    const result = await completeManualDeliverableUpload({ caseId: id, id: body.id, actorId: actor.id });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: "Файл пока не подтверждён и пациенту не выдан. Проверьте завершение загрузки или повторите проверку." },
      { status: manualErrorStatus(error), headers: { "Cache-Control": "private, no-store" } });
  }
}
