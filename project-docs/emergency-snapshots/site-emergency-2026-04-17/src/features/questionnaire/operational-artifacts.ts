import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const QUESTIONNAIRE_OPERATIONS_ROOT = path.join(
  process.cwd(),
  "storage",
  "questionnaire-operations"
);

type PersistOperationalArtifactsInput = {
  submissionId: string;
  submittedAt: Date;
  workflowHooks: Record<string, unknown>;
  questionnaireSnapshot: Record<string, unknown>;
};

async function writeJsonArtifact(
  rootPath: string,
  submittedAt: Date,
  submissionId: string,
  payload: Record<string, unknown>
) {
  const folderPath = path.join(rootPath, submittedAt.toISOString().slice(0, 10));
  const filePath = path.join(folderPath, `${submissionId}.json`);

  await mkdir(folderPath, { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");

  return filePath;
}

export async function persistQuestionnaireOperationalArtifacts(
  input: PersistOperationalArtifactsInput
) {
  const commonMeta = {
    submissionId: input.submissionId,
    submittedAt: input.submittedAt.toISOString()
  };

  const doctorNotificationPath = await writeJsonArtifact(
    path.join(QUESTIONNAIRE_OPERATIONS_ROOT, "doctor-notifications"),
    input.submittedAt,
    input.submissionId,
    {
      ...commonMeta,
      notification: input.workflowHooks.doctorNotification,
      snapshot: {
        patient: input.questionnaireSnapshot.patient,
        requestedProductCode: input.questionnaireSnapshot.requestedProductCode
      }
    }
  );

  const reviewQueuePath = await writeJsonArtifact(
    path.join(QUESTIONNAIRE_OPERATIONS_ROOT, "review-queue"),
    input.submittedAt,
    input.submissionId,
    {
      ...commonMeta,
      queueItem: input.workflowHooks.reviewQueue,
      snapshot: {
        patient: input.questionnaireSnapshot.patient,
        caseDetails: input.questionnaireSnapshot.caseDetails
      }
    }
  );

  const communicationPath = await writeJsonArtifact(
    path.join(QUESTIONNAIRE_OPERATIONS_ROOT, "communication"),
    input.submittedAt,
    input.submissionId,
    {
      ...commonMeta,
      communication: input.workflowHooks.communication
    }
  );

  const paymentPreparationPath = await writeJsonArtifact(
    path.join(QUESTIONNAIRE_OPERATIONS_ROOT, "payment-preparation"),
    input.submittedAt,
    input.submissionId,
    {
      ...commonMeta,
      paymentPreparation: input.workflowHooks.paymentPreparation
    }
  );

  return {
    doctorNotificationPath,
    reviewQueuePath,
    communicationPath,
    paymentPreparationPath
  };
}
