import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/security/tokens";
import { getServiceV21 } from "@/features/products/services-v21";
import { readServiceSelectionSnapshot } from "@/features/questionnaire/service-selection";
import { addCalendarDays, canOpenManualContact, getManualPolicy, isManualAccessOpen, parseCallInterval, parseManualPolicy } from "./policy";
import { manualAgreementSchema, manualCallSchema, manualPatientSchemas, manualPaymentSchema, manualStaffSchemas } from "./schemas";

type Actor = { id: string; role?: string; email?: string; name?: string };
type Tx = Prisma.TransactionClient;
const caseInclude = {
  application: { select: { id: true, patientId: true, status: true, patient: { select: { fullName: true, email: true, timezone: true } } } },
  currentAgreement: true,
  agreements: { orderBy: { revision: "asc" as const } },
  receipts: { orderBy: { createdAt: "asc" as const } },
  contacts: { orderBy: { ordinal: "asc" as const } },
  messages: { orderBy: { createdAt: "asc" as const } },
  deliverables: { where: { status: "READY" }, orderBy: { createdAt: "asc" as const } }
} as const;

function fail(code: string): never { throw new Error(code); }

function requireDoctor(actor: { role: string }) {
  if (actor.role !== "DOCTOR") fail("DOCTOR_ACTION_REQUIRED");
}

async function requireActor(tx: Tx, actor: Actor) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, isActive: true } });
  if (!user?.isActive || !["ADMIN", "DOCTOR"].includes(user.role)) fail("STAFF_ACCESS_DENIED");
  return user;
}

async function event(tx: Tx, caseRecord: { id: string; applicationId: string }, action: string, actorId?: string, metadata: Record<string, unknown> = {}) {
  await tx.auditEvent.create({ data: {
    actorType: actorId ? "USER" : "PATIENT", actorUserId: actorId,
    applicationId: caseRecord.applicationId, entityType: "APPLICATION", entityId: caseRecord.applicationId,
    action: `manual_v21_${action}`, metadataJson: { caseId: caseRecord.id, ...metadata } as Prisma.InputJsonValue
  } });
}

export async function getManualCase(applicationId: string) {
  return prisma.manualCase.findUnique({ where: { applicationId } });
}

export async function getManualContext(caseId: string) {
  const result = await prisma.manualCase.findUnique({ where: { id: caseId }, include: caseInclude });
  if (!result) fail("MANUAL_CASE_NOT_FOUND");
  return result;
}
export type ManualContext = Awaited<ReturnType<typeof getManualContext>>;

