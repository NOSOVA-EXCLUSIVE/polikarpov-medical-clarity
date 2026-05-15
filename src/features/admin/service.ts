import "server-only";

import type {
  ApplicationStatus,
  ChargeModel,
  Prisma,
  ProductCode,
  RequirementType,
  UserRole
} from "@prisma/client";

import {
  attachApplicationDisplayNumbers,
  getApplicationDisplayNumber
} from "@/features/applications/display-number";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env/server";
import {
  sendMaterialsRequestEmail,
  sendOfferCreatedEmail,
  sendApplicationRejectedPatientEmail,
  sendApplicationRejectedStaffEmail
} from "@/features/messages/notifications";
import { syncThreadLifecycle } from "@/features/messages/service";
import { decryptSensitiveField } from "@/lib/security/encryption";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/security/tokens";

type StaffActor = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

type ApplicationFilters = {
  status?: ApplicationStatus | "ALL";
  productCode?: ProductCode | "ALL";
  query?: string;
};

const PRE_REVIEW_STATUSES: ApplicationStatus[] = [
  "NEW",
  "UNDER_REVIEW",
  "NEEDS_UPLOAD",
  "NEEDS_IMAGING_ACCESS"
];

type ManualBookingAudit = {
  action: string;
  createdAt: Date;
  metadataJson?: Prisma.JsonValue | null;
};

type ManualBookingHeldSlot = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  holdExpiresAt: Date | null;
  status: string;
};

type LatestMaterialsSubmission = {
  createdAt: Date;
  filesCount: number;
  linksCount: number;
};

function getLatestAuditByAction(auditEvents: ManualBookingAudit[], action: string) {
  return auditEvents.find((event) => event.action === action) ?? null;
}

function getAuditMetaNumber(metadataJson: Prisma.JsonValue | null | undefined, key: string) {
  if (!metadataJson || Array.isArray(metadataJson) || typeof metadataJson !== "object") {
    return null;
  }

  const value = (metadataJson as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function getLatestMaterialsSubmission(
  auditEvents: ManualBookingAudit[]
): LatestMaterialsSubmission | null {
  const event = getLatestAuditByAction(auditEvents, "patient_materials_submitted");

  if (!event) {
    return null;
  }

  return {
    createdAt: event.createdAt,
    filesCount: getAuditMetaNumber(event.metadataJson, "filesCount") ?? 0,
    linksCount: getAuditMetaNumber(event.metadataJson, "linksCount") ?? 0
  };
}

function appendManualBookingFlag<T extends { auditEvents: ManualBookingAudit[] }>(application: T) {
  const latestMaterialsSubmission = getLatestMaterialsSubmission(application.auditEvents);

  return {
    ...application,
    patientConfirmedManualBooking: Boolean(
      getLatestAuditByAction(application.auditEvents, "manual_booking_confirmed")
    ),
    latestMaterialsSubmission
  };
}

function appendManualBookingState<
  T extends {
    auditEvents: ManualBookingAudit[];
    offers: Array<{
      status: string;
      heldSlots: ManualBookingHeldSlot[];
    }>;
  }
>(application: T) {
  const heldOffer = application.offers.find(
    (offer) => offer.status === "HELD" && offer.heldSlots.length > 0
  );
  const manualBookingHeldSlot = heldOffer?.heldSlots[0] ?? null;
  const manualBookingConfirmedAt =
    getLatestAuditByAction(application.auditEvents, "manual_booking_confirmed")?.createdAt ?? null;
  const latestMaterialsSubmission = getLatestMaterialsSubmission(application.auditEvents);

  return {
    ...application,
    patientConfirmedManualBooking: Boolean(manualBookingConfirmedAt || manualBookingHeldSlot),
    manualBookingConfirmedAt,
    manualBookingHeldSlot,
    latestMaterialsSubmission
  };
}

function buildApplicationWhere(filters: ApplicationFilters) {
  const where: Prisma.ApplicationWhereInput = {};

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters.productCode && filters.productCode !== "ALL") {
    where.OR = [
      { requestedProductCode: filters.productCode },
      { assignedProductCode: filters.productCode }
    ];
  }

  if (filters.query?.trim()) {
    const query = filters.query.trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { id: { contains: query, mode: "insensitive" } },
          { patient: { fullName: { contains: query, mode: "insensitive" } } },
          { patient: { email: { contains: query, mode: "insensitive" } } },
          { chiefComplaint: { contains: query, mode: "insensitive" } }
        ]
      }
    ];
  }

  return where;
}

