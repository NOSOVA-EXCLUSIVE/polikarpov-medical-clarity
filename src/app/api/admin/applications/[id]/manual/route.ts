import { NextResponse } from "next/server";
import { assertManualSameOrigin, requireManualStaff } from "@/features/manual-v21/access";
import { createManualCase, createManualGrant, getManualCase, getManualContext, staffManualAction } from "@/features/manual-v21/service";
import { sendTransactionalEmail } from "@/lib/email/postmark";
import { prisma } from "@/lib/db/prisma";
import { getApplicationDisplayNumber } from "@/features/applications/display-number";

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
    const record = input.action === "create"
      ? await createManualCase({ applicationId: id, actor })
      : await getManualCase(id);
    if (!record) throw new Error("MANUAL_CASE_NOT_FOUND");
    if (input.action === "create" && input.data?.sendLink !== "on") {
      return NextResponse.json({ caseId: record.id }, { headers: privateHeaders });
    }
    if (input.action === "reissue-access" || input.action === "create") {
      const grant = await createManualGrant({ caseId: record.id, actor });
      const accessUrl = new URL(`/manual/access/${grant.token}`, request.url).toString();
      let delivery: string | undefined;
      if (input.data?.sendLink === "on") {
        const context = await getManualContext(record.id);
        const reference = await getApplicationDisplayNumber({ applicationId: id }) ?? context.reference;
        try {
          const email = await sendTransactionalEmail({ to: context.application.patient.email,
            subject: "Polikarpov Medical Clarity — ссылка для записи",
            textBody: `Номер обращения: ${reference}. Выберите время предварительной беседы из интервалов, открытых врачом. Персональный вход: ${accessUrl}\nЗапись подтверждает врач. Не передавайте эту ссылку другим людям.`,
            htmlBody: `<p>Номер обращения: ${reference}</p><p>Выберите время предварительной беседы из интервалов, открытых врачом.</p><p><a href="${accessUrl}">Выбрать время и открыть кабинет</a></p><p>Запись подтверждает врач. Не передавайте эту ссылку другим людям.</p>` });
          delivery = email.status;
          try { await prisma.auditEvent.create({ data: { actorType: "USER", actorUserId: actor.id,
            applicationId: id, entityType: "APPLICATION", entityId: id, action: "manual_v21_access_email",
            metadataJson: { caseId: record.id, deliveryStatus: email.status, ...(email.status === "captured" ? { captureId: email.captureId } : {}) } } });
          } catch { /* An audit failure cannot change a confirmed provider outcome. */ }
        } catch {
          delivery = "failed";
          try { await prisma.auditEvent.create({ data: { actorType: "USER", actorUserId: actor.id,
            applicationId: id, entityType: "APPLICATION", entityId: id, action: "manual_v21_access_email",
            metadataJson: { caseId: record.id, deliveryStatus: "failed" } } }); } catch { /* Keep the valid access and result available to staff. */ }
        }
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
