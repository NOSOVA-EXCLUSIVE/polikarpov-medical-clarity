import "server-only";

import type {
  MessageAuthorRole,
  Prisma,
  ProductCode,
  ReadOnlyReason,
  ThreadStatus,
  UserRole
} from "@prisma/client";

import { MESSAGE_POLICY_BY_PRODUCT } from "@/features/messages/policies";
import {
  getCloseReasonText,
  getOpeningSystemMessage,
  getReadOnlyReasonText,
  getThreadRulesText,
  SUPPORT_PACKAGE_DAYS_BY_PRODUCT
} from "@/features/messages/content";
import {
  sendPatientNewMessageEmail,
  sendPatientStatusEmail,
  sendPortalOpenedEmail,
  sendStaffNewMessageEmail,
  sendThreadClosedEmail,
  sendThreadReadOnlyEmail
} from "@/features/messages/notifications";
import type { PortalSession } from "@/lib/auth/portal-session";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env/server";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/security/tokens";

type StaffActor = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type ThreadSummary = {
  id: string;
  applicationId: string;
  productCode: ProductCode;
  mode: "CLARIFICATION_WINDOW" | "SUPPORT_PACKAGE";
  startsAt: Date | null;
  endsAt: Date | null;
  patientMessageLimit: number | null;
  patientMessageCount: number;
  status: ThreadStatus;
  readOnlyReason: ReadOnlyReason | null;
  closeReason: "CASE_COMPLETED" | "CASE_ARCHIVED" | "MANUAL_CLOSE" | "REJECTED" | null;
};

type ThreadTransition =
  | {
      kind: "read_only";
      applicationId: string;
      patientName: string;
      patientEmail: string;
      productCode: ProductCode;
      reason: ReadOnlyReason;
    }
  | {
      kind: "closed";
      applicationId: string;
      patientName: string;
      patientEmail: string;
      productCode: ProductCode;
      reason: "CASE_COMPLETED" | "CASE_ARCHIVED" | "MANUAL_CLOSE" | "REJECTED";
    }
  | null;

const STAFF_REPLY_READ_ONLY_REASONS = new Set<ReadOnlyReason>(["MESSAGE_LIMIT_REACHED"]);

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function createError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function getResolvedProductCode(input: {
  assignedProductCode: ProductCode | null;
  requestedProductCode: ProductCode | null;
}) {
  const productCode = input.assignedProductCode ?? input.requestedProductCode;

  if (!productCode) {
    throw createError("Для этого кейса пока не выбран продукт.", 409);
  }

  return productCode;
}

function getThreadDates(productCode: ProductCode, startsAt: Date) {
  const policy = MESSAGE_POLICY_BY_PRODUCT[productCode];

  if (policy.mode === "CLARIFICATION_WINDOW" && policy.clarificationWindowHours) {
    return {
      startsAt,
      endsAt: addHours(startsAt, policy.clarificationWindowHours)
    };
  }

  const supportDays = SUPPORT_PACKAGE_DAYS_BY_PRODUCT[productCode];

  return {
    startsAt,
    endsAt: typeof supportDays === "number" ? addDays(startsAt, supportDays) : null
  };
}

async function createAuditEvent(input: {
  actorType: "SYSTEM" | "USER" | "PATIENT";
  actorUserId?: string;
  applicationId?: string;
  entityType: "APPLICATION" | "THREAD" | "MESSAGE" | "TOKEN";
  entityId: string;
  action: string;
  metadataJson?: Record<string, unknown>;
}) {
  await prisma.auditEvent.create({
    data: {
      actorType: input.actorType,
      actorUserId: input.actorUserId,
      applicationId: input.applicationId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      metadataJson: input.metadataJson
    }
  });
}

async function revokePortalAccessTokens(
  tx: Prisma.TransactionClient,
  applicationId: string,
  revokedAt: Date
) {
  await tx.accessToken.updateMany({
    where: {
      applicationId,
      purpose: "PORTAL_ACCESS",
      revokedAt: null
    },
    data: {
      revokedAt
    }
  });
}