async function createAuditLog(input: {
  actor: StaffActor;
  applicationId?: string;
  entityType:
    | "APPLICATION"
    | "REQUIREMENT"
    | "OFFER"
    | "TOKEN"
    | "UPLOAD"
    | "EXTERNAL_LINK"
    | "THREAD"
    | "MESSAGE";
  entityId: string;
  action: string;
  metadataJson?: Record<string, unknown>;
}) {
  await prisma.auditEvent.create({
    data: {
      actorType: "USER",
      actorUserId: input.actor.id,
      applicationId: input.applicationId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      metadataJson: input.metadataJson as Prisma.InputJsonValue | undefined
    }
  });
}

export async function getDashboardSnapshot() {
  const [newCount, underReviewCount, needsUploadCount, needsImagingCount, bookingSentCount] =
    await Promise.all([
      prisma.application.count({ where: { status: "NEW" } }),
      prisma.application.count({ where: { status: "UNDER_REVIEW" } }),
      prisma.application.count({ where: { status: "NEEDS_UPLOAD" } }),
      prisma.application.count({ where: { status: "NEEDS_IMAGING_ACCESS" } }),
      prisma.application.count({ where: { status: "BOOKING_SENT" } })
    ]);

  const latestApplications = await prisma.application.findMany({
    orderBy: { submittedAt: "desc" },
    take: 8,
    select: {
      id: true,
      status: true,
      requestedProductCode: true,
      assignedProductCode: true,
      submittedAt: true,
      patient: {
        select: {
          fullName: true,
          email: true
        }
      }
    }
  });

  return {
    counters: {
      newCount,
      underReviewCount,
      needsUploadCount,
      needsImagingCount,
      bookingSentCount
    },
    latestApplications
  };
}

export async function listApplications(filters: ApplicationFilters) {
  const applications = await prisma.application.findMany({
    where: buildApplicationWhere(filters),
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      status: true,
      requestedProductCode: true,
      assignedProductCode: true,
      submittedAt: true,
      imagingSourceType: true,
      chiefComplaint: true,
      patient: {
        select: {
          fullName: true,
          email: true,
          country: true,
          timezone: true
        }
      },
      _count: {
        select: {
          uploads: true,
          externalLinks: true,
          requirements: true,
          offers: true
        }
      },
      auditEvents: {
        where: {
          action: {
            in: ["manual_booking_confirmed", "patient_materials_submitted"]
          }
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          action: true,
          createdAt: true,
          metadataJson: true
        }
      }
    }
  });

  const applicationsWithDisplayNumbers = await attachApplicationDisplayNumbers(applications);

  return applicationsWithDisplayNumbers.map(appendManualBookingFlag);
}

