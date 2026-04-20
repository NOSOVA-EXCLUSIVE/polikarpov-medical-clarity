import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  QUESTIONNAIRE_LEAD_STATUS,
  QUESTIONNAIRE_MESSAGE_TEMPLATES,
  buildQuestionnaireSnapshot,
  buildQuestionnaireWorkflowHooks
} from "@/features/questionnaire/lead-flow";
import type { QuestionnaireSubmitInput } from "@/features/questionnaire/schemas";
import {
  classifyImagingSourceType,
  requiresImagingAccess
} from "@/features/questionnaire/status";
import { encryptSensitiveField } from "@/lib/security/encryption";

const FALLBACK_STORAGE_ROOT = path.join(
  process.cwd(),
  "storage",
  "questionnaire-submissions"
);

function encryptOptional(value?: string | null) {
  return value ? encryptSensitiveField(value) : null;
}

export async function saveQuestionnaireSubmissionFallback(
  input: QuestionnaireSubmitInput,
  requestMeta: { ip?: string | null; userAgent?: string | null }
) {
  const requestedProductCode =
    input.requestedProductCode === "NOT_SURE" ? null : input.requestedProductCode;
  const imagingSourceType = classifyImagingSourceType({
    uploads: input.uploads,
    externalLinks: input.externalLinks
  });
  const questionnaireSnapshot = buildQuestionnaireSnapshot(input);
  const submittedAt = new Date();
  const submissionId = `local-${submittedAt.getTime()}-${randomUUID().slice(0, 8)}`;
  const workflowHooks = buildQuestionnaireWorkflowHooks({
    submissionId,
    submittedAt,
    preferredContact: input.patient.preferredContact,
    requestedProductCode: input.requestedProductCode
  });
  const folderPath = path.join(
    FALLBACK_STORAGE_ROOT,
    submittedAt.toISOString().slice(0, 10)
  );
  const filePath = path.join(folderPath, `${submissionId}.json`);

  await mkdir(folderPath, { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(
      {
        submissionId,
        status: QUESTIONNAIRE_LEAD_STATUS.code,
        statusLabel: QUESTIONNAIRE_LEAD_STATUS.label,
        submittedAt: submittedAt.toISOString(),
        persistence: "filesystem",
        requestedProductCode,
        preferredContact: input.patient.preferredContact,
        imagingSourceType,
        requestMeta: {
          ip: requestMeta.ip ?? null,
          userAgent: requestMeta.userAgent ?? null
        },
        reviewRequirements: {
          hasMaterials: input.uploads.length > 0 || input.externalLinks.length > 0,
          requiresImagingAccess: requiresImagingAccess({
            uploads: input.uploads,
            externalLinks: input.externalLinks
          })
        },
        questionnaireSnapshot,
        secureAccess: {
          uploads: input.uploads.map((upload) => ({
            originalName: upload.originalName,
            storageKey: upload.storageKey,
            accessPasswordCiphertext: encryptOptional(upload.accessPassword),
            accessInstructionsCiphertext: encryptOptional(
              upload.accessInstructions
            )
          })),
          externalLinks: input.externalLinks.map((link) => ({
            url: link.url,
            accessPasswordCiphertext: encryptOptional(link.accessPassword),
            accessInstructionsCiphertext: encryptOptional(
              link.accessInstructions
            )
          }))
        },
        workflowHooks,
        communicationTemplates: QUESTIONNAIRE_MESSAGE_TEMPLATES
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    applicationId: submissionId,
    patientId: `patient-${submissionId}`,
    preferredContact: input.patient.preferredContact,
    storagePath: filePath,
    workflowHooks
  };
}