async function issuePortalAccessToken(
  tx: Prisma.TransactionClient,
  applicationId: string,
  now: Date
) {
  const rawToken = createOpaqueToken();
  const expiresAt = addHours(now, env.DEFAULT_PORTAL_ACCESS_TTL_HOURS);

  await revokePortalAccessTokens(tx, applicationId, now);

  const token = await tx.accessToken.create({
    data: {
      applicationId,
      purpose: "PORTAL_ACCESS",
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt
    }
  });

  return {
    id: token.id,
    expiresAt,
    portalUrl: `${env.APP_URL}/portal/access/${rawToken}`
  };
}

export function canPatientSendMessage(thread: ThreadSummary | null | undefined) {
  if (!thread || thread.status !== "ACTIVE") {
    return false;
  }

  if (
    typeof thread.patientMessageLimit === "number" &&
    thread.patientMessageCount >= thread.patientMessageLimit
  ) {
    return false;
  }

  return true;
}

export function canStaffReplyToThread(thread: ThreadSummary | null | undefined) {
  if (!thread) {
    return false;
  }

  if (thread.status === "ACTIVE") {
    return true;
  }

  return (
    thread.status === "READ_ONLY" &&
    Boolean(thread.readOnlyReason && STAFF_REPLY_READ_ONLY_REASONS.has(thread.readOnlyReason))
  );
}

export function buildThreadSummary(thread: ThreadSummary) {
  return {
    status: thread.status,
    startsAt: thread.startsAt,
    endsAt: thread.endsAt,
    patientMessageLimit: thread.patientMessageLimit,
    patientMessageCount: thread.patientMessageCount,
    remainingPatientMessages:
      typeof thread.patientMessageLimit === "number"
        ? Math.max(thread.patientMessageLimit - thread.patientMessageCount, 0)
        : null,
    readOnlyReason: thread.readOnlyReason,
    closeReason: thread.closeReason,
    canPatientSend: canPatientSendMessage(thread),
    canStaffReply: canStaffReplyToThread(thread)
  };
}

function getBlockedPatientMessage(thread: ThreadSummary) {
  if (thread.status === "CLOSED") {
    return thread.closeReason ? getCloseReasonText(thread.closeReason) : "Переписка закрыта.";
  }

  if (thread.status === "READ_ONLY" && thread.readOnlyReason) {
    return getReadOnlyReasonText(thread.readOnlyReason);
  }

  if (thread.status === "INACTIVE") {
    return "Центр сообщений ещё не открыт.";
  }

  return "Сейчас отправка новых сообщений недоступна.";
}

