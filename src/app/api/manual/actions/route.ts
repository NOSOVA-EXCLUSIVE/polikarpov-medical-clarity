import { NextResponse } from "next/server";
import { assertManualSameOrigin, manualErrorStatus, requireManualPatient } from "@/features/manual-v21/access";
import { patientManualAction } from "@/features/manual-v21/service";

const ACTIONS = new Set(["request-call", "accept-agreement", "open-contact", "message"]);

export async function POST(request: Request) {
  try {
    assertManualSameOrigin(request);
    const session = await requireManualPatient();
    const length = Number(request.headers.get("content-length") || "0");
    if (length > 64 * 1024) return NextResponse.json({ error: "Слишком большой запрос." }, { status: 413 });
    const form = await request.formData();
    const action = String(form.get("action") || "");
    if (!ACTIONS.has(action)) return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });
    const data: Record<string, string | boolean> = {};
    for (const name of ["slotId", "agreementId", "body", "contactId"]) {
      const value = form.get(name);
      if (typeof value === "string" && value) data[name] = value;
    }
    if (action === "accept-agreement") {
      if (form.get("accepted") !== "yes") return NextResponse.json({ error: "Подтвердите принятие условий." }, { status: 400 });
      data.accepted = true;
    }
    await patientManualAction({ ...session, action, data });
    if (request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ status: "saved" }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const response = NextResponse.redirect(new URL("/manual/cabinet?notice=saved", request.url), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Действие не выполнено. Обновите кабинет и проверьте доступные действия." },
      { status: manualErrorStatus(error), headers: { "Cache-Control": "private, no-store" } });
  }
}
