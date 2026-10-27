import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIntakeConsent, intakeConsentErrorResponse } from "@/features/questionnaire/intake-consent";
import { buildServiceSelectionSnapshot } from "@/features/questionnaire/service-selection";

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  country: z.string().trim().min(2).max(80),
  task: z.string().trim().min(5).max(1000),
  materials: z.string().trim().max(1000).default(""),
  website: z.string().max(0).optional()
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ success: false, error: "Источник запроса не подтверждён." }, { status: 403 });
  try {
    const receipt = await requireIntakeConsent(request);
    if (!(request.headers.get("content-type") ?? "").includes("application/json")) return NextResponse.json({ success: false, error: "Ожидается заполненная форма." }, { status: 400 });
    const input = inquirySchema.parse(await request.json());
    const selection = buildServiceSelectionSnapshot("service-selection")!;
    const { prisma } = await import("@/lib/db/prisma");
    const saved = await prisma.$transaction(async (tx) => {
      const claimed = await tx.auditEvent.updateMany({ where: { id: receipt.receiptId, applicationId: null, action: "intake_data_consent_accepted" }, data: { action: "intake_data_consent_claimed" } });
      if (claimed.count !== 1) throw new Error("CONSENT_ALREADY_USED");
      const patient = await tx.patient.create({ data: { fullName: input.name, email: input.email, phone: "", preferredContact: "EMAIL", country: input.country, city: "", timezone: "" } });
      const application = await tx.application.create({ data: { patientId: patient.id, requestedProductCode: null, status: "NEW", chiefComplaint: `Организационная задача: ${input.task}`, reviewNoteForDoctor: input.materials ? `Перечень материалов: ${input.materials}` : null } });
      await tx.auditEvent.update({ where: { id: receipt.receiptId }, data: { action: "intake_data_consent_accepted", applicationId: application.id } });
      await tx.auditEvent.createMany({ data: [
        { actorType: "SYSTEM", applicationId: application.id, entityType: "APPLICATION", entityId: application.id, action: "service_selection_recorded", metadataJson: selection },
        { actorType: "PATIENT", applicationId: application.id, entityType: "APPLICATION", entityId: application.id, action: "organizational_inquiry_submitted", metadataJson: { kind: "organizational_selection", serviceSelection: selection, consent: receipt, containsMedicalFiles: false, paymentRequired: false } }
      ] });
      return application;
    });
    let displayNumber = `PMC-${saved.id}`;
    try {
      const { getApplicationDisplayNumber } = await import("@/features/applications/display-number");
      displayNumber = await getApplicationDisplayNumber({ applicationId: saved.id, submittedAt: saved.submittedAt }) || displayNumber;
    } catch { /* The durable application ID remains a usable reference. */ }
    try {
      const { sendQuestionnaireSubmittedStaffEmail } = await import("@/features/messages/notifications");
      const delivery = await sendQuestionnaireSubmittedStaffEmail({ applicationId: saved.id, applicationDisplayNumber: displayNumber, patientName: input.name, patientEmail: input.email, patientPhone: "", preferredContact: "EMAIL", city: "", country: input.country, timezone: "", requestedProductCode: null, serviceSelection: selection });
      await prisma.auditEvent.create({ data: { actorType: "SYSTEM", applicationId: saved.id, entityType: "APPLICATION", entityId: saved.id, action: "organizational_staff_notification", metadataJson: { status: delivery.status, provider: delivery.provider, ...(delivery.captureId ? { captureId: delivery.captureId } : {}) } } });
    } catch { /* Notification errors never turn a saved inquiry into a failed submission. */ }
    const response = NextResponse.json({ success: true, displayNumber });
    response.cookies.set("pmc-intake-consent", "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const consentResponse = intakeConsentErrorResponse(error);
    if (consentResponse) return consentResponse;
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, error: "Проверьте имя, email, страну и краткое описание задачи." }, { status: 400 });
    return NextResponse.json({ success: false, error: "Не удалось завершить обработку. Если вы уже получили номер обращения, используйте его при связи по email." }, { status: 503 });
  }
}