export async function getApplicationDetail(applicationId: string) {
  await syncThreadLifecycle(applicationId);

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      patient: true,
      redFlags: true,
      legalAcceptance: true,
      uploads: {
        orderBy: { createdAt: "asc" }
      },
      externalLinks: {
        orderBy: { createdAt: "asc" }
      },
      requirements: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: { name: true, email: true }
          },
          resolvedBy: {
            select: { name: true, email: true }
          },
          accessTokens: {
            where: { purpose: "MATERIALS", revokedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              expiresAt: true,
              createdAt: true,
              consumedAt: true
            }
          }
        }
      },
      offers: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: { name: true, email: true }
          },
          heldSlots: {
            where: { status: "HELD" },
            orderBy: { startsAt: "desc" },
            take: 1,
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              timezone: true,
              holdExpiresAt: true,
              status: true
            }
          },
          accessTokens: {
            where: { purpose: "BOOKING", revokedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              expiresAt: true,
              createdAt: true,
              consumedAt: true
            }
          }
        }
      },
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 3
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 5
      },
      messageThread: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              senderUser: {
                select: {
                  name: true,
                  email: true,
                  role: true
                }
              }
            }
          }
        }
      },
      auditEvents: {
        where: {
          action: {
            in: ["manual_booking_confirmed", "patient_materials_submitted"]
          }
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          action: true,
          createdAt: true,
          metadataJson: true
        }
      }
    }
  });

  if (!application) {
    return null;
  }

  const displayNumber =
    (await getApplicationDisplayNumber({
      applicationId: application.id,
      submittedAt: application.submittedAt
    })) ?? application.id;

  if (!application.messageThread) {
    return {
      ...appendManualBookingState(application),
      displayNumber
    };
  }

  await prisma.message.updateMany({
    where: {
      threadId: application.messageThread.id,
      authorRole: "PATIENT",
      readByStaffAt: null
    },
    data: {
      readByStaffAt: new Date()
    }
  });

  const refreshedApplication = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      patient: true,
      redFlags: true,
      legalAcceptance: true,
      uploads: {
        orderBy: { createdAt: "asc" }
      },
      externalLinks: {
        orderBy: { createdAt: "asc" }
      },
      requirements: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: { name: true, email: true }
          },
          resolvedBy: {
            select: { name: true, email: true }
          },
          accessTokens: {
            where: { purpose: "MATERIALS", revokedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              expiresAt: true,
              createdAt: true,
              consumedAt: true
            }
          }
        }
      },
      offers: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: { name: true, email: true }
          },
          heldSlots: {
            where: { status: "HELD" },
            orderBy: { startsAt: "desc" },
            take: 1,
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              timezone: true,
              holdExpiresAt: true,
              status: true
            }
          },
          accessTokens: {
            where: { purpose: "BOOKING", revokedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              expiresAt: true,
              createdAt: true,
              consumedAt: true
            }
          }
        }
      },
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 3
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 5
      },
      messageThread: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              senderUser: {
                select: {
                  name: true,
                  email: true,
                  role: true
                }
              }
            }
          }
        }
      },
      auditEvents: {
        where: {
          action: {
            in: ["manual_booking_confirmed", "patient_materials_submitted"]
          }
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          action: true,
          createdAt: true,
          metadataJson: true
        }
      }
    }
  });

  if (!refreshedApplication) {
    return null;
  }

  return {
    ...appendManualBookingState(refreshedApplication),
    displayNumber
  };
}

export async function requestApplicationMaterials(input: {
  actor: StaffActor;
  applicationId: string;
  type: RequirementType;
  note: string;
}) {
  const rawToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + env.DEFAULT_MATERIALS_TTL_HOURS * 60 * 60 * 1000);
  const nextStatus: ApplicationStatus =
    input.type === "UPLOAD" ? "NEEDS_UPLOAD" : "NEEDS_IMAGING_ACCESS";

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: input.applicationId },
      select: {
        id: true,
        status: true,
        patient: { select: { fullName: true, email: true } }
      }
    });

    if (!application) {
      throw new Error("Заявка не найдена.");
    }

    if (application.status === "REJECTED" || application.status === "ARCHIVED") {
      throw new Error("Для закрытого кейса нельзя запрашивать дополнительные материалы.");
    }

    const requirement = await tx.applicationRequirement.create({
      data: {
        applicationId: application.id,
        type: input.type,
        note: input.note,
        createdByUserId: input.actor.id
      }
    });

    const token = await tx.accessToken.create({
      data: {
        applicationId: application.id,
        requirementId: requirement.id,
        purpose: "MATERIALS",
        tokenHash,
        expiresAt
      }
    });

    if (PRE_REVIEW_STATUSES.includes(application.status)) {
      await tx.application.update({
        where: { id: application.id },
        data: { status: nextStatus }
      });

      await tx.auditEvent.create({
        data: {
          actorType: "USER",
          actorUserId: input.actor.id,
          applicationId: application.id,
          entityType: "APPLICATION",
          entityId: application.id,
          action: "status_changed",
          metadataJson: {
            from: application.status,
            to: nextStatus
          }
        }
      });
    }

    await tx.auditEvent.create({
      data: {
        actorType: "USER",
        actorUserId: input.actor.id,
        applicationId: application.id,
        entityType: "REQUIREMENT",
        entityId: requirement.id,
        action: "requirement_requested",
        metadataJson: {
          type: input.type,
          tokenId: token.id
        }
      }
    });

    return {
      requirementId: requirement.id,
      patientName: application.patient.fullName,
      patientEmail: application.patient.email
    };
  });

  const materialsUrl = `${env.APP_URL}/portal/materials/${rawToken}`;
  const emailDelivery = await sendMaterialsRequestEmail({
    patientName: result.patientName,
    patientEmail: result.patientEmail,
    requirementType: input.type,
    note: input.note,
    materialsUrl,
    expiresAt
  });

  await createAuditLog({
    actor: input.actor,
    applicationId: input.applicationId,
    entityType: "REQUIREMENT",
    entityId: result.requirementId,
    action:
      emailDelivery.status === "sent"
        ? "materials_request_email_sent"
        : "materials_request_email_failed",
    metadataJson: {
      requirementType: input.type,
      provider: emailDelivery.provider,
      manualFallbackRequired: emailDelivery.manualFallbackRequired,
      errorMessage:
        emailDelivery.status === "failed" ? emailDelivery.errorMessage ?? null : null
    }
  });

  return {
    ...result,
    materialsUrl,
    expiresAt,
    emailDelivery
  };
}