async function syncThreadLifecycleInternal(applicationId: string): Promise<ThreadTransition> {
  const now = new Date();
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      assignedProductCode: true,
      requestedProductCode: true,
      patient: {
        select: {
          fullName: true,
          email: true
        }
      },
      messageThread: true
    }
  });

  if (!application?.messageThread) {
    return null;
  }

  const productCode = getResolvedProductCode(application);
  const thread = application.messageThread;

  if (thread.status === "CLOSED") {
    return null;
  }

  let closeReason: "CASE_COMPLETED" | "CASE_ARCHIVED" | "REJECTED" | null = null;

  if (application.status === "COMPLETED") {
    closeReason = "CASE_COMPLETED";
  } else if (application.status === "ARCHIVED") {
    closeReason = "CASE_ARCHIVED";
  } else if (application.status === "REJECTED") {
    closeReason = "REJECTED";
  }

  if (closeReason) {
    await prisma.$transaction(async (tx) => {
      await tx.messageThread.update({
        where: { id: thread.id },
        data: {
          status: "CLOSED",
          closeReason,
          closedAt: now
        }
      });

      await tx.auditEvent.create({
        data: {
          actorType: "SYSTEM",
          applicationId,
          entityType: "THREAD",
          entityId: thread.id,
          action: "thread_closed",
          metadataJson: {
            reason: closeReason
          }
        }
      });
    });

    return {
      kind: "closed",
      applicationId,
      patientName: application.patient.fullName,
      patientEmail: application.patient.email,
      productCode,
      reason: closeReason
    };
  }

  if (thread.status !== "ACTIVE") {
    return null;
  }

  let readOnlyReason: ReadOnlyReason | null = null;

  if (thread.endsAt && thread.endsAt <= now) {
    readOnlyReason = thread.mode === "CLARIFICATION_WINDOW" ? "WINDOW_EXPIRED" : "PACKAGE_ENDED";
  } else if (
    typeof thread.patientMessageLimit === "number" &&
    thread.patientMessageCount >= thread.patientMessageLimit
  ) {
    readOnlyReason = "MESSAGE_LIMIT_REACHED";
  }

  if (!readOnlyReason) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.messageThread.update({
      where: { id: thread.id },
      data: {
        status: "READ_ONLY",
        readOnlyReason,
        readOnlyAt: now
      }
    });

    await tx.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        applicationId,
        entityType: "THREAD",
        entityId: thread.id,
        action: "thread_read_only",
        metadataJson: {
          reason: readOnlyReason
        }
      }
    });
  });

  return {
    kind: "read_only",
    applicationId,
    patientName: application.patient.fullName,
    patientEmail: application.patient.email,
    productCode,
    reason: readOnlyReason
  };
}

export async function syncThreadLifecycle(applicationId: string) {
  const transition = await syncThreadLifecycleInternal(applicationId);

  if (!transition) {
    return null;
  }

  if (transition.kind === "read_only") {
    await sendThreadReadOnlyEmail(transition);
    return transition;
  }

  await sendThreadClosedEmail(transition);
  return transition;
}

export async function activateApplicationCase(input: {
  actor: StaffActor;
  applicationId: string;
}) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: input.applicationId },
      include: {
        patient: {
          select: {
            fullName: true,
            email: true
          }
        },
        messageThread: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    if (!application) {
      throw createError("Кейс не найден.", 404);
    }

    if (application.status !== "PAID") {
      throw createError("Центр сообщений можно открыть только после оплаты.", 409);
    }

    if (application.messageThread && application.messageThread.status !== "INACTIVE") {
      throw createError("Для этого кейса центр сообщений уже открыт.", 409);
    }

    const productCode = getResolvedProductCode(application);
    const policy = MESSAGE_POLICY_BY_PRODUCT[productCode];
    const dates = getThreadDates(productCode, now);

    const thread = application.messageThread
      ? await tx.messageThread.update({
          where: { id: application.messageThread.id },
          data: {
            productCode,
            mode: policy.mode,
            startsAt: dates.startsAt,
            endsAt: dates.endsAt,
            patientMessageLimit: policy.patientMessageLimit,
            patientMessageCount: 0,
            status: "ACTIVE",
            readOnlyReason: null,
            closeReason: null,
            readOnlyAt: null,
            closedAt: null,
            rulesSnapshotJson: {
              rulesText: getThreadRulesText(productCode),
              patientMessageLimit: policy.patientMessageLimit,
              clarificationWindowHours: policy.clarificationWindowHours,
              supportEndsAt: dates.endsAt?.toISOString() ?? null
            }
          }
        })
      : await tx.messageThread.create({
          data: {
            applicationId: application.id,
            productCode,
            mode: policy.mode,
            startsAt: dates.startsAt,
            endsAt: dates.endsAt,
            patientMessageLimit: policy.patientMessageLimit,
            patientMessageCount: 0,
            status: "ACTIVE",
            rulesSnapshotJson: {
              rulesText: getThreadRulesText(productCode),
              patientMessageLimit: policy.patientMessageLimit,
              clarificationWindowHours: policy.clarificationWindowHours,
              supportEndsAt: dates.endsAt?.toISOString() ?? null
            }
          }
        });

    await tx.application.update({
      where: { id: application.id },
      data: {
        status: "ACTIVE",
        activeAt: now
      }
    });

    await tx.message.create({
      data: {
        threadId: thread.id,
        authorRole: "SYSTEM",
        body: getOpeningSystemMessage(productCode),
        readByPatientAt: now,
        readByStaffAt: now
      }
    });

    const portalAccess = await issuePortalAccessToken(tx, application.id, now);

    await tx.auditEvent.createMany({
      data: [
        {
          actorType: "USER",
          actorUserId: input.actor.id,
          applicationId: application.id,
          entityType: "APPLICATION",
          entityId: application.id,
          action: "status_changed",
          metadataJson: {
            from: "PAID",
            to: "ACTIVE"
          }
        },
        {
          actorType: "USER",
          actorUserId: input.actor.id,
          applicationId: application.id,
          entityType: "THREAD",
          entityId: thread.id,
          action: "thread_opened",
          metadataJson: {
            productCode,
            mode: policy.mode
          }
        },
        {
          actorType: "USER",
          actorUserId: input.actor.id,
          applicationId: application.id,
          entityType: "TOKEN",
          entityId: portalAccess.id,
          action: "portal_access_created"
        }
      ]
    });

    return {
      patientName: application.patient.fullName,
      patientEmail: application.patient.email,
      productCode,
      portalUrl: portalAccess.portalUrl,
      expiresAt: portalAccess.expiresAt
    };
  });

  await sendPortalOpenedEmail(result);

  return result;
}

