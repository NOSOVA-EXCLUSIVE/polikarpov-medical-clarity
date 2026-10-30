import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { attachApplicationDisplayNumbers } from "@/features/applications/display-number";
import { isManualAccessOpen } from "@/features/manual-v21/policy";
import { assertTimeZone, getMonthBounds, localDateTimeToUtc, nextDate } from "./time";

type Tx = Prisma.TransactionClient;
type Actor = { id: string; role?: string };
type Interval = { startsAt: Date; endsAt: Date };

function fail(code: string): never { throw Object.assign(new Error(code), { status: 409 }); }

/** All legacy and preliminary calendar writes take this same transaction lock first. */
export async function lockCalendar(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(1296251221, 20261030)`;
}

export async function withCalendarTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => { await lockCalendar(tx); return work(tx); },
        { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
    } catch (error) {
      // Only a known rolled-back serialization conflict is replayed; no mail or external effects live here.
      if (attempt < 2 && error && typeof error === "object" && "code" in error && error.code === "P2034") continue;
      throw error;
    }
  }
}

async function requireActor(tx: Tx, actor: Actor) {
  const user = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true, role: true, isActive: true } });
  if (!user?.isActive || !["ADMIN", "DOCTOR"].includes(user.role)) fail("CALENDAR_STAFF_REQUIRED");
  return user;
}

function validInterval(interval: Interval) {
  if (!Number.isFinite(interval.startsAt.getTime()) || !Number.isFinite(interval.endsAt.getTime()) || interval.endsAt <= interval.startsAt) fail("CALENDAR_INTERVAL_INVALID");
}

const overlap = (interval: Interval) => ({ startsAt: { lt: interval.endsAt }, endsAt: { gt: interval.startsAt } });
const manualOverlap = (interval: Interval) => ({
  callStartsAt: { lt: interval.endsAt }, callEndsAt: { gt: interval.startsAt },
  application: { status: { notIn: ["ARCHIVED", "REJECTED"] } }
});

/** Must be called under the shared calendar lock. Existing unslotted v2.1 calls also occupy time. */
export async function assertCalendarIntervalFree(tx: Tx, input: Interval & {
  excludePreliminarySlotId?: string; excludeLegacySlotId?: string; excludeCaseId?: string;
  allowLegacyAvailable?: boolean;
}) {
  validInterval(input);
  const [preliminary, legacy, appointment, manual] = await Promise.all([
    tx.preliminarySlot.findFirst({ where: { ...overlap(input), ...(input.excludePreliminarySlotId ? { id: { not: input.excludePreliminarySlotId } } : {}) }, select: { id: true } }),
    tx.calendarSlot.findFirst({ where: { ...overlap(input), ...(input.excludeLegacySlotId ? { id: { not: input.excludeLegacySlotId } } : {}), ...(input.allowLegacyAvailable ? { status: { not: "AVAILABLE" } } : {}) }, select: { id: true } }),
    tx.appointment.findFirst({ where: { ...overlap(input), status: "SCHEDULED" }, select: { id: true } }),
    tx.manualCase.findFirst({ where: { ...manualOverlap(input), ...(input.excludeCaseId ? { id: { not: input.excludeCaseId } } : {}) }, select: { id: true } })
  ]);
  if (preliminary || legacy || appointment || manual) fail("CALENDAR_INTERVAL_OCCUPIED");
}

async function audit(tx: Tx, input: { action: string; actorId?: string; applicationId?: string; slotId: string; metadata?: Record<string, string | number | boolean | null> }) {
  await tx.auditEvent.create({ data: { actorType: input.actorId ? "USER" : "PATIENT", actorUserId: input.actorId,
    applicationId: input.applicationId, entityType: "SLOT", entityId: input.slotId,
    action: `preliminary_slot_${input.action}`, metadataJson: input.metadata ?? {} } });
}

export async function openPreliminarySlots(input: {
  actor: Actor; dates: string[]; startTime: string; endTime: string; durationMinutes: number; timezone: string;
}) {
  assertTimeZone(input.timezone);
  if (!Array.isArray(input.dates) || !input.dates.length || input.dates.length > 31 || new Set(input.dates).size !== input.dates.length) fail("CALENDAR_DATES_INVALID");
  if (input.dates.some((date) => date.slice(0, 7) !== input.dates[0].slice(0, 7))) fail("CALENDAR_DATES_INVALID");
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 240) fail("CALENDAR_DURATION_INVALID");
  const intervals: Interval[] = [];
  for (const date of input.dates) {
    const from = localDateTimeToUtc(date, input.startTime, input.timezone);
    const to = localDateTimeToUtc(date, input.endTime, input.timezone);
    const step = input.durationMinutes * 60_000;
    const wallMinutes = (Number(input.endTime.slice(0, 2)) * 60 + Number(input.endTime.slice(3))) -
      (Number(input.startTime.slice(0, 2)) * 60 + Number(input.startTime.slice(3)));
    if (to.getTime() - from.getTime() !== wallMinutes * 60_000) fail("CALENDAR_WINDOW_DST_TRANSITION");
    if (to <= from || (to.getTime() - from.getTime()) % step !== 0) fail("CALENDAR_WINDOW_INVALID");
    for (let value = from.getTime(); value < to.getTime(); value += step) {
      intervals.push({ startsAt: new Date(value), endsAt: new Date(value + step) });
    }
  }
  if (intervals.length > 2000) fail("CALENDAR_BATCH_TOO_LARGE");
  const now = new Date();
  if (intervals.some((interval) => interval.startsAt <= now)) fail("CALENDAR_FUTURE_REQUIRED");
  return withCalendarTransaction(async (tx) => {
    const actor = await requireActor(tx, input.actor);
    if (intervals.some((interval) => interval.startsAt <= new Date())) fail("CALENDAR_FUTURE_REQUIRED");
    const range = { startsAt: new Date(Math.min(...intervals.map((entry) => entry.startsAt.getTime()))),
      endsAt: new Date(Math.max(...intervals.map((entry) => entry.endsAt.getTime()))) };
    const [preliminary, legacy, appointments, calls] = await Promise.all([
      tx.preliminarySlot.findMany({ where: overlap(range), select: { startsAt: true, endsAt: true } }),
      tx.calendarSlot.findMany({ where: overlap(range), select: { startsAt: true, endsAt: true } }),
      tx.appointment.findMany({ where: { ...overlap(range), status: "SCHEDULED" }, select: { startsAt: true, endsAt: true } }),
      tx.manualCase.findMany({ where: manualOverlap(range), select: { callStartsAt: true, callEndsAt: true } })
    ]);
    const occupied = [...preliminary, ...legacy, ...appointments,
      ...calls.flatMap((entry) => entry.callStartsAt && entry.callEndsAt ? [{ startsAt: entry.callStartsAt, endsAt: entry.callEndsAt }] : [])];
    if (intervals.some((interval) => occupied.some((entry) => intersects(interval, entry)))) fail("CALENDAR_INTERVAL_OCCUPIED");
    const createdAt = new Date();
    const rows = intervals.map((interval) => ({ id: randomUUID(), ...interval, timezone: input.timezone,
      status: "AVAILABLE" as const, caseId: null, createdAt, updatedAt: createdAt }));
    const created = await tx.preliminarySlot.createMany({ data: rows });
    if (created.count !== rows.length) fail("CALENDAR_SLOT_CHANGED");
    await tx.auditEvent.createMany({ data: rows.map((slot) => ({ actorType: "USER" as const, actorUserId: actor.id,
      entityType: "SLOT" as const, entityId: slot.id, action: "preliminary_slot_opened",
      metadataJson: { startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(), timezone: slot.timezone } })) });
    return rows.map((slot) => ({ id: slot.id, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(), timezone: slot.timezone }));
  });
}

export async function changePreliminarySlot(input: { actor: Actor; slotId: string; action: "block" | "release"; note?: string }) {
  return withCalendarTransaction(async (tx) => {
    const actor = await requireActor(tx, input.actor);
    const slot = await tx.preliminarySlot.findUnique({ where: { id: input.slotId } });
    if (!slot) fail("CALENDAR_SLOT_NOT_FOUND");
    const from = input.action === "block" ? "AVAILABLE" : "BLOCKED";
    if (slot.status !== from || slot.caseId) fail("CALENDAR_SLOT_RESERVED");
    const changed = await tx.preliminarySlot.updateMany({ where: { id: slot.id, status: from, caseId: null }, data: { status: input.action === "block" ? "BLOCKED" : "AVAILABLE" } });
    if (changed.count !== 1) fail("CALENDAR_SLOT_CHANGED");
    await audit(tx, { action: input.action === "block" ? "blocked" : "released", actorId: actor.id, slotId: slot.id,
      metadata: { priorStatus: slot.status, reason: input.note?.trim().slice(0, 500) || null } });
    return { id: slot.id };
  });
}

/** The target is conditionally claimed before the previous reservation is released; rollback retains both. */
export async function reservePreliminarySlot(tx: Tx, input: { caseId: string; slotId: string; now?: Date }) {
  const slot = await tx.preliminarySlot.findUnique({ where: { id: input.slotId } });
  if (!slot) fail("CALENDAR_SLOT_NOT_FOUND");
  if (slot.startsAt <= (input.now ?? new Date())) fail("CALENDAR_FUTURE_REQUIRED");
  if (slot.caseId === input.caseId && ["PENDING", "CONFIRMED"].includes(slot.status)) {
    await assertCalendarIntervalFree(tx, { ...slot, excludePreliminarySlotId: slot.id, excludeCaseId: input.caseId });
    const unchanged = await tx.preliminarySlot.updateMany({ where: { id: slot.id, caseId: input.caseId, status: slot.status }, data: { status: slot.status } });
    if (unchanged.count !== 1) fail("CALENDAR_SLOT_CHANGED");
    return slot;
  }
  if (slot.status !== "AVAILABLE" || slot.caseId) fail("CALENDAR_SLOT_UNAVAILABLE");
  await assertCalendarIntervalFree(tx, { ...slot, excludePreliminarySlotId: slot.id, excludeCaseId: input.caseId });
  // A temporary transaction-local BLOCKED state allows the caseId uniqueness constraint to remain immediate.
  const claim = await tx.preliminarySlot.updateMany({ where: { id: slot.id, status: "AVAILABLE", caseId: null }, data: { status: "BLOCKED" } });
  if (claim.count !== 1) fail("CALENDAR_SLOT_UNAVAILABLE");
  const previous = await tx.preliminarySlot.findUnique({ where: { caseId: input.caseId } });
  if (previous) {
    const released = await tx.preliminarySlot.updateMany({ where: { id: previous.id, caseId: input.caseId, status: { in: ["PENDING", "CONFIRMED"] } }, data: { status: "AVAILABLE", caseId: null } });
    if (released.count !== 1) fail("CALENDAR_SLOT_CHANGED");
  }
  const assigned = await tx.preliminarySlot.updateMany({ where: { id: slot.id, status: "BLOCKED", caseId: null }, data: { status: "PENDING", caseId: input.caseId } });
  if (assigned.count !== 1) fail("CALENDAR_SLOT_CHANGED");
  return { ...slot, status: "PENDING" as const, caseId: input.caseId };
}

export async function confirmPreliminarySlot(tx: Tx, input: { caseId: string; startsAt: Date; endsAt: Date }) {
  const slot = await tx.preliminarySlot.findUnique({ where: { caseId: input.caseId } });
  // A pre-calendar call remains valid without inventing a new slot or modifying its historical time.
  if (!slot) {
    await assertCalendarIntervalFree(tx, { ...input, excludeCaseId: input.caseId, allowLegacyAvailable: true });
    return null;
  }
  if (!["PENDING", "CONFIRMED"].includes(slot.status) || slot.startsAt.getTime() !== input.startsAt.getTime() || slot.endsAt.getTime() !== input.endsAt.getTime()) fail("CALENDAR_SLOT_CHANGED");
  await assertCalendarIntervalFree(tx, { ...slot, excludePreliminarySlotId: slot.id, excludeCaseId: input.caseId });
  const changed = await tx.preliminarySlot.updateMany({ where: { id: slot.id, caseId: input.caseId, status: slot.status }, data: { status: "CONFIRMED" } });
  if (changed.count !== 1) fail("CALENDAR_SLOT_CHANGED");
  return slot;
}

export async function releasePreliminarySlot(tx: Tx, input: { caseId: string; slotId?: string }) {
  const slot = await tx.preliminarySlot.findUnique({ where: { caseId: input.caseId } });
  if (!slot) { if (input.slotId) fail("CALENDAR_SLOT_CHANGED"); return null; }
  if (input.slotId && slot.id !== input.slotId) fail("CALENDAR_SLOT_CHANGED");
  const changed = await tx.preliminarySlot.updateMany({ where: { id: slot.id, caseId: input.caseId, status: { in: ["PENDING", "CONFIRMED"] } }, data: { status: "AVAILABLE", caseId: null } });
  if (changed.count !== 1) fail("CALENDAR_SLOT_CHANGED");
  return slot;
}

function intersects(a: Interval, b: Interval) { return a.startsAt < b.endsAt && a.endsAt > b.startsAt; }

/** Hide availability which predates an existing manual call; the write path repeats this check under lock. */
export async function filterLegacySlotsForPatient<T extends Interval>(slots: T[]): Promise<T[]> {
  if (!slots.length) return [];
  const range = { startsAt: new Date(Math.min(...slots.map((slot) => slot.startsAt.getTime()))),
    endsAt: new Date(Math.max(...slots.map((slot) => slot.endsAt.getTime()))) };
  const [preliminary, appointments, calls] = await Promise.all([
    prisma.preliminarySlot.findMany({ where: overlap(range), select: { startsAt: true, endsAt: true } }),
    prisma.appointment.findMany({ where: { ...overlap(range), status: "SCHEDULED" }, select: { startsAt: true, endsAt: true } }),
    prisma.manualCase.findMany({ where: manualOverlap(range), select: { callStartsAt: true, callEndsAt: true } })
  ]);
  const occupied = [...preliminary, ...appointments, ...calls.flatMap((entry) => entry.callStartsAt && entry.callEndsAt ? [{ startsAt: entry.callStartsAt, endsAt: entry.callEndsAt }] : [])];
  return slots.filter((slot) => !occupied.some((entry) => intersects(slot, entry)));
}

export async function getAvailablePreliminarySlots(caseId: string) {
  const record = await prisma.manualCase.findUnique({ where: { id: caseId }, include: { application: { select: { status: true } } } });
  if (!record || ["ARCHIVED", "REJECTED"].includes(record.application.status) || !isManualAccessOpen(record, new Date())) fail("CALENDAR_CASE_UNAVAILABLE");
  if (!["REVIEW", "CALL_REQUESTED", "CALL_CONFIRMED"].includes(record.phase)) return [];
  const now = new Date();
  const horizon = new Date(now.getTime() + 366 * 86_400_000);
  const [slots, legacy, appointments, manual] = await Promise.all([
    prisma.preliminarySlot.findMany({ where: { OR: [{ status: "AVAILABLE", caseId: null, startsAt: { gt: now, lt: horizon } }, { caseId }] }, orderBy: { startsAt: "asc" }, take: 2001 }),
    prisma.calendarSlot.findMany({ where: { startsAt: { lt: horizon }, endsAt: { gt: now } }, select: { startsAt: true, endsAt: true } }),
    prisma.appointment.findMany({ where: { status: "SCHEDULED", startsAt: { lt: horizon }, endsAt: { gt: now } }, select: { startsAt: true, endsAt: true } }),
    prisma.manualCase.findMany({ where: { ...manualOverlap({ startsAt: now, endsAt: horizon }), id: { not: caseId } }, select: { callStartsAt: true, callEndsAt: true } })
  ]);
  if (slots.length > 2000) fail("CALENDAR_TOO_MANY_SLOTS");
  const occupied = [...legacy, ...appointments, ...manual.flatMap((entry) => entry.callStartsAt && entry.callEndsAt ? [{ startsAt: entry.callStartsAt, endsAt: entry.callEndsAt }] : [])];
  return slots.filter((slot) => slot.caseId === caseId || !occupied.some((entry) => intersects(slot, entry))).map((slot) => ({
    id: slot.id, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(), timezone: slot.timezone,
    status: slot.status, own: slot.caseId === caseId
  }));
}

export async function getPatientAvailableSlots(caseId: string, grantId: string) {
  const now = new Date();
  const grant = await prisma.manualGrant.findFirst({ where: { id: grantId, caseId, revokedAt: null, expiresAt: { gt: now },
    case: { application: { status: { notIn: ["ARCHIVED", "REJECTED"] } } } }, select: { id: true } });
  if (!grant) fail("CALENDAR_ACCESS_DENIED");
  return getAvailablePreliminarySlots(caseId);
}

type CalendarEvent = { id: string; startsAt: string; endsAt: string; timezone: string;
  status: "AVAILABLE" | "PENDING" | "CONFIRMED" | "BLOCKED" | "LEGACY_HELD" | "LEGACY_BOOKED";
  kind: "PRELIMINARY" | "LEGACY"; caseId?: string; patientName?: string; applicationId?: string;
  displayNumber?: string; editable: boolean };

export async function getAdminCalendarMonth(input: { month?: string; timezone?: string; timeZone?: string } = {}) {
  const range = getMonthBounds(input.month, input.timezone ?? input.timeZone ?? "Europe/Moscow");
  const where = overlap({ startsAt: range.start, endsAt: range.end });
  const application = { select: { id: true, submittedAt: true, patient: { select: { fullName: true } } } } as const;
  const [preliminary, legacy, calls, appointments] = await Promise.all([
    prisma.preliminarySlot.findMany({ where, include: { case: { select: { id: true, application } } }, orderBy: { startsAt: "asc" } }),
    prisma.calendarSlot.findMany({ where, include: { heldOffer: { select: { application } }, bookedAppointment: { select: { id: true, application } } }, orderBy: { startsAt: "asc" } }),
    prisma.manualCase.findMany({ where: { ...manualOverlap({ startsAt: range.start, endsAt: range.end }), preliminarySlot: { is: null } }, select: { id: true, callStartsAt: true, callEndsAt: true, callTimezone: true, callConfirmedAt: true, application } }),
    prisma.appointment.findMany({ where: { ...where, status: "SCHEDULED", slot: { is: null } }, select: { id: true, startsAt: true, endsAt: true, timezone: true, application } })
  ]);
  const related = [...preliminary.flatMap((slot) => slot.case ? [slot.case.application] : []),
    ...legacy.flatMap((slot) => [slot.heldOffer?.application, slot.bookedAppointment?.application].filter((value): value is NonNullable<typeof value> => Boolean(value))),
    ...calls.map((call) => call.application), ...appointments.map((entry) => entry.application)];
  const numbered = await attachApplicationDisplayNumbers([...new Map(related.map((entry) => [entry.id, entry])).values()]);
  const numbers = new Map(numbered.map((entry) => [entry.id, entry.displayNumber]));
  const owner = (entry?: { id: string; patient: { fullName: string } } | null) => entry ? {
    applicationId: entry.id, patientName: entry.patient.fullName, displayNumber: numbers.get(entry.id) ?? entry.id
  } : {};
  const events: CalendarEvent[] = [
    ...preliminary.map((slot): CalendarEvent => ({ id: slot.id, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(), timezone: slot.timezone, status: slot.status, kind: "PRELIMINARY", editable: !slot.caseId, ...(slot.caseId ? { caseId: slot.caseId } : {}), ...owner(slot.case?.application) })),
    ...legacy.map((slot): CalendarEvent => {
      const expired = slot.status === "HELD" && slot.holdExpiresAt && slot.holdExpiresAt <= new Date();
      const status: CalendarEvent["status"] = expired ? "AVAILABLE" : slot.status === "HELD" ? "LEGACY_HELD" : slot.status === "BOOKED" ? "LEGACY_BOOKED" : slot.status;
      return { id: slot.id, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(), timezone: slot.timezone,
        status, kind: "LEGACY", editable: false, ...owner(expired ? null : slot.heldOffer?.application ?? slot.bookedAppointment?.application) };
    }),
    ...calls.flatMap((call): CalendarEvent[] => call.callStartsAt && call.callEndsAt ? [{ id: `existing-call:${call.id}`, startsAt: call.callStartsAt.toISOString(), endsAt: call.callEndsAt.toISOString(), timezone: call.callTimezone ?? range.timeZone, status: call.callConfirmedAt ? "CONFIRMED" : "PENDING", kind: "PRELIMINARY", caseId: call.id, editable: false, ...owner(call.application) }] : []),
    ...appointments.map((entry): CalendarEvent => ({ id: `existing-appointment:${entry.id}`, startsAt: entry.startsAt.toISOString(), endsAt: entry.endsAt.toISOString(), timezone: entry.timezone, status: "LEGACY_BOOKED", kind: "LEGACY", editable: false, ...owner(entry.application) }))
  ];
  // Existing unslotted calls can overlap old AVAILABLE slots; show the real occupied state, not false availability.
  for (const event of events) if (event.kind === "LEGACY" && event.status === "AVAILABLE" && events.some((other) => other.kind === "PRELIMINARY" && ["PENDING", "CONFIRMED"].includes(other.status) && intersects({ startsAt: new Date(event.startsAt), endsAt: new Date(event.endsAt) }, { startsAt: new Date(other.startsAt), endsAt: new Date(other.endsAt) }))) event.status = "BLOCKED";
  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  return { month: range.month, timeZone: range.timeZone, days: range.days.map((date) => {
    const start = localDateTimeToUtc(date, "00:00", range.timeZone);
    const end = localDateTimeToUtc(nextDate(date), "00:00", range.timeZone);
    return { date, slots: events.filter((event) => new Date(event.startsAt) < end && new Date(event.endsAt) > start) };
  }) };
}
