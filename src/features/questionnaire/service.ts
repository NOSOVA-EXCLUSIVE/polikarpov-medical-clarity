import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { LEGAL_DOCUMENT_VERSIONS } from "@/features/legal/versions";
import {
  getApplicationDisplayNumber
} from "@/features/applications/display-number";
import {
  assertIntakeUploadOwnership,
  IntakeConsentRequiredError,
  type IntakeConsentReceipt
} from "@/features/questionnaire/intake-consent";
import { buildServiceSelectionSnapshot, resolveRequestedProductCode } from "@/features/questionnaire/service-selection";
import { isPreviewIsolationRequired } from "@/lib/preview/guard";
import {
  QUESTIONNAIRE_LEAD_STATUS,
  QUESTIONNAIRE_MESSAGE_TEMPLATES,
  buildQuestionnaireSnapshot,
  buildQuestionnaireWorkflowHooks
} from "@/features/questionnaire/lead-flow";
import { persistQuestionnaireOperationalArtifacts } from "@/features/questionnaire/operational-artifacts";
import type { QuestionnaireSubmitInput } from "@/features/questionnaire/schemas";
import {
  classifyImagingSourceType,
  requiresImagingAccess
} from "@/features/questionnaire/status";
import { validateQuestionnaireUploads } from "@/features/questionnaire/upload-validation";
import { prisma } from "@/lib/db/prisma";
import { sendQuestionnaireSubmittedStaffEmail } from "@/features/messages/notifications";
import { encryptSensitiveField } from "@/lib/security/encryption";

function getTokenHashSecret() {
  return process.env.TOKEN_HASH_SECRET?.trim() || "local-questionnaire-token-secret";
}

function hashRequestValue(value?: string | null) {
  if (!value) {
    return null;
  }

  return createHash("sha256")
    .update(`${getTokenHashSecret()}:${value}`, "utf8")
    .digest("hex");
}

function encryptOptional(value?: string | null) {
  return value ? encryptSensitiveField(value) : null;
}

