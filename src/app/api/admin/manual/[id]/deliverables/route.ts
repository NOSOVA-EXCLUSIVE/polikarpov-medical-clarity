import { NextResponse } from "next/server";
import { assertManualSameOrigin, manualErrorStatus, requireManualStaff } from "@/features/manual-v21/access";
import { MANUAL_DELIVERY_MAX_BYTES, publishManualDeliverable } from "@/features/manual-v21/delivery";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertManualSameOrigin(request);
    const actor = await requireManualStaff();
    if (Number(request.headers.get("content-length") || 0) > MANUAL_DELIVERY_MAX_BYTES + 64 * 1024) {
      return NextResponse.json({ error: "Файл не должен превышать 3 МиБ." }, { status: 413 });
    }
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > MANUAL_DELIVERY_MAX_BYTES) {
      return NextResponse.json({ error: "Выберите файл до 3 МиБ." }, { status: 400 });
    }
    const manualCase = await publishManualDeliverable({ caseId: id, actorId: actor.id,
      title: String(form.get("title") || ""), mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
    void manualCase;
    return NextResponse.redirect(new URL(`/admin/manual/${encodeURIComponent(id)}?notice=material_published`, request.url), 303);
  } catch (error) {
    return NextResponse.json({ error: "Материал не опубликован. Проверьте формат, размер и состояние обращения." },
      { status: manualErrorStatus(error), headers: { "Cache-Control": "private, no-store" } });
  }
}