export async function rejectApplication(input: {
  actor: StaffActor;
  applicationId: string;
  note: string;
}) {
  const existing = await prisma.application.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      patient: {
        select: {
          fullName: true,
          email: true
        }
      }
    }
  });

  if (!existing) {
    throw new Error("Заявка не найдена.");
  }

  const displayNumber =
    (await getApplicationDisplayNumber({
      applicationId: existing.id,
      submittedAt: existing.submittedAt
    })) ?? existing.id;

  const application = await prisma.application.update({
    where: { id: input.applicationId },
    data: {
      status: "REJECTED",
      reviewedAt: new Date()
    }
  });

  await createAuditLog({
    actor: input.actor,
    applicationId: application.id,
    entityType: "APPLICATION",
    entityId: application.id,
    action: "application_rejected",
    metadataJson: {
      from: existing.status,
      to: "REJECTED",
      note: input.note
    }
  });

  await createAuditLog({
    actor: input.actor,
    applicationId: application.id,
    entityType: "APPLICATION",
    entityId: application.id,
    action: "status_changed",
    metadataJson: {
      from: existing.status,
      to: "REJECTED",
      note: input.note
    }
  });

  const [patientEmailDelivery, staffEmailDelivery] = await Promise.all([
    sendApplicationRejectedPatientEmail({
      patientName: existing.patient.fullName,
      patientEmail: existing.patient.email
    }),
    sendApplicationRejectedStaffEmail({
      applicationId: application.id,
      applicationDisplayNumber: displayNumber,
      patientName: existing.patient.fullName,
      note: input.note
    })
  ]);

  await createAuditLog({
    actor: input.actor,
    applicationId: application.id,
    entityType: "APPLICATION",
    entityId: application.id,
    action:
      patientEmailDelivery.status === "sent"
        ? "application_rejected_patient_email_sent"
        : "application_rejected_patient_email_failed",
    metadataJson: {
      provider: patientEmailDelivery.provider,
      manualFallbackRequired: patientEmailDelivery.manualFallbackRequired,
      errorMessage:
        patientEmailDelivery.status === "failed"
          ? patientEmailDelivery.errorMessage ?? null
          : null
    }
  });

  await createAuditLog({
    actor: input.actor,
    applicationId: application.id,
    entityType: "APPLICATION",
    entityId: application.id,
    action:
      staffEmailDelivery.status === "sent"
        ? "application_rejected_staff_email_sent"
        : "application_rejected_staff_email_failed",
    metadataJson: {
      provider: staffEmailDelivery.provider,
      manualFallbackRequired: staffEmailDelivery.manualFallbackRequired,
      errorMessage:
        staffEmailDelivery.status === "failed" ? staffEmailDelivery.errorMessage ?? null : null
    }
  });

  return {
    application,
    patientEmailDelivery,
    staffEmailDelivery
  };
}

