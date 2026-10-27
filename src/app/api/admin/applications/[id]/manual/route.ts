import { NextResponse } from "next/server";
import { assertManualSameOrigin, requireManualStaff } from "@/features/manual-v21/access";
import { createManualCase, createManualGrant, getManualCase, getManualContext, staffManualAction } from "@/features/manual-v21/service";
import { sendTransactionalEmail } from "@/lib/email/postmark";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertManualSameOrigin(request);
    const actor = await requireManualStaff();
    const { id } = await params;
    if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) throw new Error("JSON_REQUIRED");
    const text = await request.text();
    if (text.length > 24000) throw new Error("REQUEST_TOO_LARGE");
    const input = JSON.parse(text);
    if (input.action === "create") {
      const record = await createManualCase({ applicationId: id, actor });
      return NextResponse.json({ caseId: record.id }, { headers: privateHeaders });
    }
    const record = await getManualCase(id);
    if (!record) throw new Error("MANUAL_CASE_NOT_FOUND");
    if (input.action === "reissue-access") {
      const grant = await createManualGrant({ caseId: record.id, actor });
      const accessUrl = new URL(`/manual/access/${grant.token}`, request.url).toString();
      let delivery: string | undefined;
      if (input.data?.sendLink === "on") {
        const context = await getManualContext(record.id);
        try {
          const email = await sendTransactionalEmail({ to: context.application.patient.email,
            subject: "Polikarpov Medical Clarity — персональный кабинет",
            textBody: `Номер обращения: ${context.reference}. Персональный вход: ${accessUrl}\nНе передавайте эту ссылку другим людям.`,
            htmlBody: `<p>Номер обращения: ${context.reference}</p><p><a href="${accessUrl}">Открыть свой кабинет</a></p><p>Не передавайте эту ссылку другим людям.</p>` });
          delivery = email.status;
          await prisma.auditEvent.create({ data: { actorType: "USER", actorUserId: actor.id,
            applicationId: id, entityType: "APPLICATION", entityId: id, action: "manual_v21_access_email",
            metadataJson: { caseId: record.id, deliveryStatus: email.status, ...(email.status === "captured" ? { captureId: email.captureId } : {}) } } });
        } catch { delivery = "failed"; }
      }
      return NextResponse.json({ caseId: record.id, accessUrl, delivery }, { headers: privateHeaders });
    }
    await staffManualAction({ caseId: record.id, actor, action: input.action, data: input.data });
    return NextResponse.json({ caseId: record.id, status: "saved" }, { headers: privateHeaders });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "MANUAL_ACTION_FAILED";
    const code = /^[A-Z][A-Z0-9_]{2,80}$/.test(raw) ? raw : "MANUAL_ACTION_FAILED";
    return NextResponse.json({ code }, { status: 400, headers: privateHeaders });
  }
}