export async function completeApplicationCase(input: {
  actor: StaffActor;
  applicationId: string;
}) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: input.applicationId },
      include: {
        patient: {
          select: {
            fullName: true,
            email: true
          }
        },
        messageThread: {
          select: {
            id: true
          }
        }
      }
    });

    if (!application) {
      throw createError("Кейс не найден.", 404);
    }

    if (application.status !== "ACTIVE") {
      throw createError("Завершить можно только активный кейс.", 409);
    }

    const productCode = getResolvedProductCode(application);

    await tx.application.update({
      where: { id: application.id },
      data: {
        status: "COMPLETED",
        completedAt: now
      }
    });

    if (application.messageThread) {
      await tx.messageThread.update({
        where: { id: application.messageThread.id },
        data: {
          status: "CLOSED",
          closeReason: "CASE_COMPLETED",
          closedAt: now
        }
      });
    }

    await revokePortalAccessTokens(tx, application.id, now);

    await tx.auditEvent.createMany({
      data: [
        {
          actorType: "USER",
          actorUserId: input.actor.id,
          applicationId: application.id,
          entityType: "APPLICATION",
          entityId: application.id,
          action: "status_changed",
          metadataJson: {
            from: "ACTIVE",
            to: "COMPLETED"
          }
        },
        ...(application.messageThread
          ? [
              {
                actorType: "USER" as const,
                actorUserId: input.actor.id,
                applicationId: application.id,
                entityType: "THREAD" as const,
                entityId: application.messageThread.id,
                action: "thread_closed",
                metadataJson: {
                  reason: "CASE_COMPLETED"
                }
              }
            ]
          : [])
      ]
    });

    return {
      patientName: application.patient.fullName,
      patientEmail: application.patient.email,
      productCode
    };
  });

  await sendPatientStatusEmail({
    patientName: result.patientName,
    patientEmail: result.patientEmail,
    productCode: result.productCode,
    statusLine: "Кейс завершён.",
    details: "Переписка по этому кейсу закрыта. Все сообщения сохраняются только для чтения."
  });

  return result;
}

