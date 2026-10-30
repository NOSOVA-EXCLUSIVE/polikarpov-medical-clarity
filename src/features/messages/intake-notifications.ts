import "server-only";

import { prisma } from "@/lib/db/prisma";
import { isPreviewIsolationRequired } from "@/lib/preview/guard";
import {
  sendIntakeReceivedPatientEmail,
  sendQuestionnaireSubmittedStaffEmail,
  type NotificationDeliveryResult
} from "@/features/messages/notifications";

type SkippedPatientNotification = {
  status: "skipped";
  reason: "NO_PATIENT_EMAIL";
  manualFallbackRequired: false;
};

type DeliveryOutcome = NotificationDeliveryResult | SkippedPatientNotification;
type IntakeNotificationInput = {
  kind: "questionnaire" | "organizational";
  staff: Parameters<typeof sendQuestionnaireSubmittedStaffEmail>[0];
  recordAudit?: boolean;
};

function failedDelivery(): NotificationDeliveryResult {
  return {
    status: "failed",
    provider: isPreviewIsolationRequired() ? "capture" : "postmark",
    manualFallbackRequired: true,
    errorMessage: "Notification delivery could not be confirmed."
  };
}

async function attempt(send: () => Promise<NotificationDeliveryResult>): Promise<NotificationDeliveryResult> {
  try {
    const result = await send();
    if (result?.status === "sent" && result.provider === "postmark" && result.manualFallbackRequired === false) {
      return { status: "sent", provider: "postmark", manualFallbackRequired: false };
    }
    if (result?.status === "captured" && result.provider === "capture" && result.captureId?.trim() && result.manualFallbackRequired === false) {
      return { status: "captured", provider: "capture", captureId: result.captureId, manualFallbackRequired: false };
    }
  } catch {
    // Provider and configuration failures must not escape a saved submission.
  }
  return failedDelivery();
}

async function recordOutcome(input: IntakeNotificationInput, recipient: "staff" | "patient", outcome: DeliveryOutcome) {
  if (input.recordAudit === false) return;
  const action = input.kind === "organizational"
    ? `organizational_${recipient}_notification`
    : `questionnaire_${recipient}_email_${outcome.status}`;
  try {
    await prisma.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        applicationId: input.staff.applicationId,
        entityType: "APPLICATION",
        entityId: input.staff.applicationId,
        action,
        metadataJson: outcome.status === "skipped"
          ? { status: outcome.status, reason: outcome.reason, manualFallbackRequired: false }
          : {
              status: outcome.status,
              provider: outcome.provider,
              captureId: outcome.captureId ?? null,
              manualFallbackRequired: outcome.manualFallbackRequired,
              errorMessage: outcome.status === "failed" ? outcome.errorMessage ?? null : null
            }
      }
    });
  } catch {
    // A failed audit write must neither suppress another email nor undo intake.
    console.warn("Intake notification audit temporarily unavailable.");
  }
}

/** Call only after the application transaction has committed. No retries or access grants. */
export async function notifyIntakeReceived(input: IntakeNotificationInput) {
  const staffTask = async () => {
    const outcome = await attempt(() => sendQuestionnaireSubmittedStaffEmail(input.staff));
    await recordOutcome(input, "staff", outcome);
    return outcome;
  };
  const patientTask = async (): Promise<DeliveryOutcome> => {
    const email = input.staff.patientEmail?.trim();
    const outcome: DeliveryOutcome = email
      ? await attempt(() => sendIntakeReceivedPatientEmail({
          patientEmail: email,
          applicationDisplayNumber: input.staff.applicationDisplayNumber
        }))
      : { status: "skipped", reason: "NO_PATIENT_EMAIL", manualFallbackRequired: false };
    await recordOutcome(input, "patient", outcome);
    return outcome;
  };

  const [staff, patient] = await Promise.all([staffTask(), patientTask()]);
  return { staff, patient };
}
