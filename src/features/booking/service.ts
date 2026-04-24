import "server-only";

import type {
  Appointment,
  CalendarSlot,
  ChargeModel,
  Payment,
  PaymentStatus,
  Prisma,
  ProductCode,
  SlotStatus,
  UserRole
} from "@prisma/client";
import Stripe from "stripe";

import { productLabel } from "@/features/admin/presentation";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env/server";
import { getStripe } from "@/lib/payments/stripe";
import { hashOpaqueToken } from "@/lib/security/tokens";

type StaffActor = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

type BookingAccess = {
  tokenId: string;
  rawToken: string;
  offer: {
    id: string;
    productCode: ProductCode;
    chargeModel: ChargeModel;
    amountCents: number;
    currency: string;
    durationMinutes: number;
    status: "OPEN" | "HELD" | "PAID" | "EXPIRED" | "CANCELLED";
    expiresAt: Date;
    application: {
      id: string;
      status: string;
      patient: {
        id: string;
        fullName: string;
        email: string;
        timezone: string;
      };
    };
  };
};

type PaymentWithRelations = Payment & {
  offer: {
    id: string;
    productCode: ProductCode;
    chargeModel: ChargeModel;
    application: {
      id: string;
      patient: {
        fullName: string;
        email: string;
        timezone: string;
      };
    };
  };
  appointment: Appointment | null;
};

function paymentError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

async function createSystemAudit(input: {
  applicationId?: string;
  entityType:
    | "APPLICATION"
    | "OFFER"
    | "SLOT"
    | "PAYMENT"
    | "TOKEN";
  entityId: string;
  action: string;
  metadataJson?: Record<string, unknown>;
}) {
  await prisma.auditEvent.create({
    data: {
      actorType: "SYSTEM",
      applicationId: input.applicationId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      metadataJson: input.metadataJson as Prisma.InputJsonValue | undefined
    }
  });
}

