import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

import { getApplicationDisplayNumber } from "@/features/applications/display-number";
import { sendPatientMaterialsSubmittedStaffEmail } from "@/features/messages/notifications";
import { prisma } from "@/lib/db/prisma";
import { encryptSensitiveField } from "@/lib/security/encryption";
import { hashOpaqueToken } from "@/lib/security/tokens";
import { buildPrivateStorageKey, createPrivateUploadUrl, getPrivateObjectMetadata } from "@/lib/storage/s3";
import { validateCompletedUpload, validatePresignUpload } from "@/features/questionnaire/upload-validation";
import type {
  CompleteUploadInput,
  ExternalImagingLinkInput,
  PresignUploadInput
} from "@/features/questionnaire/schemas";
import {
  assertMaterialsUploadTicket,
  createMaterialsUploadDescriptorHmac,
  getMaterialsUploadTicketId,
  type MaterialsUploadScope
} from "./materials-upload-binding";

const MATERIALS_UPLOAD_URL_TTL_SECONDS = 900;

const materialsUploadSelection = {
  id: true,
  originalName: true,
  category: true,
  sizeBytes: true,
  durationSeconds: true
} as const;

function encryptOptional(value?: string) {
  return value?.trim() ? encryptSensitiveField(value.trim()) : null;
}

async function getValidMaterialsToken(
  rawToken: string,
  db: Pick<typeof prisma, "accessToken"> = prisma
) {
  const tokenHash = hashOpaqueToken(rawToken);

  const token = await db.accessToken.findFirst({
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

  if (
    !token ||
    !token.requirement ||
    token.requirement.status !== "OPEN" ||
    token.requirement.applicationId !== token.applicationId
  ) {
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
  const ticketId = randomUUID();
  const scope: MaterialsUploadScope = {
    applicationId: token.applicationId,
    requirementId: token.requirement.id,
    tokenId: token.id
  };

  const storageKey = buildPrivateStorageKey([
    "portal",
    "materials",
    token.applicationId,
    token.requirement.id,
    token.id,
    input.category.toLowerCase(),
    `${ticketId}.${extension}`
  ]);

  const preparedAt = new Date();
  const descriptor: CompleteUploadInput = {
    category: input.category,
    originalName: input.filename,
    mimeType: input.mimeType,
    extension,
    sizeBytes: input.sizeBytes,
    durationSeconds: input.durationSeconds,
    storageKey
  };

  // A failed signing call leaves only an inert ticket, never a visible upload or deleted object.
  await prisma.auditEvent.create({
    data: {
      id: ticketId,
      actorType: "PATIENT",
      applicationId: token.applicationId,
      entityType: "UPLOAD",
      entityId: ticketId,
      action: "materials_upload_prepared",
      metadataJson: {
        version: 1,
        requirementId: token.requirement.id,
        tokenId: token.id,
        category: input.category,
        descriptorHmac: createMaterialsUploadDescriptorHmac(rawToken, scope, descriptor),
        expiresAt: token.expiresAt.toISOString(),
        preparedAt: preparedAt.toISOString(),
        uploadUrlTtlSeconds: MATERIALS_UPLOAD_URL_TTL_SECONDS
      }
    }
  });

  const uploadUrl = await createPrivateUploadUrl({
    key: storageKey,
    contentType: input.mimeType,
    maximumSizeInBytes: input.sizeBytes,
    expiresInSeconds: MATERIALS_UPLOAD_URL_TTL_SECONDS
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
  const scope: MaterialsUploadScope = {
    applicationId: token.applicationId,
    requirementId: token.requirement.id,
    tokenId: token.id
  };
  const ticketId = getMaterialsUploadTicketId(scope, input);
  const ticket = await prisma.auditEvent.findFirst({
    where: {
      id: ticketId,
      applicationId: token.applicationId,
      entityType: "UPLOAD",
      entityId: ticketId,
      action: "materials_upload_prepared"
    },
    select: { metadataJson: true }
  });
  assertMaterialsUploadTicket({
    rawToken,
    scope,
    upload: input,
    metadata: ticket?.metadataJson,
    now: new Date()
  });

  // No client-supplied key reaches object storage before authorization and the prepared ticket.
  let metadata: Awaited<ReturnType<typeof getPrivateObjectMetadata>>;
  try {
    metadata = await getPrivateObjectMetadata(input.storageKey);
  } catch {
    // Provider errors can contain private storage details; return only the flow's generic error.
    throw new Error("Не удалось подтвердить загруженный файл в защищённом хранилище.");
  }
  // The local development adapter persists bytes only; Blob/S3 must provide their real MIME.
  if (
    metadata.sizeBytes !== input.sizeBytes ||
    (metadata.contentType !== null && metadata.contentType !== input.mimeType)
  ) {
    throw new Error("Размер или тип файла не совпадает с подготовленной загрузкой.");
  }

  return prisma.$transaction(async (tx) => {
    // Match the requirement -> token lock order used by submission. These row locks do not
    // alter either record, and prevent closing/revoking access during final attachment.
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "ApplicationRequirement"
      WHERE "id" = ${scope.requirementId} AND "applicationId" = ${scope.applicationId}
      FOR UPDATE
    `);
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "AccessToken"
      WHERE "id" = ${scope.tokenId} AND "applicationId" = ${scope.applicationId}
        AND "requirementId" = ${scope.requirementId}
      FOR UPDATE
    `);

    const currentToken = await getValidMaterialsToken(rawToken, tx);
    if (
      currentToken.id !== scope.tokenId ||
      currentToken.applicationId !== scope.applicationId ||
      currentToken.requirement.id !== scope.requirementId
    ) {
      throw new Error("Подготовленная загрузка не найдена или недоступна.");
    }
    assertMaterialsUploadTicket({
      rawToken,
      scope,
      upload: input,
      metadata: ticket?.metadataJson,
      now: new Date()
    });

    const existing = await tx.applicationUpload.findUnique({
      where: { storageKey: input.storageKey }
    });
    if (existing) {
      if (
        existing.applicationId !== scope.applicationId ||
        existing.status !== "ATTACHED" ||
        existing.category !== input.category ||
        existing.originalName !== input.originalName ||
        existing.mimeType !== input.mimeType ||
        existing.extension !== input.extension.toLowerCase() ||
        existing.sizeBytes !== BigInt(input.sizeBytes) ||
        existing.durationSeconds !== (input.durationSeconds ?? null)
      ) {
        throw new Error("Подготовленная загрузка уже использована или изменилась.");
      }
      return {
        id: existing.id,
        originalName: existing.originalName,
        category: existing.category,
        sizeBytes: existing.sizeBytes,
        durationSeconds: existing.durationSeconds
      };
    }

    const upload = await tx.applicationUpload.create({
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
      select: materialsUploadSelection
    });

    await tx.auditEvent.create({
      data: {
        actorType: "PATIENT",
        applicationId: token.applicationId,
        entityType: "UPLOAD",
        entityId: upload.id,
        action: "materials_upload_attached",
        metadataJson: {
          requirementId: token.requirementId,
          category: input.category,
          preparedTicketId: ticketId
        }
      }
    });

    return upload;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
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
          : emailDelivery.status === "captured"
            ? "patient_materials_staff_email_captured"
            : "patient_materials_staff_email_failed",
      metadataJson: {
        requirementId: token.requirementId,
        filesCount,
        linksCount,
        provider: emailDelivery.provider,
        captureId: emailDelivery.captureId ?? null,
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
