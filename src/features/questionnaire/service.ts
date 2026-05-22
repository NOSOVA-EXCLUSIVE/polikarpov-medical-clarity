import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { LEGAL_DOCUMENT_VERSIONS } from "@/features/legal/versions";
import {
  getApplicationDisplayNumber,
  getFallbackApplicationDisplayNumber
} from "@/features/applications/display-number";
import { saveQuestionnaireSubmissionFallback } from "@/features/questionnaire/fallback-store";
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
  return process.env.NODE_ENV !== "production";
}

export async function submitQuestionnaire(
  input: QuestionnaireSubmitInput,
  requestMeta: { ip?: string | null; userAgent?: string | null }
) {
  validateQuestionnaireUploads(input.uploads);

  const submittedAt = new Date();
  const imagingSourceType = classifyImagingSourceType({
    uploads: input.uploads,
    externalLinks: input.externalLinks
  });
  const requestedProductCode =
    input.requestedProductCode === "NOT_SURE" ? null : input.requestedProductCode;
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

      const workflowHooks = buildQuestionnaireWorkflowHooks({
        submissionId: application.id,
        submittedAt,
        preferredContact: input.patient.preferredContact,
        requestedProductCode: input.requestedProductCode
      });

      await tx.auditEvent.createMany({
        data: [
          {
            actorType: "PATIENT",
            applicationId: application.id,
            entityType: "APPLICATION",
            entityId: application.id,
            action: "application_submitted",
            metadataJson: {
              requestedProductCode,
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
    if (!canUseLocalQuestionnaireFilesystem()) {
      throw error;
    }

    result = await saveQuestionnaireSubmissionFallback(input, requestMeta);
  }

  const workflowHooks =
    result.workflowHooks ??
    buildQuestionnaireWorkflowHooks({
      submissionId: result.applicationId,
      submittedAt,
      preferredContact: input.patient.preferredContact,
      requestedProductCode: input.requestedProductCode
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

  const displayNumber =
    (await getApplicationDisplayNumber({
      applicationId: result.applicationId,
      submittedAt
    })) ?? getFallbackApplicationDisplayNumber(submittedAt);

  const staffNotification = await sendQuestionnaireSubmittedStaffEmail({
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
    useQueueLink: Boolean(result.storagePath)
  });

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
            : "questionnaire_staff_email_failed",
        metadataJson: {
          provider: staffNotification.provider,
          manualFallbackRequired: staffNotification.manualFallbackRequired,
          errorMessage:
            staffNotification.status === "failed"
              ? staffNotification.errorMessage ?? null
              : null
        }
      }
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