async function createStaffAudit(input: {
  actor: StaffActor;
  applicationId?: string;
  entityType: "SLOT";
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

async function resolveBookingAccess(rawToken: string): Promise<BookingAccess> {
  const now = new Date();
  const tokenHash = hashOpaqueToken(rawToken);

  const token = await prisma.accessToken.findFirst({
    where: {
      purpose: "BOOKING",
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: now }
    },
    include: {
      offer: {
        include: {
          application: {
            include: {
              patient: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  timezone: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!token || !token.offer) {
    throw paymentError(
      "Эта ссылка больше недоступна. Если запись всё ещё актуальна, попросите отправить новую ссылку.",
      404
    );
  }

  if (token.offer.status === "EXPIRED" || token.offer.expiresAt <= now) {
    await expireOffer(token.offer.id);
    throw paymentError(
      "Срок действия этой ссылки истёк. Если запись всё ещё актуальна, попросите отправить новую ссылку.",
      410
    );
  }

  if (token.offer.status === "CANCELLED") {
    throw paymentError("Эта ссылка была отменена.", 410);
  }

  if (token.offer.status === "PAID") {
    throw paymentError("Оплата по этой ссылке уже получена.", 409);
  }

  return {
    tokenId: token.id,
    rawToken,
    offer: {
      id: token.offer.id,
      productCode: token.offer.productCode,
      chargeModel: token.offer.chargeModel,
      amountCents: token.offer.amountCents,
      currency: token.offer.currency,
      durationMinutes: token.offer.durationMinutes,
      status: token.offer.status,
      expiresAt: token.offer.expiresAt,
      application: {
        id: token.offer.application.id,
        status: token.offer.application.status,
        patient: token.offer.application.patient
      }
    }
  };
}

export async function releaseExpiredSlotHolds() {
  const now = new Date();
  const expiredHeldSlots = await prisma.calendarSlot.findMany({
    where: {
      status: "HELD",
      holdExpiresAt: { lte: now },
      heldOfferId: { not: null },
      bookedAppointmentId: null
    },
    select: {
      id: true,
      heldOfferId: true
    }
  });

  if (expiredHeldSlots.length === 0) {
    return { releasedCount: 0 };
  }

  const offerIds = [...new Set(expiredHeldSlots.map((slot) => slot.heldOfferId).filter(Boolean) as string[])];

  await prisma.$transaction(async (tx) => {
    await tx.calendarSlot.updateMany({
      where: {
        id: { in: expiredHeldSlots.map((slot) => slot.id) }
      },
      data: {
        status: "AVAILABLE",
        holdExpiresAt: null,
        heldOfferId: null
      }
    });

    await tx.offer.updateMany({
      where: {
        id: { in: offerIds },
        status: "HELD"
      },
      data: {
        status: "OPEN"
      }
    });
  });

  await Promise.all(
    expiredHeldSlots.map((slot) =>
      createSystemAudit({
        entityType: "SLOT",
        entityId: slot.id,
        action: "slot_released",
        metadataJson: {
          reason: "hold_expired",
          offerId: slot.heldOfferId ?? null
        }
      })
    )
  );

  return {
    releasedCount: expiredHeldSlots.length
  };
}

async function expireOffer(offerId: string) {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: offerId },
      data: { status: "EXPIRED" }
    });

    await tx.accessToken.updateMany({
      where: {
        offerId,
        purpose: "BOOKING",
        revokedAt: null
      },
      data: {
        revokedAt: now
      }
    });

    await tx.calendarSlot.updateMany({
      where: {
        heldOfferId: offerId,
        status: "HELD",
        bookedAppointmentId: null
      },
      data: {
        status: "AVAILABLE",
        heldOfferId: null,
        holdExpiresAt: null
      }
    });
  });
}

function holdExpiresAt() {
  return new Date(Date.now() + env.DEFAULT_HELD_SLOT_TTL_MINUTES * 60 * 1000);
}

function mapSlotSummary(slot: Pick<CalendarSlot, "id" | "startsAt" | "endsAt" | "timezone" | "status" | "holdExpiresAt">) {
  return {
    id: slot.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    timezone: slot.timezone,
    status: slot.status,
    holdExpiresAt: slot.holdExpiresAt
  };
}

export async function getBookingPageContext(rawToken: string) {
  await releaseExpiredSlotHolds();
  const access = await resolveBookingAccess(rawToken);

  const [slots, currentHeldSlot, appointment] = await Promise.all([
    prisma.calendarSlot.findMany({
      where: {
        startsAt: { gte: new Date() },
        OR: [
          { status: "AVAILABLE" },
          {
            status: "HELD",
            heldOfferId: access.offer.id
          }
        ]
      },
      orderBy: { startsAt: "asc" },
      take: 24
    }),
    prisma.calendarSlot.findFirst({
      where: {
        heldOfferId: access.offer.id,
        status: "HELD"
      }
    }),
    prisma.appointment.findUnique({
      where: { offerId: access.offer.id }
    })
  ]);

  return {
    token: rawToken,
    offer: access.offer,
    patient: access.offer.application.patient,
    slots: slots.map(mapSlotSummary),
    heldSlot: currentHeldSlot ? mapSlotSummary(currentHeldSlot) : null,
    appointment: appointment
      ? {
          id: appointment.id,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          timezone: appointment.timezone,
          status: appointment.status
        }
      : null
  };
}

export async function holdBookingSlot(rawToken: string, slotId: string) {
  await releaseExpiredSlotHolds();
  const access = await resolveBookingAccess(rawToken);
  const nextHoldExpiresAt = holdExpiresAt();

  const result = await prisma.$transaction(async (tx) => {
    const targetSlot = await tx.calendarSlot.findUnique({
      where: { id: slotId },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        heldOfferId: true,
        bookedAppointmentId: true
      }
    });

    if (!targetSlot) {
      throw paymentError("Выбранный слот не найден.", 404);
    }

    if (targetSlot.startsAt <= new Date()) {
      throw paymentError("Этот слот уже прошёл. Пожалуйста, выберите другой.", 409);
    }

    if (targetSlot.bookedAppointmentId || targetSlot.status === "BOOKED") {
      throw paymentError("Этот слот уже недоступен. Пожалуйста, выберите другой.", 409);
    }

    if (targetSlot.status === "BLOCKED") {
      throw paymentError("Этот слот сейчас недоступен для записи. Пожалуйста, выберите другой.", 409);
    }

    if (targetSlot.status === "HELD" && targetSlot.heldOfferId !== access.offer.id) {
      throw paymentError("Этот слот сейчас удерживается другим пациентом. Пожалуйста, выберите другой.", 409);
    }

    await tx.calendarSlot.updateMany({
      where: {
        heldOfferId: access.offer.id,
        status: "HELD",
        id: { not: slotId },
        bookedAppointmentId: null
      },
      data: {
        status: "AVAILABLE",
        heldOfferId: null,
        holdExpiresAt: null
      }
    });

    const updateResult = await tx.calendarSlot.updateMany({
      where: {
        id: slotId,
        OR: [
          { status: "AVAILABLE" },
          { status: "HELD", heldOfferId: access.offer.id }
        ]
      },
      data: {
        status: "HELD",
        heldOfferId: access.offer.id,
        holdExpiresAt: nextHoldExpiresAt
      }
    });

    if (updateResult.count === 0) {
      throw paymentError("Не удалось удержать слот. Пожалуйста, выберите другой и повторите попытку.", 409);
    }

    await tx.offer.update({
      where: { id: access.offer.id },
      data: { status: "HELD" }
    });

    return {
      slot: {
        id: targetSlot.id,
        startsAt: targetSlot.startsAt,
        endsAt: targetSlot.endsAt,
        timezone: targetSlot.timezone
      },
      heldUntil: nextHoldExpiresAt
    };
  });

  await createSystemAudit({
    applicationId: access.offer.application.id,
    entityType: "SLOT",
    entityId: result.slot.id,
    action: "slot_held",
    metadataJson: {
      offerId: access.offer.id,
      heldUntil: result.heldUntil.toISOString()
    }
  });

  return result;
}

export async function createStripeCheckout(rawToken: string, slotId: string) {
  const hold = await holdBookingSlot(rawToken, slotId);
  const access = await resolveBookingAccess(rawToken);

  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: access.offer.application.patient.email,
    success_url: `${env.APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/booking/${rawToken}?cancelled=1`,
    expires_at: Math.floor(hold.heldUntil.getTime() / 1000),
    metadata: {
      offerId: access.offer.id,
      applicationId: access.offer.application.id,
      slotId: hold.slot.id
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: access.offer.currency.toLowerCase(),
          unit_amount: access.offer.amountCents,
          product_data: {
            name: productLabel(access.offer.productCode),
            description: `Персональная запись на ${hold.slot.startsAt.toISOString()}`
          }
        }
      }
    ]
  });

  if (!checkoutSession.url) {
    await stripe.checkout.sessions.expire(checkoutSession.id).catch(() => undefined);
    throw paymentError("Не удалось подготовить страницу оплаты. Пожалуйста, попробуйте ещё раз.", 502);
  }

  try {
    const payment = await prisma.payment.create({
      data: {
        applicationId: access.offer.application.id,
        offerId: access.offer.id,
        chargeModel: access.offer.chargeModel,
        amountCents: access.offer.amountCents,
        currency: access.offer.currency,
        provider: "stripe",
        externalPaymentId: checkoutSession.id,
        status: "PENDING"
      }
    });

    await createSystemAudit({
      applicationId: access.offer.application.id,
      entityType: "PAYMENT",
      entityId: payment.id,
      action: "payment_initiated",
      metadataJson: {
        offerId: access.offer.id,
        stripeSessionId: checkoutSession.id,
        slotId: hold.slot.id
      }
    });

    return {
      paymentId: payment.id,
      checkoutUrl: checkoutSession.url,
      heldUntil: hold.heldUntil,
      slot: hold.slot
    };
  } catch (error) {
    await stripe.checkout.sessions.expire(checkoutSession.id).catch(() => undefined);
    throw error;
  }
}

