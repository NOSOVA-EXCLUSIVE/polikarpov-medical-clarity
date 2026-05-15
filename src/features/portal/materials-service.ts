import "server-only";

import { randomUUID } from "node:crypto";

import { getApplicationDisplayNumber } from "@/features/applications/display-number";
import { sendPatientMaterialsSubmittedStaffEmail } from "@/features/messages/notifications";
import { prisma } from "@/lib/db/prisma";
import { encryptSensitiveField } from "@/lib/security/encryption";
import { hashOpaqueToken } from "@/lib/security/tokens";
import { buildPrivateStorageKey, createPrivateUploadUrl } from "@/lib/storage/s3";
import { validateCompletedUpload, validatePresignUpload } from "@/features/questionnaire/upload-validation";
import type {
  CompleteUploadInput,
  ExternalImagingLinkInput,
  PresignUploadInput
} from "@/features/questionnaire/schemas";

function encryptOptional(value?: string) {
  return value?.trim() ? encryptSensitiveField(value.trim()) : null;
}

async function getValidMaterialsToken(rawToken: string) {
  const tokenHash = hashOpaqueToken(rawToken);

  const token = await prisma.accessToken.findFirst({
    where: {
      tokenHash,
      purpose: "MATERIALS",
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: {
      application: {
        include: {
          patient: true
        }
      },
      requirement: true
    }
  });

  if (!token || !token.requirement || token.requirement.status !== "OPEN") {
    throw new Error("Ссылка для дозагрузки недоступна или уже закрыта.");
  }

  return token;
}

export async function getMaterialsPortalContext(rawToken: string) {
  const token = await getValidMaterialsToken(rawToken);

  return {
    tokenId: token.id,
    application: {
      id: token.application.id,
      status: token.application.status,
      patientName: token.application.patient.fullName,
      chiefComplaint: token.application.chiefComplaint,
      requestedProductCode: token.application.requestedProductCode
    },
    requirement: {
      id: token.requirement.id,
      type: token.requirement.type,
      note: token.requirement.note,
      createdAt: token.requirement.createdAt,
      expiresAt: token.expiresAt
    }
  };
}

export async function createMaterialsUploadUrl(rawToken: string, input: PresignUploadInput) {
  const token = await getValidMaterialsToken(rawToken);
  const { extension } = validatePresignUpload(input);

  const storageKey = buildPrivateStorageKey([
    "portal",
    "materials",
    token.applicationId,
    input.category.toLowerCase(),
    `${Date.now()}-${randomUUID()}.${extension}`
  ]);

  const uploadUrl = await createPrivateUploadUrl({
    key: storageKey,
    contentType: input.mimeType
  });

  return {
    uploadUrl,
    storageKey,
    contentType: input.mimeType
  };
}

export async function attachMaterialsUpload(rawToken: string, input: CompleteUploadInput) {
  const token = await getValidMaterialsToken(rawToken);
  validateCompletedUpload(input);

  const upload = await prisma.applicationUpload.create({
    data: {
      applicationId: token.applicationId,
      category: input.category,
      status: "ATTACHED",
      originalName: input.originalName,
      mimeType: input.mimeType,
      extension: input.extension.toLowerCase(),
      sizeBytes: BigInt(input.sizeBytes),
      durationSeconds: input.durationSeconds,
      storageKey: input.storageKey,
      accessPasswordCiphertext: encryptOptional(input.accessPassword),
      accessInstructionsCiphertext: encryptOptional(input.accessInstructions),
      uploadedAt: new Date()
    },
    select: {
      id: true,
      originalName: true,
      category: true,
      sizeBytes: true,
      durationSeconds: true
    }
  });

  await prisma.auditEvent.create({
    data: {
      actorType: "PATIENT",
      applicationId: token.applicationId,
      entityType: "UPLOAD",
      entityId: upload.id,
      action: "materials_upload_attached",
      metadataJson: {
        requirementId: token.requirementId,
        category: input.category
      }
    }
  });

  return upload;
}

export async function addMaterialsExternalLink(
  rawToken: string,
  input: ExternalImagingLinkInput
) {
  const token = await getValidMaterialsToken(rawToken);

  const link = await prisma.applicationExternalLink.create({
    data: {
      applicationId: token.applicationId,
      kind: input.kind,
      url: input.url,
      label: input.label,
      note: input.note,
      accessPasswordCiphertext: encryptOptional(input.accessPassword),
      accessInstructionsCiphertext: encryptOptional(input.accessInstructions)
    },
    select: {
      id: true,
      kind: true,
      url: true,
      label: true,
      note: true
    }
  });

  await prisma.auditEvent.create({
    data: {
      actorType: "PATIENT",
      applicationId: token.applicationId,
      entityType: "EXTERNAL_LINK",
      entityId: link.id,
      action: "materials_external_link_added",
      metadataJson: {
        requirementId: token.requirementId,
        kind: input.kind
      }
    }
  });

  return link;
}

export async function submitMaterialsRequirement(rawToken: string) {
  const token = await getValidMaterialsToken(rawToken);
  const submittedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.applicationRequirement.update({
      where: { id: token.requirementId! },
      data: {
        status: "RESOLVED",
        resolvedAt: submittedAt
      }
    });

    await tx.accessToken.update({
      where: { id: token.id },
      data: {
        revokedAt: submittedAt
      }
    });

    if (
      token.application.status === "NEEDS_UPLOAD" ||
      token.application.status === "NEEDS_IMAGING_ACCESS"
    ) {
      await tx.application.update({
        where: { id: token.applicationId },
        data: {
          status: "UNDER_REVIEW",
          reviewStartedAt: submittedAt
        }
      });

      await tx.auditEvent.create({
        data: {
          actorType: "PATIENT",
          applicationId: token.applicationId,
          entityType: "APPLICATION",
          entityId: token.applicationId,
          action: "status_changed",
          metadataJson: {
            from: token.application.status,
            to: "UNDER_REVIEW"
          }
        }
      });
    }

    await tx.auditEvent.create({
      data: {
        actorType: "PATIENT",
        applicationId: token.applicationId,
        entityType: "REQUIREMENT",
        entityId: token.requirementId!,
        action: "requirement_resolved"
      }
    });
  });

  const [filesCount, linksCount, application] = await Promise.all([
    prisma.applicationUpload.count({
      where: {
        applicationId: token.applicationId,
        uploadedAt: { gte: token.requirement.createdAt }
      }
    }),
    prisma.applicationExternalLink.count({
      where: {
        applicationId: token.applicationId,
        createdAt: { gte: token.requirement.createdAt }
      }
    }),
    prisma.application.findUnique({
      where: { id: token.applicationId },
      select: {
        id: true,
        submittedAt: true,
        patient: {
          select: {
            fullName: true
          }
        }
      }
    })
  ]);

  if (!application) {
    throw new Error("Заявка не найдена после отправки материалов.");
  }

  const applicationDisplayNumber =
    (await getApplicationDisplayNumber({
      applicationId: application.id,
      submittedAt: application.submittedAt
    })) ?? application.id;

  await prisma.auditEvent.create({
    data: {
      actorType: "PATIENT",
      applicationId: token.applicationId,
      entityType: "APPLICATION",
      entityId: token.applicationId,
      action: "patient_materials_submitted",
      metadataJson: {
        requirementId: token.requirementId,
        filesCount,
        linksCount,
        submittedAt: submittedAt.toISOString()
      }
    }
  });

  const emailDelivery = await sendPatientMaterialsSubmittedStaffEmail({
    applicationId: token.applicationId,
    applicationDisplayNumber,
    patientName: application.patient.fullName,
    filesCount,
    linksCount,
    submittedAt
  });

  await prisma.auditEvent.create({
    data: {
      actorType: "SYSTEM",
      applicationId: token.applicationId,
      entityType: "APPLICATION",
      entityId: token.applicationId,
      action:
        emailDelivery.status === "sent"
          ? "patient_materials_staff_email_sent"
          : "patient_materials_staff_email_failed",
      metadataJson: {
        requirementId: token.requirementId,
        filesCount,
        linksCount,
        provider: emailDelivery.provider,
        manualFallbackRequired: emailDelivery.manualFallbackRequired,
        errorMessage:
          emailDelivery.status === "failed" ? emailDelivery.errorMessage ?? null : null
      }
    }
  });

  return {
    ok: true,
    filesCount,
    linksCount,
    emailDelivery
  };
}