export async function consumePortalAccessToken(rawToken: string) {
  const now = new Date();
  const tokenHash = hashOpaqueToken(rawToken);

  const token = await prisma.accessToken.findFirst({
    where: {
      purpose: "PORTAL_ACCESS",
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: now }
    },
    include: {
      application: {
        include: {
          patient: {
            select: {
              fullName: true,
              email: true
            }
          },
          messageThread: {
            select: {
              id: true
            }
          }
        }
      }
    }
  });

  if (!token || !token.application.messageThread) {
    throw createError(
      "Эта ссылка больше недоступна. Если доступ всё ещё нужен, попросите отправить новую ссылку.",
      404
    );
  }

  if (token.application.status !== "ACTIVE" && token.application.status !== "COMPLETED") {
    throw createError("Центр сообщений для этого кейса ещё не открыт или уже недоступен.", 409);
  }

  await prisma.accessToken.update({
    where: { id: token.id },
    data: {
      consumedAt: token.consumedAt ?? now
    }
  });

  await createAuditEvent({
    actorType: "PATIENT",
    applicationId: token.applicationId,
    entityType: "TOKEN",
    entityId: token.id,
    action: "portal_access_consumed"
  });

  return {
    applicationId: token.application.id,
    patientName: token.application.patient.fullName,
    patientEmail: token.application.patient.email
  };
}