async function getPaymentByStripeSession(sessionId: string): Promise<PaymentWithRelations | null> {
  return prisma.payment.findUnique({
    where: { externalPaymentId: sessionId },
    include: {
      offer: {
        include: {
          application: {
            include: {
              patient: {
                select: {
                  fullName: true,
                  email: true,
                  timezone: true
                }
              }
            }
          }
        }
      },
      appointment: true
    }
  });
}

async function ensureAppointmentForPayment(tx: Prisma.TransactionClient, payment: PaymentWithRelations) {
  const existingAppointment = await tx.appointment.findUnique({
    where: { offerId: payment.offerId }
  });

  if (existingAppointment) {
    return existingAppointment;
  }

  const heldSlot = await tx.calendarSlot.findFirst({
    where: {
      heldOfferId: payment.offerId,
      status: "HELD"
    },
    orderBy: { startsAt: "asc" }
  });

  if (!heldSlot) {
    throw paymentError("Для оплаты не найден удержанный слот.", 409);
  }

  return tx.appointment.create({
    data: {
      applicationId: payment.applicationId,
      offerId: payment.offerId,
      startsAt: heldSlot.startsAt,
      endsAt: heldSlot.endsAt,
      timezone: heldSlot.timezone,
      status: "SCHEDULED"
    }
  });
}

