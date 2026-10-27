export type ManualPolicy = {
  contactLimit: number;
  packageDays: number | null;
  clarificationDays: number | null;
  replyWorkingDays: 3;
  historyDays: 30;
};

export function getManualPolicy(serviceId: string): ManualPolicy {
  const base = { replyWorkingDays: 3 as const, historyDays: 30 as const };
  if (serviceId === "recovery-control") return { ...base, contactLimit: 4, packageDays: 28, clarificationDays: null };
  if (serviceId === "personal-support") return { ...base, contactLimit: 8, packageDays: 28, clarificationDays: null };
  if (serviceId === "second-opinion") return { ...base, contactLimit: 1, packageDays: null, clarificationDays: 7 };
  if (serviceId === "clinical-review") return { ...base, contactLimit: 1, packageDays: null, clarificationDays: null };
  return { ...base, contactLimit: 0, packageDays: null, clarificationDays: null };
}

export function parseManualPolicy(value: unknown): ManualPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("MANUAL_POLICY_INVALID");
  const p = value as Record<string, unknown>;
  if (!Number.isInteger(p.contactLimit) || ![0, 1, 4, 8].includes(p.contactLimit as number) ||
      !(p.packageDays === null || p.packageDays === 28) ||
      !(p.clarificationDays === null || (Number.isInteger(p.clarificationDays) && Number(p.clarificationDays) >= 1 && Number(p.clarificationDays) <= 30)) || p.replyWorkingDays !== 3 || p.historyDays !== 30) {
    throw new Error("MANUAL_POLICY_INVALID");
  }
  return { contactLimit: p.contactLimit as number, packageDays: p.packageDays as number | null,
    clarificationDays: p.clarificationDays as number | null, replyWorkingDays: 3, historyDays: 30 };
}

export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function isManualAccessOpen(input: { completedAt: Date | null; patientAccessEndsAt: Date | null }, now = new Date()): boolean {
  return !input.completedAt || Boolean(input.patientAccessEndsAt && input.patientAccessEndsAt.getTime() > now.getTime());
}

export function canOpenManualContact(input: {
  phase: string; policy: ManualPolicy; contactCount: number; hasOpenContact: boolean;
  workEndsAt: Date | null; resultDeliveredAt: Date | null;
}, now = new Date()): boolean {
  if (input.phase !== "ACTIVE" || input.hasOpenContact || input.contactCount >= input.policy.contactLimit) return false;
  if (input.policy.packageDays) return Boolean(input.workEndsAt && now < input.workEndsAt);
  if (!input.resultDeliveredAt) return false;
  if (input.workEndsAt) return now < input.workEndsAt;
  return !input.policy.clarificationDays || now < addCalendarDays(input.resultDeliveredAt, input.policy.clarificationDays);
}

/** Dates must carry an offset; a server-local datetime is never accepted. */
export function parseCallInterval(input: { startsAt: string; endsAt: string; timezone: string }) {
  const explicitOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!explicitOffset.test(input.startsAt) || !explicitOffset.test(input.endsAt)) throw new Error("CALL_OFFSET_REQUIRED");
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 4 * 3_600_000) throw new Error("CALL_INTERVAL_INVALID");
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(startsAt); }
  catch { throw new Error("CALL_TIMEZONE_INVALID"); }
  return { startsAt, endsAt, timezone: input.timezone };
}
