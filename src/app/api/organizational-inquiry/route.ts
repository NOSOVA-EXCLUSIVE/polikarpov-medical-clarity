import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIntakeConsent, intakeConsentErrorResponse } from "@/features/questionnaire/intake-consent";
import { buildServiceSelectionSnapshot } from "@/features/questionnaire/service-selection";
import { createOrganizationalContactMetadata, organizationalInquirySchema } from "@/features/questionnaire/organizational-inquiry";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ success: false, error: "Источник запроса не подтверждён." }, { status: 403 });
  try {
    const receipt = await requireIntakeConsent(request);
    if (!(request.headers.get("content-type") ?? "").includes("application/json")) return NextResponse.json({ success: false, error: "Ожидается заполненная форма." }, { status: 400 });
    const input = organizationalInquirySchema.parse(await request.json());
    const contact = createOrganizationalContactMetadata(input);
    const selection = buildServiceSelectionSnapshot("service-selection")!;
    const { prisma } = await import("@/lib/db/prisma");
    const saved = await prisma.$transaction(async (tx) => {
      const claimed = await tx.auditEvent.updateMany({ where: { id: receipt.receiptId, applicationId: null, action: "intake_data_consent_accepted" }, data: { action: "intake_data_consent_claimed" } });
      if (claimed.count !== 1) throw new Error("CONSENT_ALREADY_USED");
      const patient = await tx.patient.create({ data: { fullName: input.name, email: input.email, phone: input.phone, preferredContact: input.preferredContact, country: input.country, city: "", timezone: input.timezone } });
      const application = await tx.application.create({ data: { patientId: patient.id, requestedProductCode: null, status: "NEW", chiefComplaint: `Организационная задача: ${input.task}`, reviewNoteForDoctor: input.materials ? `Перечень материалов: ${input.materials}` : null } });
      await tx.auditEvent.update({ where: { id: receipt.receiptId }, data: { action: "intake_data_consent_accepted", applicationId: application.id } });
      await tx.auditEvent.createMany({ data: [
        { actorType: "SYSTEM", applicationId: application.id, entityType: "APPLICATION", entityId: application.id, action: "service_selection_recorded", metadataJson: selection },
        { actorType: "PATIENT", applicationId: application.id, entityType: "APPLICATION", entityId: application.id, action: "organizational_inquiry_submitted", metadataJson: { kind: "organizational_selection", serviceSelection: selection, consent: receipt, containsMedicalFiles: false, paymentRequired: false, ...(contact ? { contact } : {}) } }
      ] });
      return application;
    });
    let displayNumber = `PMC-${saved.id}`;
    try {
      const { getApplicationDisplayNumber } = await import("@/features/applications/display-number");
      displayNumber = await getApplicationDisplayNumber({ applicationId: saved.id, submittedAt: saved.submittedAt }) || displayNumber;
    } catch { /* The durable application ID remains a usable reference. */ }
    try {
      const { notifyIntakeReceived } = await import("@/features/messages/intake-notifications");
      await notifyIntakeReceived({ kind: "organizational", staff: { applicationId: saved.id, applicationDisplayNumber: displayNumber, patientName: input.name, patientEmail: input.email, patientPhone: input.phone, preferredContact: input.preferredContact, telegramUsername: contact?.telegramUsername, city: "", country: input.country, timezone: input.timezone, requestedProductCode: null, serviceSelection: selection } });
    } catch { /* Notification errors never turn a saved inquiry into a failed submission. */ }
    const response = NextResponse.json({ success: true, displayNumber });
    response.cookies.set("pmc-intake-consent", "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const consentResponse = intakeConsentErrorResponse(error);
    if (consentResponse) return consentResponse;
    if (error instanceof z.ZodError) {
      const contactIssue = error.issues.find((issue) => ["phone", "preferredContact", "telegramUsername", "timezone"].includes(String(issue.path[0])));
      const contactErrors: Record<string, string> = {
        phone: "Проверьте телефон: укажите номер с кодом страны для связи по телефону или WhatsApp, не менее шести цифр и не более 40 символов.",
        preferredContact: "Выберите способ связи: Email, телефон, WhatsApp или Telegram.",
        telegramUsername: "Для связи в Telegram укажите имя пользователя без ссылки: @username.",
        timezone: "Выберите часовой пояс из подсказок или укажите корректный пояс, например Europe/Moscow."
      };
      return NextResponse.json({ success: false, error: contactErrors[String(contactIssue?.path[0])] ?? "Проверьте имя, email, страну и краткое описание задачи." }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Не удалось завершить обработку. Если вы уже получили номер обращения, используйте его при связи по email." }, { status: 503 });
  }
}
