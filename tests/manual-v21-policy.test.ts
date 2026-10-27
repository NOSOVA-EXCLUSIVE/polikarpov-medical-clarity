import assert from "node:assert/strict";
import test from "node:test";
import { addCalendarDays, canOpenManualContact, getManualPolicy, isManualAccessOpen, parseCallInterval, parseManualPolicy } from "../src/features/manual-v21/policy";

const now = new Date("2026-10-27T12:00:00Z");
test("support policies retain four/eight grouped contacts over28days", () => {
  assert.deepEqual(getManualPolicy("recovery-control"), { contactLimit: 4, packageDays: 28, clarificationDays: null, replyWorkingDays: 3, historyDays: 30 });
  assert.equal(getManualPolicy("personal-support").contactLimit, 8);
  assert.equal(getManualPolicy("initial-assessment").clarificationDays, null);
  assert.equal(getManualPolicy("second-opinion").clarificationDays, 7);
});
test("quota reserves open blocks, deniesexpiry and preservesdeadline boundaries", () => {
  const input = { phase: "ACTIVE", policy: getManualPolicy("recovery-control"), contactCount: 3, hasOpenContact: false, workEndsAt: addCalendarDays(now, 1), resultDeliveredAt: null };
  assert.equal(canOpenManualContact(input, now), true);
  assert.equal(canOpenManualContact({ ...input, contactCount: 4 }, now), false);
  assert.equal(canOpenManualContact({ ...input, hasOpenContact: true }, now), false);
  assert.equal(canOpenManualContact({ ...input, workEndsAt: now }, now), false);
});
test("clarificationwindow starts at resultdelivery, notpayment/start", () => {
  const input = { phase: "ACTIVE", policy: getManualPolicy("second-opinion"), contactCount: 0, hasOpenContact: false, workEndsAt: null, resultDeliveredAt: null };
  assert.equal(canOpenManualContact(input, now), false);
  assert.equal(canOpenManualContact({ ...input, resultDeliveredAt: now }, now), true);
  assert.equal(canOpenManualContact({ ...input, resultDeliveredAt: addCalendarDays(now, -7) }, now), false);
});
test("doctorrecordedextensionusesthevisibleeffectiveendwithoutaddingcontacts", () => {
  const input = { phase: "ACTIVE", policy: getManualPolicy("second-opinion"), contactCount: 0, hasOpenContact: false, workEndsAt: addCalendarDays(now, 2), resultDeliveredAt: addCalendarDays(now, -8) };
  assert.equal(canOpenManualContact(input, now), true);
  assert.equal(canOpenManualContact({ ...input, contactCount: 1 }, now), false);
  assert.equal(canOpenManualContact({ ...input, workEndsAt: now }, now), false);
});
test("read-only history expires exactly30dayswithoutimplying deletion", () => {
  assert.equal(isManualAccessOpen({ completedAt: null, patientAccessEndsAt: null }, now), true);
  assert.equal(isManualAccessOpen({ completedAt: addCalendarDays(now, -29), patientAccessEndsAt: addCalendarDays(now, 1) }, now), true);
  assert.equal(isManualAccessOpen({ completedAt: addCalendarDays(now, -30), patientAccessEndsAt: now }, now), false);
});
test("call requires explicitUTCoffset and validIANAzone", () => {
  assert.equal(parseCallInterval({ startsAt: "2026-10-28T15:00:00+03:00", endsAt: "2026-10-28T15:30:00+03:00", timezone: "Europe/Moscow" }).startsAt.toISOString(), "2026-10-28T12:00:00.000Z");
  assert.throws(() => parseCallInterval({ startsAt: "2026-10-28T15:00", endsAt: "2026-10-28T15:30", timezone: "Europe/Moscow" }), /OFFSET/);
  assert.throws(() => parseCallInterval({ startsAt: "2026-10-28T15:00:00Z", endsAt: "2026-10-28T15:30:00Z", timezone: "Invalid/Zone" }), /TIMEZONE/);
});
test("malformedsavedpolicy failsclosed", () => {
  assert.throws(() => parseManualPolicy({ contactLimit: 999 }), /INVALID/);
  assert.deepEqual(parseManualPolicy(getManualPolicy("second-opinion")), getManualPolicy("second-opinion"));
});
