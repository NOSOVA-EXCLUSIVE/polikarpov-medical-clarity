import { NextResponse } from "next/server";
import { manualErrorStatus, requireManualStaff } from "@/features/manual-v21/access";
import { getManualDeliverableResponse } from "@/features/manual-v21/delivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    await requireManualStaff();
    const { id, fileId } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !/^[A-Za-z0-9_-]{1,100}$/.test(fileId)) {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    }
    // The shared proxy looks up both IDs together. A file ID from another case cannot be substituted.
    return await getManualDeliverableResponse({ caseId: id, id: fileId, range: request.headers.get("range") });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error && error.status === 416 ? 416 : manualErrorStatus(error);
    return NextResponse.json({ error: "Материал недоступен. Проверьте вход и принадлежность обращения." },
      { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  }
}