export async function finalizeStripeCheckoutSession(sessionId: string) {
  const payment = await getPaymentByStripeSession(sessionId);

  if (!payment) {
    throw paymentError("Платёж не найден.", 404);
  }

  if (payment.status === "PAID") {
    return payment;
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const paymentRecord = await tx.payment.findUnique({
      where: { id: payment.id },
      include: {
        offer: {
          include: {
            application: {
              include: {
                patient: {
                  select: {
                    fullName: true,
                    email: true,
                    timezone: true
                  }
                }
              }
            }
          }
        },
        appointment: true
      }
    });

    if (!paymentRecord) {
      throw paymentError("Платёж не найден.", 404);
    }

    if (paymentRecord.status === "PAID") {
      return;
    }

    const appointment = await ensureAppointmentForPayment(tx, paymentRecord);

    await tx.calendarSlot.updateMany({
      where: {
        heldOfferId: paymentRecord.offerId,
        status: "HELD"
      },
      data: {
        status: "BOOKED",
        holdExpiresAt: null,
        heldOfferId: null,
        bookedAppointmentId: appointment.id
      }
    });

    await tx.payment.update({
      where: { id: paymentRecord.id },
      data: {
        status: "PAID",
        paidAt: now,
        appointmentId: appointment.id
      }
    });

    await tx.offer.update({
      where: { id: paymentRecord.offerId },
      data: {
        status: "PAID"
      }
    });

    await tx.application.update({
      where: { id: paymentRecord.applicationId },
      data: {
        status: "PAID",
        paidAt: now
      }
    });

    await tx.accessToken.updateMany({
      where: {
        offerId: paymentRecord.offerId,
        purpose: "BOOKING",
        revokedAt: null
      },
      data: {
        revokedAt: now,
        consumedAt: now
      }
    });
  });

  await createSystemAudit({
    applicationId: payment.applicationId,
    entityType: "PAYMENT",
    entityId: payment.id,
    action: "payment_paid",
    metadataJson: {
      stripeSessionId: sessionId
    }
  });

  await createSystemAudit({
    applicationId: payment.applicationId,
    entityType: "APPLICATION",
    entityId: payment.applicationId,
    action: "status_changed",
    metadataJson: {
      from: "BOOKING_SENT",
      to: "PAID"
    }
  });

  return getPaymentByStripeSession(sessionId);
}

export async function markStripeCheckoutFailed(
  sessionId: string,
  nextStatus: PaymentStatus = "FAILED"
) {
  const payment = await getPaymentByStripeSession(sessionId);

  if (!payment || payment.status === "PAID") {
    return payment;
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus
      }
    });

    await tx.offer.updateMany({
      where: {
        id: payment.offerId,
        status: "HELD"
      },
      data: {
        status: "OPEN"
      }
    });

    await tx.calendarSlot.updateMany({
      where: {
        heldOfferId: payment.offerId,
        status: "HELD",
        bookedAppointmentId: null
      },
      data: {
        status: "AVAILABLE",
        heldOfferId: null,
        holdExpiresAt: null
      }
    });
  });

  await createSystemAudit({
    applicationId: payment.applicationId,
    entityType: "PAYMENT",
    entityId: payment.id,
    action: nextStatus === "FAILED" ? "payment_failed" : "payment_refunded",
    metadataJson: {
      stripeSessionId: sessionId
    }
  });

  return getPaymentByStripeSession(sessionId);
}

export async function getPaymentSuccessContext(sessionId: string) {
  let payment = await getPaymentByStripeSession(sessionId);

  if (!payment) {
    return null;
  }

  if (payment.status !== "PAID") {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        payment = await finalizeStripeCheckoutSession(sessionId);
      }
    } catch {
      // Keep the payment in pending state if Stripe retrieval fails.
    }
  }

  return payment;
}

