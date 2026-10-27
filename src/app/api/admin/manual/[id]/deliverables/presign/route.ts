import { NextResponse } from "next/server";
import { assertManualSameOrigin, manualErrorStatus, requireManualStaff } from "@/features/manual-v21/access";
import { prepareManualDeliverableUpload } from "@/features/manual-v21/delivery";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertManualSameOrigin(request);
    const actor = await requireManualStaff();
    if (Number(request.headers.get("content-length") || 0) > 4096) return new NextResponse(null, { status: 413 });
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return new NextResponse(null, { status: 404 });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("title" in body) || !("mimeType" in body) || !("sizeBytes" in body) ||
        typeof body.title !== "string" || typeof body.mimeType !== "string" || typeof body.sizeBytes !== "number") {
      return NextResponse.json({ error: "Недопустимые сведения о файле." }, { status: 400 });
    }
    const prepared = await prepareManualDeliverableUpload({ caseId: id, actorId: actor.id,
      title: body.title, mimeType: body.mimeType, sizeBytes: body.sizeBytes });
    return NextResponse.json(prepared, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    return NextResponse.json({ error: "Загрузка не подготовлена. Проверьте размер, формат и состояние обращения." },
      { status: manualErrorStatus(error), headers: { "Cache-Control": "private, no-store" } });
  }
}