export async function createManualCase(input: { applicationId: string; actor: Actor }) {
  return prisma.$transaction(async (tx) => {
    await requireActor(tx, input.actor);
    const existing = await tx.manualCase.findUnique({ where: { applicationId: input.applicationId } });
    if (existing) return existing;
    const application = await tx.application.findUnique({ where: { id: input.applicationId }, include: { offers: true, messageThread: true } });
    if (!application || ["ARCHIVED", "REJECTED"].includes(application.status)) fail("APPLICATION_NOT_ELIGIBLE");
    if (application.offers.length || application.messageThread) fail("LEGACY_CASE_PRESERVED");
    const selection = await tx.auditEvent.findFirst({ where: { applicationId: application.id, action: "service_selection_recorded" }, orderBy: { createdAt: "asc" } });
    if (!readServiceSelectionSnapshot(selection?.metadataJson)) fail("V21_SELECTION_REQUIRED");
    const created = await tx.manualCase.create({ data: { applicationId: application.id, reference: `PMC-${randomUUID().toUpperCase()}` } });
    await event(tx, created, "case_created", input.actor.id);
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function issueGrant(tx: Tx, caseRecord: { id: string; applicationId: string; completedAt: Date | null; patientAccessEndsAt: Date | null }, actorId: string, now: Date) {
  if (!isManualAccessOpen(caseRecord, now)) fail("MANUAL_ACCESS_EXPIRED");
  const token = createOpaqueToken();
  const expiresAt = new Date(Math.min(addCalendarDays(now, 1).getTime(), caseRecord.patientAccessEndsAt?.getTime() ?? Infinity));
  await tx.manualGrant.updateMany({ where: { caseId: caseRecord.id, revokedAt: null }, data: { revokedAt: now } });
  const grant = await tx.manualGrant.create({ data: { caseId: caseRecord.id, tokenHash: hashOpaqueToken(token), expiresAt } });
  await event(tx, caseRecord, "access_issued", actorId, { grantId: grant.id });
  return { id: grant.id, token, expiresAt };
}

export async function createManualGrant(input: { caseId: string; actor: Actor }) {
  return prisma.$transaction(async (tx) => {
    await requireActor(tx, input.actor);
    const record = await tx.manualCase.findUnique({ where: { id: input.caseId }, include: { application: { select: { status: true } } } });
    if (!record) fail("MANUAL_CASE_NOT_FOUND");
    if (["ARCHIVED", "REJECTED"].includes(record.application.status)) fail("APPLICATION_NOT_ELIGIBLE");
    return issueGrant(tx, record, input.actor.id, new Date());
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function checkGrant(tx: Tx, input: { caseId: string; grantId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const grant = await tx.manualGrant.findFirst({ where: { id: input.grantId, caseId: input.caseId, revokedAt: null, expiresAt: { gt: now }, case: { application: { status: { notIn: ["ARCHIVED", "REJECTED"] } } } }, select: { id: true, case: true } });
  if (!grant || !isManualAccessOpen(grant.case, now)) fail("MANUAL_ACCESS_DENIED");
  return grant.case;
}

export async function assertManualGrant(input: { caseId: string; grantId: string; now?: Date }) {
  return checkGrant(prisma, input);
}

export async function consumeManualGrant(rawToken: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(rawToken)) fail("MANUAL_ACCESS_DENIED");
  const now = new Date();
  const grant = await prisma.manualGrant.findFirst({ where: { tokenHash: hashOpaqueToken(rawToken), revokedAt: null, expiresAt: { gt: now }, case: { application: { status: { notIn: ["ARCHIVED", "REJECTED"] } } } }, select: { id: true, caseId: true, case: { include: { application: { include: { patient: true } } } } } });
  if (!grant || !isManualAccessOpen(grant.case, now)) fail("MANUAL_ACCESS_DENIED");
  return { caseId: grant.caseId, grantId: grant.id, applicationId: grant.case.applicationId, patientName: grant.case.application.patient.fullName, patientEmail: grant.case.application.patient.email };
}

async function lockedCase(tx: Tx, caseId: string) {
  const record = await tx.manualCase.findUnique({ where: { id: caseId }, include: caseInclude });
  if (!record) fail("MANUAL_CASE_NOT_FOUND");
  const claim = await tx.manualCase.updateMany({ where: { id: record.id, version: record.version }, data: { version: { increment: 1 } } });
  if (claim.count !== 1) fail("MANUAL_CONCURRENT_CHANGE");
  return record;
}

async function ensureNoCallConflict(tx: Tx, caseId: string, startsAt: Date, endsAt: Date) {
  const [manual, legacy] = await Promise.all([
    tx.manualCase.findFirst({ where: { id: { not: caseId }, callConfirmedAt: { not: null }, callCompletedAt: null, callStartsAt: { lt: endsAt }, callEndsAt: { gt: startsAt } }, select: { id: true } }),
    tx.appointment.findFirst({ where: { status: "SCHEDULED", startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } })
  ]);
  if (manual || legacy) fail("CALL_TIME_UNAVAILABLE");
}

async function addMessage(tx: Tx, record: { id: string }, body: string, role: string, senderUserId?: string, contactId?: string, kind: "MESSAGE" | "OPENING" | "REPLY" | "RESULT" = "MESSAGE") {
  if (contactId) {
    const contact = await tx.manualContact.findFirst({ where: { id: contactId, caseId: record.id, status: "OPEN" } });
    if (!contact) fail("CONTACT_NOT_OPEN");
  }
  return tx.manualMessage.create({ data: { caseId: record.id, contactId, authorRole: role, body, senderUserId, kind } });
}

export async function staffManualAction(input: { caseId: string; actor: Actor; action: string; data?: unknown }) {
  const schema = manualStaffSchemas[input.action as keyof typeof manualStaffSchemas];
  if (!schema) fail("MANUAL_ACTION_INVALID");
  const data = schema.parse(input.data ?? {});
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const actor = await requireActor(tx, input.actor);
    const record = await lockedCase(tx, input.caseId);
    const agreement = record.currentAgreement;
    if (["ARCHIVED", "REJECTED"].includes(record.application.status)) fail("APPLICATION_NOT_ELIGIBLE");
    let auditDetails: Record<string, unknown> = {};
    if (record.phase === "COMPLETED" && !["reissue-access"].includes(input.action)) fail("MANUAL_CASE_READ_ONLY");

    switch (input.action) {
      case "link-organizational-call": {
        requireDoctor(actor);
        const values = manualStaffSchemas["link-organizational-call"].parse(data);
        if (!["REVIEW", "CALL_REQUESTED"].includes(record.phase) || values.sourceCaseId === record.id) fail("ORGANIZATIONAL_CALL_LINK_NOT_ALLOWED");
        const [targetSelectionEvent, legal, source] = await Promise.all([
          tx.auditEvent.findFirst({ where: { applicationId: record.applicationId, action: "service_selection_recorded" }, orderBy: { createdAt: "asc" } }),
          tx.legalAcceptance.findUnique({ where: { applicationId: record.applicationId } }),
          tx.manualCase.findUnique({ where: { id: values.sourceCaseId }, include: { application: { select: { status: true, patient: { select: { email: true } } } } } })
        ]);
        const targetSelection = readServiceSelectionSnapshot(targetSelectionEvent?.metadataJson);
        if (!legal || targetSelection?.kind !== "paid_service" || getServiceV21(targetSelection.id)?.kind !== "paid_service") fail("FULL_PAID_QUESTIONNAIRE_REQUIRED");
        if (!source || ["ARCHIVED", "REJECTED"].includes(source.application.status)) fail("ORGANIZATIONAL_CALL_SOURCE_INVALID");
        const sourceSelectionEvent = await tx.auditEvent.findFirst({ where: { applicationId: source.applicationId, action: "service_selection_recorded" }, orderBy: { createdAt: "asc" } });
        const sourceSelection = readServiceSelectionSnapshot(sourceSelectionEvent?.metadataJson);
        if (sourceSelection?.kind !== "organizational_selection" || sourceSelection.id !== "service-selection") fail("ORGANIZATIONAL_CALL_SOURCE_REQUIRED");
        if (!source.callCompletedAt || !source.callConfirmedAt || !source.callStartsAt || !source.callEndsAt || !source.callTimezone) fail("COMPLETED_ORGANIZATIONAL_CALL_REQUIRED");
        if (source.application.patient.email.trim().toLowerCase() !== record.application.patient.email.trim().toLowerCase()) fail("ORGANIZATIONAL_CALL_PATIENT_MISMATCH");
        await tx.manualCase.update({ where: { id: record.id }, data: {
          phase: "CALL_COMPLETED", callRequestedAt: source.callRequestedAt, callConfirmedAt: source.callConfirmedAt,
          callCompletedAt: source.callCompletedAt, callStartsAt: source.callStartsAt, callEndsAt: source.callEndsAt,
          callTimezone: source.callTimezone
        } });
        auditDetails = { sourceCaseId: source.id, sameTaskConfirmed: true, startsAt: source.callStartsAt.toISOString(), endsAt: source.callEndsAt.toISOString(), timezone: source.callTimezone, completedAt: source.callCompletedAt.toISOString(), priorRequestedStartsAt: record.callStartsAt?.toISOString() ?? null };
        break;
      }
      case "request-call": {
        if (!["REVIEW", "CALL_REQUESTED", "CALL_CONFIRMED"].includes(record.phase)) fail("CALL_STAGE_CLOSED");
        const call = manualCallSchema.parse(data);
        const interval = parseCallInterval({ startsAt: call.startsAt!, endsAt: call.endsAt!, timezone: call.timezone! });
        auditDetails = { startsAt: interval.startsAt.toISOString(), endsAt: interval.endsAt.toISOString(), timezone: interval.timezone, priorStartsAt: record.callStartsAt?.toISOString() ?? null, priorConfirmedAt: record.callConfirmedAt?.toISOString() ?? null };
        await tx.manualCase.update({ where: { id: record.id }, data: { phase: "CALL_REQUESTED", callStartsAt: interval.startsAt, callEndsAt: interval.endsAt, callTimezone: interval.timezone, callRequestedAt: now, callConfirmedAt: null, callCompletedAt: null } });
        break;
      }
      case "confirm-call": {
        requireDoctor(actor);
        if (record.phase === "CALL_CONFIRMED") break;
        if (record.phase !== "CALL_REQUESTED" || !record.callStartsAt || !record.callEndsAt) fail("CALL_REQUEST_REQUIRED");
        await ensureNoCallConflict(tx, record.id, record.callStartsAt, record.callEndsAt);
        await tx.manualCase.update({ where: { id: record.id }, data: { phase: "CALL_CONFIRMED", callConfirmedAt: now } });
        break;
      }
      case "complete-call": {
        requireDoctor(actor);
        if (record.phase === "CALL_COMPLETED") break;
        if (record.phase !== "CALL_CONFIRMED" || !record.callStartsAt || record.callStartsAt > now) fail("CONFIRMED_CALL_REQUIRED");
        await tx.manualCase.update({ where: { id: record.id }, data: { phase: "CALL_COMPLETED", callCompletedAt: now } });
        break;
      }
      case "create-agreement": {
        requireDoctor(actor);
        if (!record.callCompletedAt || !["CALL_COMPLETED", "OFFERED", "ACCEPTED"].includes(record.phase)) fail("COMPLETED_CALL_REQUIRED");
        if (record.receipts.length) fail("PAID_TERMS_IMMUTABLE");
        const values = manualAgreementSchema.parse(data);
        const service = getServiceV21(values.serviceId);
        if (!service || service.kind !== "paid_service") fail("PAID_SERVICE_REQUIRED");
        const legal = await tx.legalAcceptance.findUnique({ where: { applicationId: record.applicationId } });
        if (!legal) fail("FULL_QUESTIONNAIRE_REQUIRED");
        let discountCents = 0;
        if (values.discountSourceCaseId) {
          if (!values.sameClinicalCase || !["second-opinion", "clinical-review", "complex-review", "complex-case"].includes(service.id)) fail("DISCOUNT_NOT_ELIGIBLE");
          const source = await tx.manualCase.findUnique({ where: { id: values.discountSourceCaseId }, include: { application: { include: { patient: true } }, currentAgreement: { include: { receipt: true } } } });
          if (!source?.resultDeliveredAt || source.resultDeliveredAt > now || now >= addCalendarDays(source.resultDeliveredAt, 45) || source.currentAgreement?.serviceId !== "initial-assessment" || !source.currentAgreement.receipt || source.application.patient.email.trim().toLowerCase() !== record.application.patient.email.trim().toLowerCase()) fail("DISCOUNT_SOURCE_INVALID");
          const used = await tx.manualAgreement.findFirst({ where: { discountSourceCaseId: source.id, receipt: { isNot: null } }, select: { id: true } });
          if (used) fail("DISCOUNT_ALREADY_USED");
          discountCents = 1000;
        }
        if (service.priceFrom ? values.amountCents < service.amountCents - discountCents : values.amountCents !== service.amountCents - discountCents) fail("CATALOG_AMOUNT_MISMATCH");
        const policy = getManualPolicy(service.id);
        if (service.id === "clinical-review") {
          if (!values.clarificationDays) fail("CLARIFICATION_PERIOD_REQUIRED");
          policy.clarificationDays = values.clarificationDays;
        } else if (values.clarificationDays && values.clarificationDays !== policy.clarificationDays) fail("CLARIFICATION_PERIOD_NOT_APPLICABLE");
        const next = await tx.manualAgreement.create({ data: { caseId: record.id, revision: record.agreements.length + 1, serviceId: service.id, title: service.title, scopeJson: [values.scope], amountCents: values.amountCents, currency: service.currency, turnaround: values.turnaround, policyJson: policy as unknown as Prisma.InputJsonValue, discountSourceCaseId: values.discountSourceCaseId, createdByUserId: actor.id } });
        if (agreement) await tx.manualAgreement.update({ where: { id: agreement.id }, data: { supersededAt: now } });
        await tx.manualCase.update({ where: { id: record.id }, data: { phase: "OFFERED", currentAgreementId: next.id } });
        break;
      }
      case "record-payment": {
        const values = manualPaymentSchema.parse(data);
        if (!agreement || agreement.id !== values.agreementId || !agreement.acceptedAt || agreement.supersededAt) fail("ACCEPTED_AGREEMENT_REQUIRED");
        if (record.receipts.some((receipt) => receipt.agreementId === agreement.id)) break;
        if (record.phase !== "ACCEPTED") fail("PAYMENT_STAGE_INVALID");
        if (agreement.discountSourceCaseId) {
          // Claim the source row as well: serializable transactions make concurrent redemption fail closed.
          await tx.manualCase.update({ where: { id: agreement.discountSourceCaseId }, data: { version: { increment: 1 } } });
          const used = await tx.manualAgreement.findFirst({ where: { discountSourceCaseId: agreement.discountSourceCaseId, receipt: { isNot: null }, id: { not: agreement.id } }, select: { id: true } });
          if (used) fail("DISCOUNT_ALREADY_USED");
          const source = await tx.manualCase.findUnique({ where: { id: agreement.discountSourceCaseId }, select: { resultDeliveredAt: true } });
          if (!source?.resultDeliveredAt || now >= addCalendarDays(source.resultDeliveredAt, 45)) fail("DISCOUNT_EXPIRED");
        }
        if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(values.receivedAt)) fail("PAYMENT_OFFSET_REQUIRED");
        const receivedAt = new Date(values.receivedAt);
        if (!Number.isFinite(receivedAt.getTime()) || receivedAt > now || receivedAt < agreement.acceptedAt) fail("PAYMENT_DATE_INVALID");
        await tx.manualReceipt.create({ data: { caseId: record.id, agreementId: agreement.id, amountCents: agreement.amountCents, currency: agreement.currency, receivedAt, recordedByUserId: actor.id } });
        await tx.manualCase.update({ where: { id: record.id }, data: { phase: "PAID" } });
        break;
      }
      case "start": {
        requireDoctor(actor);
        if (record.phase === "ACTIVE") break;
        if (record.phase !== "PAID" || !agreement?.acceptedAt || agreement.supersededAt || !record.receipts.some((receipt) => receipt.agreementId === agreement.id)) fail("ACCEPTED_PAID_AGREEMENT_REQUIRED");
        const policy = parseManualPolicy(agreement.policyJson);
        await tx.manualCase.update({ where: { id: record.id }, data: { phase: "ACTIVE", workStartedAt: now, workEndsAt: policy.packageDays ? addCalendarDays(now, policy.packageDays) : null } });
        await addMessage(tx, record, `Работа начата. Ответы — до трёх рабочих дней. Номер обращения: ${record.reference}.`, "SYSTEM");
        break;
      }
      case "deliver-result": {
        requireDoctor(actor);
        if (record.phase !== "ACTIVE") fail("ACTIVE_CASE_REQUIRED");
        const values = manualStaffSchemas["deliver-result"].parse(data);
        if (record.resultDeliveredAt) fail("RESULT_ALREADY_DELIVERED");
        await addMessage(tx, record, values.body, actor.role, actor.id, undefined, "RESULT");
        if (!agreement) fail("AGREEMENT_REQUIRED");
        const policy = parseManualPolicy(agreement.policyJson);
        await tx.manualCase.update({ where: { id: record.id }, data: { resultDeliveredAt: now, ...(policy.clarificationDays ? { workEndsAt: addCalendarDays(now, policy.clarificationDays) } : {}) } });
        break;
      }
      case "reply": {
        const values = manualStaffSchemas.reply.parse(data);
        await addMessage(tx, record, values.body, actor.role, actor.id, values.contactId, values.contactId ? "REPLY" : "MESSAGE");
        break;
      }
      case "open-contact": {
        requireDoctor(actor);
        if (!agreement) fail("AGREEMENT_REQUIRED");
        const values = manualStaffSchemas["open-contact"].parse(data);
        const policy = parseManualPolicy(agreement.policyJson);
        if (!policy.packageDays || !canOpenManualContact({ phase: record.phase, policy, contactCount: record.contacts.length, hasOpenContact: record.contacts.some((contact) => contact.status === "OPEN"), workEndsAt: record.workEndsAt, resultDeliveredAt: record.resultDeliveredAt }, now)) fail("CONTACT_NOT_ALLOWED");
        const contact = await tx.manualContact.create({ data: { caseId: record.id, ordinal: record.contacts.length + 1, openedAt: now } });
        await addMessage(tx, record, values.body, actor.role, actor.id, contact.id, "OPENING");
        break;
      }
      case "complete-contact": {
        requireDoctor(actor);
        const values = manualStaffSchemas["complete-contact"].parse(data);
        const contact = record.contacts.find((item) => item.id === values.contactId);
        if (!contact) fail("CONTACT_NOT_FOUND");
        if (contact.status === "ANSWERED") break;
        if (!record.messages.some((message) => message.contactId === contact.id && message.authorRole === "DOCTOR" && message.kind === "REPLY")) fail("DOCTOR_RESPONSE_REQUIRED");
        await tx.manualContact.update({ where: { id: contact.id }, data: { status: "ANSWERED", completedAt: now } });
        break;
      }
      case "complete": {
        requireDoctor(actor);
        const selection = await tx.auditEvent.findFirst({ where: { applicationId: record.applicationId, action: "service_selection_recorded" }, orderBy: { createdAt: "asc" } });
        const isOrganizational = readServiceSelectionSnapshot(selection?.metadataJson)?.kind === "organizational_selection";
        if (isOrganizational && !agreement && record.phase === "CALL_COMPLETED") {
          await tx.manualCase.update({ where: { id: record.id }, data: { phase: "COMPLETED", completedAt: now, patientAccessEndsAt: addCalendarDays(now, 30) } });
          break;
        }
        if (record.phase !== "ACTIVE" || !agreement || !record.resultDeliveredAt) fail("DELIVERED_RESULT_REQUIRED");
        if (record.contacts.some((contact) => contact.status === "OPEN")) fail("PENDING_CONTACT_RESPONSE");
        const policy = parseManualPolicy(agreement.policyJson);
        if (agreement.serviceId === "recovery-control" && record.contacts.filter((contact) => contact.status === "ANSWERED").length !== 4) fail("FOUR_COMPLETED_CONTACTS_REQUIRED");
        if (policy.packageDays && record.workEndsAt && now < record.workEndsAt) fail("PACKAGE_NOT_ENDED");
        if (policy.clarificationDays && now < (record.workEndsAt ?? addCalendarDays(record.resultDeliveredAt, policy.clarificationDays))) fail("CLARIFICATION_WINDOW_OPEN");
        await tx.manualCase.update({ where: { id: record.id }, data: { phase: "COMPLETED", completedAt: now, patientAccessEndsAt: addCalendarDays(now, 30) } });
        break;
      }
      case "extend": {
        requireDoctor(actor);
        const values = manualStaffSchemas.extend.parse(data);
        if (record.phase !== "ACTIVE" || !record.workEndsAt) fail("ACTIVE_WINDOW_REQUIRED");
        if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(values.until)) fail("EXTENSION_OFFSET_REQUIRED");
        const until = new Date(values.until);
        if (!Number.isFinite(until.getTime()) || until <= record.workEndsAt || until <= now) fail("EXTENSION_DATE_INVALID");
        await tx.manualCase.update({ where: { id: record.id }, data: { workEndsAt: until } });
        await addMessage(tx, record, `Срок продлён до ${until.toISOString()}. Основание: ${values.reason}. Дополнительные контакты автоматически не добавляются.`, "SYSTEM");
        await event(tx, record, "extension_recorded", actor.id, { priorEndsAt: record.workEndsAt.toISOString(), until: until.toISOString(), reason: values.reason });
        break;
      }
      case "reissue-access": return issueGrant(tx, record, actor.id, now);
      default: fail("MANUAL_ACTION_INVALID");
    }
    await event(tx, record, input.action.replaceAll("-", "_"), actor.id, auditDetails);
    return tx.manualCase.findUniqueOrThrow({ where: { id: record.id }, include: caseInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function patientManualAction(input: { caseId: string; grantId: string; action: string; data?: unknown }) {
  const schema = manualPatientSchemas[input.action as keyof typeof manualPatientSchemas];
  if (!schema) fail("MANUAL_ACTION_INVALID");
  const data = schema.parse(input.data ?? {});
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await checkGrant(tx, input);
    const record = await lockedCase(tx, input.caseId);
    if (["ARCHIVED", "REJECTED"].includes(record.application.status)) fail("APPLICATION_NOT_ELIGIBLE");
    let auditDetails: Record<string, unknown> = {};
    if (record.phase === "COMPLETED") fail("MANUAL_CASE_READ_ONLY");
    switch (input.action) {
      case "request-call": {
        if (!["REVIEW", "CALL_REQUESTED"].includes(record.phase)) fail("CALL_STAGE_CLOSED");
        const call = manualCallSchema.parse(data);
        const interval = parseCallInterval({ startsAt: call.startsAt!, endsAt: call.endsAt!, timezone: call.timezone! });
        auditDetails = { startsAt: interval.startsAt.toISOString(), endsAt: interval.endsAt.toISOString(), timezone: interval.timezone, priorStartsAt: record.callStartsAt?.toISOString() ?? null };
        if (interval.startsAt <= now) fail("FUTURE_CALL_REQUIRED");
        await tx.manualCase.update({ where: { id: record.id }, data: { phase: "CALL_REQUESTED", callStartsAt: interval.startsAt, callEndsAt: interval.endsAt, callTimezone: interval.timezone, callRequestedAt: now, callConfirmedAt: null } });
        break;
      }
      case "accept-agreement": {
        const values = manualPatientSchemas["accept-agreement"].parse(data);
        const agreement = record.currentAgreement;
        if (!agreement || agreement.id !== values.agreementId || agreement.supersededAt) fail("CURRENT_AGREEMENT_REQUIRED");
        if (agreement.acceptedAt) break;
        if (record.phase !== "OFFERED" || !record.callCompletedAt) fail("OFFER_NOT_READY");
        await tx.manualAgreement.update({ where: { id: agreement.id }, data: { acceptedAt: now } });
        await tx.manualCase.update({ where: { id: record.id }, data: { phase: "ACCEPTED" } });
        break;
      }
      case "open-contact": {
        const values = manualPatientSchemas["open-contact"].parse(data);
        if (!record.currentAgreement) fail("AGREEMENT_REQUIRED");
        const policy = parseManualPolicy(record.currentAgreement.policyJson);
        if (!canOpenManualContact({ phase: record.phase, policy, contactCount: record.contacts.length, hasOpenContact: record.contacts.some((contact) => contact.status === "OPEN"), workEndsAt: record.workEndsAt, resultDeliveredAt: record.resultDeliveredAt }, now)) fail("CONTACT_NOT_ALLOWED");
        const contact = await tx.manualContact.create({ data: { caseId: record.id, ordinal: record.contacts.length + 1, openedAt: now } });
        await addMessage(tx, record, values.body, "PATIENT", undefined, contact.id, "OPENING");
        break;
      }
      case "message": {
        const values = manualPatientSchemas.message.parse(data);
        if (values.contactId && record.phase !== "ACTIVE") fail("ACTIVE_CASE_REQUIRED");
        await addMessage(tx, record, values.body, "PATIENT", undefined, values.contactId);
        break;
      }
      default: fail("MANUAL_ACTION_INVALID");
    }
    await event(tx, record, input.action.replaceAll("-", "_"), undefined, auditDetails);
    return tx.manualCase.findUniqueOrThrow({ where: { id: record.id }, include: caseInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