export function buildQuestionnaireUploadStorageKey(input: {
  category: "DOCUMENT" | "IMAGE" | "VIDEO";
  extension: string;
}) {
  return [
    "intake",
    "incoming",
    input.category.toLowerCase(),
    `${Date.now()}-${randomUUID()}.${input.extension.toLowerCase()}`
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
}

type WorkflowHooks = ReturnType<typeof buildQuestionnaireWorkflowHooks>;

type SubmissionResult = {
  applicationId: string;
  patientId: string;
  preferredContact: string;
  storagePath?: string;
  workflowHooks?: WorkflowHooks;
};

function canUseLocalQuestionnaireFilesystem() {
  return process.env.NODE_ENV !== "production" && !isPreviewIsolationRequired();
}

export async function submitQuestionnaire(
  input: QuestionnaireSubmitInput,
  requestMeta: { ip?: string | null; userAgent?: string | null; intakeConsent: IntakeConsentReceipt }
) {
  validateQuestionnaireUploads(input.uploads);
  if (!requestMeta.intakeConsent) throw new IntakeConsentRequiredError();
  for (const upload of input.uploads) {
    assertIntakeUploadOwnership(upload.storageKey, requestMeta.intakeConsent.receiptId);
  }

  const submittedAt = new Date();
  const imagingSourceType = classifyImagingSourceType({
    uploads: input.uploads,
    externalLinks: input.externalLinks
  });
  const requestedProductCode = resolveRequestedProductCode(input);
  const serviceSelection = buildServiceSelectionSnapshot(input.selectedServiceId);
  const questionnaireSnapshot = buildQuestionnaireSnapshot(input);
  const reviewRequirements = {
    hasMaterials: input.uploads.length > 0 || input.externalLinks.length > 0,
    requiresImagingAccess: requiresImagingAccess({
      uploads: input.uploads,
      externalLinks: input.externalLinks
    })
  };
  const registeredTemplateKeys = Object.keys(QUESTIONNAIRE_MESSAGE_TEMPLATES);

  let result: SubmissionResult;

  try {
    result = await prisma.$transaction(async (tx) => {
      const existingPatient = await tx.patient.findFirst({
        where: {
          email: input.patient.email,
          phone: input.patient.phone
        }
      });

      const patient = existingPatient
        ? await tx.patient.update({
            where: {
              id: existingPatient.id
            },
            data: {
              fullName: input.patient.fullName,
              preferredContact: input.patient.preferredContact,
              country: input.patient.country,
              city: input.patient.city,
              timezone: input.patient.timezone
            }
          })
        : await tx.patient.create({
            data: {
              fullName: input.patient.fullName,
              email: input.patient.email,
              phone: input.patient.phone,
              preferredContact: input.patient.preferredContact,
              country: input.patient.country,
              city: input.patient.city,
              timezone: input.patient.timezone
            }
          });

      const application = await tx.application.create({
        data: {
          patientId: patient.id,
          requestedProductCode,
          status: "NEW",
          imagingSourceType,
          chiefComplaint: input.caseDetails.chiefComplaint,
          bodyArea: input.caseDetails.bodyArea,
          symptomTimeline: input.caseDetails.symptomTimeline,
          traumaHistory: input.caseDetails.traumaHistory,
          surgeryHistory: input.caseDetails.surgeryHistory,
          priorDiagnoses: input.caseDetails.priorDiagnoses,
          priorSpecialists: input.caseDetails.priorSpecialists,
          currentTreatment: input.caseDetails.currentTreatment,
          goalOfConsultation: input.caseDetails.goalOfConsultation,
          reviewNoteForDoctor: input.caseDetails.reviewNoteForDoctor,
          submittedAt,
          redFlags: {
            create: {
              ...input.redFlags,
              isBlocked: false
            }
          },
          legalAcceptance: {
            create: {
              offerVersion: LEGAL_DOCUMENT_VERSIONS.offer,
              privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
              consentVersion: LEGAL_DOCUMENT_VERSIONS.consent,
              ipHash: hashRequestValue(requestMeta.ip),
              userAgentHash: hashRequestValue(requestMeta.userAgent)
            }
          },
          uploads: {
            create: input.uploads.map((upload) => ({
              category: upload.category,
              status: "ATTACHED",
              originalName: upload.originalName,
              mimeType: upload.mimeType,
              extension: upload.extension.toLowerCase(),
              sizeBytes: BigInt(upload.sizeBytes),
              durationSeconds: upload.durationSeconds,
              storageKey: upload.storageKey,
              accessPasswordCiphertext: encryptOptional(upload.accessPassword),
              accessInstructionsCiphertext: encryptOptional(
                upload.accessInstructions
              ),
              uploadedAt: submittedAt
            }))
          },
          externalLinks: {
            create: input.externalLinks.map((link) => ({
              kind: link.kind,
              url: link.url,
              label: link.label,
              note: link.note,
              accessPasswordCiphertext: encryptOptional(link.accessPassword),
              accessInstructionsCiphertext: encryptOptional(
                link.accessInstructions
              )
            }))
          }
        }
      });

      // Consume the durable receipt in the SAME transaction as the application.
      // A replay or concurrent submit rolls the whole application back.
      const linkedConsent = await tx.auditEvent.updateMany({
        where: {
          id: requestMeta.intakeConsent.receiptId,
          entityId: requestMeta.intakeConsent.receiptId,
          actorType: "PATIENT",
          entityType: "TOKEN",
          action: "intake_data_consent_accepted",
          applicationId: null
        },
        data: { applicationId: application.id }
      });
      if (linkedConsent.count !== 1) throw new IntakeConsentRequiredError();

      const workflowHooks = buildQuestionnaireWorkflowHooks({
        submissionId: application.id,
        submittedAt,
        preferredContact: input.patient.preferredContact,
        requestedProductCode: input.requestedProductCode,
        selectedServiceId: input.selectedServiceId
      });

      await tx.auditEvent.createMany({
        data: [
          {
            actorType: "PATIENT",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "intake_data_consent_linked",
            metadataJson: {
              receiptId: requestMeta.intakeConsent.receiptId,
              acceptedAt: requestMeta.intakeConsent.acceptedAt,
              textVersion: requestMeta.intakeConsent.textVersion
            }
          },
          ...(serviceSelection ? [{
            actorType: "SYSTEM" as const,
            applicationId: application.id,
            entityType: "APPLICATION" as const,
            entityId: application.id,
            action: "service_selection_recorded",
            metadataJson: serviceSelection
          }] : []),
          {
            actorType: "PATIENT",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "application_submitted",
            metadataJson: {
              requestedProductCode,
              selectedServiceId: serviceSelection?.id ?? null,
              imagingSourceType,
              uploadCount: input.uploads.length,
              externalLinkCount: input.externalLinks.length,
              leadStatusLabel: QUESTIONNAIRE_LEAD_STATUS.label
            }
          },
          {
            actorType: "SYSTEM",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "lead_status_assigned",
            metadataJson: {
              status: QUESTIONNAIRE_LEAD_STATUS.code,
              statusLabel: QUESTIONNAIRE_LEAD_STATUS.label
            }
          },
          {
            actorType: "SYSTEM",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "questionnaire_snapshot_saved",
            metadataJson: questionnaireSnapshot
          },
          {
            actorType: "SYSTEM",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "queued_for_review",
            metadataJson: {
              queue: "doctor-review",
              reviewRequirements
            }
          },
          {
            actorType: "SYSTEM",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "legal_acceptance_recorded",
            metadataJson: {
              acceptedOffer: input.legal.acceptedOffer,
              acceptedPrivacy: input.legal.acceptedPrivacy,
              acceptedMedicalData: input.legal.acceptedMedicalData,
              acceptedConsent: input.legal.acceptedConsent,
              confirmedInformationAccuracy:
                input.legal.confirmedInformationAccuracy,
              offerVersion: LEGAL_DOCUMENT_VERSIONS.offer,
              privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
              consentVersion: LEGAL_DOCUMENT_VERSIONS.consent
            }
          },
          {
            actorType: "SYSTEM",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "doctor_notification_prepared",
            metadataJson: workflowHooks.doctorNotification
          },
          {
            actorType: "SYSTEM",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "review_queue_item_created",
            metadataJson: workflowHooks.reviewQueue
          },
          {
            actorType: "SYSTEM",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "communication_schedule_created",
            metadataJson: workflowHooks.communication
          },
          {
            actorType: "SYSTEM",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "payment_preparation_initialized",
            metadataJson: workflowHooks.paymentPreparation
          },
          {
            actorType: "SYSTEM",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "workflow_hooks_prepared",
            metadataJson: workflowHooks
          },
          {
            actorType: "SYSTEM",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "communication_templates_registered",
            metadataJson: {
              templateKeys: registeredTemplateKeys,
              contentStatus: "operational_draft",
              deliveryMode: "manual_or_staff_triggered"
            }
          }
        ]
      });

      return {
        applicationId: application.id,
        patientId: patient.id,
        preferredContact: patient.preferredContact,
        workflowHooks
      };
    });
  } catch (error) {
    // An accepted consent receipt and its application must stay durable and atomic.
    // Never return a filesystem "success" after a DB failure (including receipt replay).
    throw error;
  }

  const workflowHooks =
    result.workflowHooks ??
    buildQuestionnaireWorkflowHooks({
      submissionId: result.applicationId,
      submittedAt,
      preferredContact: input.patient.preferredContact,
      requestedProductCode: input.requestedProductCode,
      selectedServiceId: input.selectedServiceId
    });

  let operationalArtifacts: Awaited<
    ReturnType<typeof persistQuestionnaireOperationalArtifacts>
  > | null = null;

  if (canUseLocalQuestionnaireFilesystem()) {
    try {
      operationalArtifacts = await persistQuestionnaireOperationalArtifacts({
        submissionId: result.applicationId,
        submittedAt,
        workflowHooks,
        questionnaireSnapshot
      });
    } catch {
      operationalArtifacts = null;
    }
  }

  // The transaction already committed. Auxiliary lookups and notifications must
  // never turn a durable application into an apparent failed submission.
  // The saved application ID is a stable, unique support reference if numbering
  // is temporarily unavailable; do not invent the same daily fallback for everyone.
  let displayNumber = `PMC-${result.applicationId}`;
  try {
    displayNumber = (await getApplicationDisplayNumber({
      applicationId: result.applicationId,
      submittedAt
    })) ?? displayNumber;
  } catch {
    // The application is already available to staff through its saved ID.
  }

  let staffNotification: Awaited<ReturnType<typeof sendQuestionnaireSubmittedStaffEmail>>;
  try {
    staffNotification = await sendQuestionnaireSubmittedStaffEmail({
      applicationId: result.applicationId,
      applicationDisplayNumber: displayNumber,
      patientName: input.patient.fullName,
      patientEmail: input.patient.email,
      patientPhone: input.patient.phone,
      preferredContact: input.patient.preferredContact,
      city: input.patient.city,
      country: input.patient.country,
      timezone: input.patient.timezone,
      requestedProductCode,
      serviceSelection,
      useQueueLink: Boolean(result.storagePath)
    });
  } catch {
    staffNotification = {
      status: "failed",
      manualFallbackRequired: true,
      provider: isPreviewIsolationRequired() ? "capture" : "postmark",
      errorMessage: "Notification delivery could not be confirmed."
    };
  }

  if (!result.storagePath) {
    await prisma.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        applicationId: result.applicationId,
        entityType: "APPLICATION",
        entityId: result.applicationId,
        action:
          staffNotification.status === "sent"
            ? "questionnaire_staff_email_sent"
            : staffNotification.status === "captured"
              ? "questionnaire_staff_email_captured"
              : "questionnaire_staff_email_failed",
        metadataJson: {
          provider: staffNotification.provider,
          captureId: staffNotification.captureId ?? null,
          manualFallbackRequired: staffNotification.manualFallbackRequired,
          errorMessage:
            staffNotification.status === "failed"
              ? staffNotification.errorMessage ?? null
              : null
        }
      }
    }).catch(() => {
      // Do not ask the patient to resubmit an application already committed.
      console.warn("Questionnaire saved; notification audit temporarily unavailable.");
    });
  }

  return {
    ...result,
    submissionId: result.applicationId,
    displayNumber,
    status: QUESTIONNAIRE_LEAD_STATUS.code,
    statusLabel: QUESTIONNAIRE_LEAD_STATUS.label,
    imagingSourceType,
    workflowHooks,
    operationalArtifacts
  };
}