export async function getPortalMessagesContext(session: PortalSession) {
  await syncThreadLifecycle(session.applicationId);

  const application = await prisma.application.findUnique({
    where: { id: session.applicationId },
    include: {
      patient: {
        select: {
          fullName: true,
          email: true,
          timezone: true
        }
      },
      messageThread: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              senderUser: {
                select: {
                  name: true,
                  role: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!application?.messageThread) {
    throw createError("Центр сообщений для этого кейса пока недоступен.", 404);
  }

  await prisma.message.updateMany({
    where: {
      threadId: application.messageThread.id,
      authorRole: {
        in: ["DOCTOR", "ADMIN", "SYSTEM"] as MessageAuthorRole[]
      },
      readByPatientAt: null
    },
    data: {
      readByPatientAt: new Date()
    }
  });

  const refreshed = await prisma.application.findUnique({
    where: { id: session.applicationId },
    include: {
      patient: {
        select: {
          fullName: true,
          email: true,
          timezone: true
        }
      },
      messageThread: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              senderUser: {
                select: {
                  name: true,
                  role: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!refreshed?.messageThread) {
    throw createError("Центр сообщений для этого кейса пока недоступен.", 404);
  }

  const productCode = getResolvedProductCode(refreshed);

  return {
    application: {
      id: refreshed.id,
      status: refreshed.status,
      productCode,
      patientName: refreshed.patient.fullName,
      patientEmail: refreshed.patient.email,
      timezone: refreshed.patient.timezone
    },
    thread: {
      id: refreshed.messageThread.id,
      applicationId: refreshed.id,
      productCode: refreshed.messageThread.productCode,
      mode: refreshed.messageThread.mode,
      startsAt: refreshed.messageThread.startsAt,
      endsAt: refreshed.messageThread.endsAt,
      patientMessageLimit: refreshed.messageThread.patientMessageLimit,
      patientMessageCount: refreshed.messageThread.patientMessageCount,
      status: refreshed.messageThread.status,
      readOnlyReason: refreshed.messageThread.readOnlyReason,
      closeReason: refreshed.messageThread.closeReason,
      rulesText: getThreadRulesText(productCode),
      ...buildThreadSummary(refreshed.messageThread)
    },
    messages: refreshed.messageThread.messages
  };
}

export async function sendPatientMessage(input: {
  session: PortalSession;
  body: string;
}) {
  await syncThreadLifecycle(input.session.applicationId);

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: input.session.applicationId },
      include: {
        patient: {
          select: {
            fullName: true,
            email: true
          }
        },
        messageThread: true
      }
    });

    if (!application?.messageThread) {
      throw createError("Центр сообщений для этого кейса пока недоступен.", 404);
    }

    const productCode = getResolvedProductCode(application);
    const thread = application.messageThread;

    if (!canPatientSendMessage(thread)) {
      throw createError(getBlockedPatientMessage(thread), 409);
    }

    const nextCount = thread.patientMessageCount + 1;
    const reachedLimit =
      typeof thread.patientMessageLimit === "number" && nextCount >= thread.patientMessageLimit;

    const message = await tx.message.create({
      data: {
        threadId: thread.id,
        authorRole: "PATIENT",
        body: input.body.trim(),
        readByPatientAt: now
      }
    });

    await tx.messageThread.update({
      where: { id: thread.id },
      data: {
        patientMessageCount: {
          increment: 1
        },
        ...(reachedLimit
          ? {
              status: "READ_ONLY",
              readOnlyReason: "MESSAGE_LIMIT_REACHED",
              readOnlyAt: now
            }
          : {})
      }
    });

    await tx.auditEvent.createMany({
      data: [
        {
          actorType: "PATIENT",
          applicationId: application.id,
          entityType: "MESSAGE",
          entityId: message.id,
          action: "message_sent",
          metadataJson: {
            authorRole: "PATIENT"
          }
        },
        ...(reachedLimit
          ? [
              {
                actorType: "PATIENT" as const,
                applicationId: application.id,
                entityType: "THREAD" as const,
                entityId: thread.id,
                action: "thread_read_only",
                metadataJson: {
                  reason: "MESSAGE_LIMIT_REACHED"
                }
              }
            ]
          : [])
      ]
    });

    return {
      applicationId: application.id,
      patientName: application.patient.fullName,
      productCode,
      patientEmail: application.patient.email,
      reachedLimit
    };
  });

  await sendStaffNewMessageEmail({
    applicationId: result.applicationId,
    patientName: result.patientName,
    productCode: result.productCode
  });

  if (result.reachedLimit) {
    await sendPatientStatusEmail({
      patientName: result.patientName,
      patientEmail: result.patientEmail,
      productCode: result.productCode,
      statusLine: "Новые сообщения по этому кейсу больше недоступны.",
      details:
        "Лимит сообщений пациента достигнут. Уже отправленные сообщения и ответы врача останутся доступны для чтения."
    });
  }

  return { ok: true };
}

export async function sendStaffMessage(input: {
  actor: StaffActor;
  applicationId: string;
  body: string;
}) {
  await syncThreadLifecycle(input.applicationId);

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.application.findUnique({
      where: { id: input.applicationId },
      include: {
        patient: {
          select: {
            fullName: true,
            email: true
          }
        },
        messageThread: true
      }
    });

    if (!application?.messageThread) {
      throw createError("Для этого кейса центр сообщений ещё не открыт.", 404);
    }

    const productCode = getResolvedProductCode(application);
    const thread = application.messageThread;

    if (!canStaffReplyToThread(thread)) {
      throw createError("Сейчас врач уже не может добавить новое сообщение в этот тред.", 409);
    }

    const message = await tx.message.create({
      data: {
        threadId: thread.id,
        authorRole: input.actor.role === "DOCTOR" ? "DOCTOR" : "ADMIN",
        senderUserId: input.actor.id,
        body: input.body.trim(),
        readByStaffAt: now
      }
    });

    await tx.message.updateMany({
      where: {
        threadId: thread.id,
        authorRole: "PATIENT",
        readByStaffAt: null
      },
      data: {
        readByStaffAt: now
      }
    });

    const portalAccess = await issuePortalAccessToken(tx, application.id, now);

    await tx.auditEvent.createMany({
      data: [
        {
          actorType: "USER",
          actorUserId: input.actor.id,
          applicationId: application.id,
          entityType: "MESSAGE",
          entityId: message.id,
          action: "message_sent",
          metadataJson: {
            authorRole: input.actor.role
          }
        },
        {
          actorType: "USER",
          actorUserId: input.actor.id,
          applicationId: application.id,
          entityType: "TOKEN",
          entityId: portalAccess.id,
          action: "portal_access_created"
        }
      ]
    });

    return {
      patientName: application.patient.fullName,
      patientEmail: application.patient.email,
      productCode,
      portalUrl: portalAccess.portalUrl,
      expiresAt: portalAccess.expiresAt
    };
  });

  await sendPatientNewMessageEmail(result);

  return result;
}