export async function createOfferForApplication(input: {
  actor: StaffActor;
  applicationId: string;
  productCode: ProductCode;
  chargeModel: ChargeModel;
  amountCents: number;
  currency: string;
  durationMinutes: number;
}) {
  const rawToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + env.DEFAULT_OFFER_TTL_HOURS * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: input.applicationId },
      select: {
        id: true,
        status: true,
        patient: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });

    if (!application) {
      throw new Error("Заявка не найдена.");
    }

    if (application.status === "REJECTED" || application.status === "ARCHIVED") {
      throw new Error("Для закрытого кейса нельзя создавать оффер.");
    }

    const offer = await tx.offer.create({
      data: {
        applicationId: input.applicationId,
        productCode: input.productCode,
        chargeModel: input.chargeModel,
        amountCents: input.amountCents,
        currency: input.currency,
        durationMinutes: input.durationMinutes,
        expiresAt,
        createdByUserId: input.actor.id
      }
    });

    await tx.accessToken.create({
      data: {
        applicationId: input.applicationId,
        offerId: offer.id,
        purpose: "BOOKING",
        tokenHash,
        expiresAt
      }
    });

    await tx.application.update({
      where: { id: input.applicationId },
      data: {
        assignedProductCode: input.productCode,
        status: "BOOKING_SENT",
        reviewedAt: new Date()
      }
    });

    await tx.auditEvent.createMany({
      data: [
        {
          actorType: "USER",
          actorUserId: input.actor.id,
          applicationId: input.applicationId,
          entityType: "OFFER",
          entityId: offer.id,
          action: "offer_created",
          metadataJson: {
            productCode: input.productCode,
            chargeModel: input.chargeModel,
            amountCents: input.amountCents,
            currency: input.currency
          }
        },
        {
          actorType: "USER",
          actorUserId: input.actor.id,
          applicationId: input.applicationId,
          entityType: "APPLICATION",
          entityId: input.applicationId,
          action: "status_changed",
          metadataJson: {
            from: application.status,
            to: "BOOKING_SENT"
          }
        }
      ]
    });

    return {
      offerId: offer.id,
      offerStatus: offer.status,
      patientName: application.patient.fullName,
      patientEmail: application.patient.email
    };
  });

  const bookingUrl = `${env.APP_URL}/booking/${rawToken}`;
  const emailDelivery = await sendOfferCreatedEmail({
    patientName: result.patientName,
    patientEmail: result.patientEmail,
    productCode: input.productCode,
    chargeModel: input.chargeModel,
    amountCents: input.amountCents,
    currency: input.currency,
    bookingUrl,
    expiresAt
  });

  if (emailDelivery.status === "sent") {
    await prisma.offer.update({
      where: { id: result.offerId },
      data: {
        lastSentAt: new Date()
      }
    });
  }

  await createAuditLog({
    actor: input.actor,
    applicationId: input.applicationId,
    entityType: "OFFER",
    entityId: result.offerId,
    action: emailDelivery.status === "sent" ? "offer_email_sent" : "offer_email_failed",
    metadataJson: {
      productCode: input.productCode,
      chargeModel: input.chargeModel,
      amountCents: input.amountCents,
      currency: input.currency,
      offerStatus: result.offerStatus,
      provider: emailDelivery.provider,
      manualFallbackRequired: emailDelivery.manualFallbackRequired,
      errorMessage:
        emailDelivery.status === "failed" ? emailDelivery.errorMessage ?? null : null
    }
  });

  return {
    ...result,
    bookingUrl,
    expiresAt,
    emailDelivery
  };
}

export async function listBookingLinks() {
  return prisma.offer.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      productCode: true,
      chargeModel: true,
      amountCents: true,
      currency: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      application: {
        select: {
          id: true,
          status: true,
          patient: {
            select: {
              fullName: true,
              email: true
            }
          }
        }
      }
    }
  });
}

export async function revealSensitiveAccess(input: {
  actor: StaffActor;
  applicationId: string;
  targetType: "upload" | "externalLink";
  targetId: string;
  action: "reveal" | "copy";
}) {
  const target =
    input.targetType === "upload"
      ? await prisma.applicationUpload.findFirst({
          where: {
            id: input.targetId,
            applicationId: input.applicationId
          },
          select: {
            id: true,
            accessPasswordCiphertext: true,
            accessInstructionsCiphertext: true
          }
        })
      : await prisma.applicationExternalLink.findFirst({
          where: {
            id: input.targetId,
            applicationId: input.applicationId
          },
          select: {
            id: true,
            accessPasswordCiphertext: true,
            accessInstructionsCiphertext: true
          }
        });

  if (!target) {
    throw new Error("Источник доступа не найден.");
  }

  await createAuditLog({
    actor: input.actor,
    applicationId: input.applicationId,
    entityType: input.targetType === "upload" ? "UPLOAD" : "EXTERNAL_LINK",
    entityId: target.id,
    action: input.action === "copy" ? "sensitive_copied" : "sensitive_revealed"
  });

  return {
    accessPassword: target.accessPasswordCiphertext
      ? decryptSensitiveField(target.accessPasswordCiphertext)
      : null,
    accessInstructions: target.accessInstructionsCiphertext
      ? decryptSensitiveField(target.accessInstructionsCiphertext)
      : null
  };
}