export async function listCalendarSlotsForAdmin() {
  await releaseExpiredSlotHolds();

  return prisma.calendarSlot.findMany({
    where: {
      startsAt: {
        gte: new Date(Date.now() - 12 * 60 * 60 * 1000)
      }
    },
    orderBy: { startsAt: "asc" },
    take: 60,
    include: {
      heldOffer: {
        select: {
          id: true,
          application: {
            select: {
              id: true,
              patient: {
                select: {
                  fullName: true,
                  email: true
                }
              }
            }
          }
        }
      },
      bookedAppointment: {
        select: {
          id: true,
          application: {
            select: {
              id: true,
              patient: {
                select: {
                  fullName: true,
                  email: true
                }
              }
            }
          }
        }
      }
    }
  });
}

export async function createCalendarSlot(input: {
  actor: StaffActor;
  startsAt: Date;
  durationMinutes: number;
  timezone: string;
}) {
  if (input.startsAt <= new Date()) {
    throw paymentError("Нельзя создать слот в прошлом.", 409);
  }

  const endsAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60 * 1000);

  const overlap = await prisma.calendarSlot.findFirst({
    where: {
      startsAt: { lt: endsAt },
      endsAt: { gt: input.startsAt }
    },
    select: { id: true }
  });

  if (overlap) {
    throw paymentError("Этот интервал пересекается с уже существующим слотом.", 409);
  }

  const slot = await prisma.calendarSlot.create({
    data: {
      startsAt: input.startsAt,
      endsAt,
      timezone: input.timezone,
      status: "AVAILABLE"
    }
  });

  await createStaffAudit({
    actor: input.actor,
    entityType: "SLOT",
    entityId: slot.id,
    action: "slot_created",
    metadataJson: {
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      timezone: slot.timezone
    }
  });

  return slot;
}

export async function updateCalendarSlotStatus(input: {
  actor: StaffActor;
  slotId: string;
  action: "block" | "release";
  note?: string;
}) {
  const slot = await prisma.calendarSlot.findUnique({
    where: { id: input.slotId }
  });

  if (!slot) {
    throw paymentError("Слот не найден.", 404);
  }

  if (input.action === "block") {
    if (slot.status !== "AVAILABLE") {
      throw paymentError("Заблокировать можно только доступный слот.", 409);
    }

    const updated = await prisma.calendarSlot.update({
      where: { id: slot.id },
      data: {
        status: "BLOCKED",
        blockedReason: input.note?.trim() || "Слот заблокирован вручную."
      }
    });

    await createStaffAudit({
      actor: input.actor,
      entityType: "SLOT",
      entityId: updated.id,
      action: "slot_blocked",
      metadataJson: {
        note: updated.blockedReason
      }
    });

    return updated;
  }

  if (slot.status !== "BLOCKED" && slot.status !== "HELD") {
    throw paymentError("Освободить можно только заблокированный или удержанный слот.", 409);
  }

  const updated = await prisma.calendarSlot.update({
    where: { id: slot.id },
    data: {
      status: "AVAILABLE",
      blockedReason: null,
      holdExpiresAt: null,
      heldOfferId: null
    }
  });

  if (slot.heldOfferId) {
    await prisma.offer.updateMany({
      where: {
        id: slot.heldOfferId,
        status: "HELD"
      },
      data: {
        status: "OPEN"
      }
    });
  }

  await createStaffAudit({
    actor: input.actor,
    entityType: "SLOT",
    entityId: updated.id,
    action: "slot_released",
    metadataJson: {
      previousStatus: slot.status
    }
  });

  return updated;
}

export function mapSlotStatusLabel(status: SlotStatus) {
  switch (status) {
    case "AVAILABLE":
      return "Доступен";
    case "HELD":
      return "Удержан";
    case "BOOKED":
      return "Забронирован";
    case "BLOCKED":
      return "Заблокирован";
    default:
      return status;
  }
}

export function mapPaymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "PENDING":
      return "Ожидает оплаты";
    case "PAID":
      return "Оплачено";
    case "FAILED":
      return "Не оплачено";
    case "REFUNDED":
      return "Возврат";
    default:
      return status;
  }
}

export function isStripeSignatureValid(rawBody: string, signature: string) {
  return getStripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await finalizeStripeCheckoutSession(event.data.object.id);
      return { handled: true };
    case "checkout.session.expired":
      await markStripeCheckoutFailed(event.data.object.id, "FAILED");
      return { handled: true };
    case "checkout.session.async_payment_failed":
      await markStripeCheckoutFailed(event.data.object.id, "FAILED");
      return { handled: true };
    default:
      return { handled: false };
  }
}
