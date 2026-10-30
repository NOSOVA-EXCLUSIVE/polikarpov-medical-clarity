// Calendar source regressions execute only in the pinned Preview build, through
// explicit fake database/auth boundaries. No application, .env, real Prisma,
// network, storage or mail SDK is loaded. These verify application guards and
// projections; they do not prove PostgreSQL transaction/concurrency behavior.
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const zod = require("zod");
const base = path.resolve(__dirname, "..");

function sourceLoader(permitted = {}) {
  const cache = new Map();
  const mapped = {
    "./time": "src/features/calendar/time.ts",
    "./policy": "src/features/manual-v21/policy.ts",
    "./schemas": "src/features/manual-v21/schemas.ts",
    "@/features/calendar/time": "src/features/calendar/time.ts",
    "@/features/calendar/service": "src/features/calendar/service.ts",
    "@/features/products/services-v21": "src/features/products/services-v21.ts",
    "@/features/questionnaire/service-selection": "src/features/questionnaire/service-selection.ts"
  };
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const compiled = ts.transpileModule(fs.readFileSync(path.join(base, relative), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      reportDiagnostics: true
    });
    const diagnostics = (compiled.diagnostics || []).filter(entry => entry.category === ts.DiagnosticCategory.Error);
    assert.equal(diagnostics.length, 0, `Calendar source must parse: ${relative}`);
    const exports = {};
    cache.set(relative, exports);
    vm.runInNewContext(compiled.outputText, {
      exports, URL, Date, Intl, Buffer, Promise, Map, Set,
      process: { env: {} },
      console: { warn() {}, error() {} },
      require(name) {
        if (Object.hasOwn(permitted, name)) return permitted[name];
        if (name === "server-only") return {};
        if (mapped[name]) return load(mapped[name]);
        throw new Error(`UNEXPECTED_IMPORT:${name}`);
      }
    }, { filename: relative, timeout: 2000 });
    return exports;
  }
  return load;
}

const time = sourceLoader()("src/features/calendar/time.ts");

test("doctor local time converts to UTC independently of the server timezone", () => {
  assert.equal(time.localDateTimeToUtc("2031-11-02", "10:00", "Europe/Moscow").toISOString(), "2031-11-02T07:00:00.000Z");
  assert.equal(time.localDateTimeToUtc("2031-11-02", "00:15", "Pacific/Kiritimati").toISOString(), "2031-11-01T10:15:00.000Z");
  assert.equal(time.dateKeyInZone(new Date("2031-11-01T10:15:00Z"), "Pacific/Kiritimati"), "2031-11-02");
});

test("invalid dates, times and zones are rejected instead of silently normalized", () => {
  for (const [date, clock, zone] of [
    ["2031-02-30", "10:00", "Europe/Moscow"],
    ["2031-11-02", "24:00", "Europe/Moscow"],
    ["2031-11-02", "10:99", "Europe/Moscow"],
    ["2031-11-02", "10:00", "Not/A_Real_Zone"],
    ["2031-11-02", "10:00", ""]
  ]) assert.throws(() => time.localDateTimeToUtc(date, clock, zone));
});

test("DST gaps and repeated local times require an unambiguous selection", () => {
  assert.throws(() => time.localDateTimeToUtc("2026-03-08", "02:30", "America/New_York"));
  assert.throws(() => time.localDateTimeToUtc("2026-11-01", "01:30", "America/New_York"));
  assert.equal(time.localDateTimeToUtc("2026-03-08", "03:30", "America/New_York").toISOString(), "2026-03-08T07:30:00.000Z");
});

test("month boundaries include every local calendar day and respect DST offset changes", () => {
  const march = time.getMonthBounds("2026-03", "Europe/London");
  assert.equal(march.start.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(march.end.toISOString(), "2026-03-31T23:00:00.000Z");
  assert.equal(march.days.length, 31);
  assert.equal(march.days[0], "2026-03-01");
  assert.equal(march.days[30], "2026-03-31");
  const february = time.getMonthBounds("2028-02", "Europe/Moscow");
  assert.equal(february.days.length, 29);
  assert.throws(() => time.getMonthBounds("2031-13", "Europe/Moscow"));
});

function comparable(value) { return value instanceof Date ? value.getTime() : value; }
function matches(row, where = {}) {
  if (!row) return false;
  for (const [key, expected] of Object.entries(where)) {
    if (key === "AND") {
      if (!(Array.isArray(expected) ? expected : [expected]).every(clause => matches(row, clause))) return false;
      continue;
    }
    if (key === "OR") {
      if (!expected.some(clause => matches(row, clause))) return false;
      continue;
    }
    if (key === "NOT") {
      if ((Array.isArray(expected) ? expected : [expected]).some(clause => matches(row, clause))) return false;
      continue;
    }
    const value = row[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date) && !Array.isArray(expected)) {
      for (const [op, right] of Object.entries(expected)) {
        const leftValue = comparable(value); const rightValue = comparable(right);
        if (op === "equals" && leftValue !== rightValue) return false;
        else if (op === "not") {
          if (right && typeof right === "object") {
            if (matches({ value }, { value: right })) return false;
          } else if (leftValue === rightValue) return false;
        }
        else if (op === "in" && !right.includes(value)) return false;
        else if (op === "notIn" && right.includes(value)) return false;
        else if (op === "gt" && !(leftValue > rightValue)) return false;
        else if (op === "gte" && !(leftValue >= rightValue)) return false;
        else if (op === "lt" && !(leftValue < rightValue)) return false;
        else if (op === "lte" && !(leftValue <= rightValue)) return false;
        else if (op === "is" && (right === null ? value != null : !matches(value, right))) return false;
        else if (op === "isNot" && (right === null ? value == null : matches(value, right))) return false;
        else if (!["equals", "not", "in", "notIn", "gt", "gte", "lt", "lte", "is", "isNot"].includes(op)) {
          if (!matches(value, { [op]: right })) return false;
        }
      }
    } else if (comparable(value) !== comparable(expected)) return false;
  }
  return true;
}

function calendarFixture(overrides = {}) {
  const state = {
    preliminarySlot: [], calendarSlot: [], appointment: [], manualCase: [], manualGrant: [],
    user: [{ id: "synthetic-doctor", role: "DOCTOR", isActive: true }],
    auditEvent: [], queries: [], writes: [], locks: [], transactions: [],
    ...overrides
  };
  const tx = {};
  for (const model of ["preliminarySlot", "calendarSlot", "appointment", "manualCase", "manualGrant", "user", "auditEvent"]) {
    const selectRows = args => {
      state.queries.push({ model, args: structuredClone(args || {}) });
      let rows = state[model].filter(row => matches(row, args?.where));
      if (args?.orderBy) {
        const orders = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
        rows = [...rows].sort((a, b) => {
          for (const order of orders) for (const [key, direction] of Object.entries(order)) {
            if (comparable(a[key]) < comparable(b[key])) return direction === "desc" ? 1 : -1;
            if (comparable(a[key]) > comparable(b[key])) return direction === "desc" ? -1 : 1;
          }
          return 0;
        });
      }
      if (typeof args?.take === "number") rows = rows.slice(0, args.take);
      return rows.map(row => structuredClone(row));
    };
    tx[model] = {
      findMany: async args => selectRows(args),
      findFirst: async args => selectRows(args)[0] ?? null,
      findUnique: async args => selectRows(args)[0] ?? null,
      findUniqueOrThrow: async args => {
        const row = selectRows(args)[0];
        if (!row) throw new Error("SYNTHETIC_ROW_MISSING");
        return row;
      },
      count: async args => selectRows(args).length,
      updateMany: async ({ where, data }) => {
        const rows = state[model].filter(row => matches(row, where));
        state.writes.push({ model, where: structuredClone(where), data: structuredClone(data), count: rows.length });
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      },
      update: async ({ where, data }) => {
        const row = state[model].find(item => matches(item, where));
        if (!row) throw new Error("SYNTHETIC_ROW_MISSING");
        state.writes.push({ model, where: structuredClone(where), data: structuredClone(data), count: 1 });
        Object.assign(row, data); return structuredClone(row);
      },
      create: async ({ data }) => {
        const row = { id: `synthetic-${model}-${state[model].length + 1}`, ...structuredClone(data) };
        state[model].push(row); state.writes.push({ model, data: structuredClone(data), count: 1 });
        return structuredClone(row);
      },
      createMany: async ({ data }) => {
        for (const item of data) state[model].push({ id: `synthetic-${model}-${state[model].length + 1}`, ...structuredClone(item) });
        state.writes.push({ model, data: structuredClone(data), count: data.length });
        return { count: data.length };
      }
    };
  }
  tx.$queryRaw = async (...args) => { state.locks.push(args); return []; };
  tx.$executeRaw = async (...args) => { state.locks.push(args); return 1; };
  tx.$executeRawUnsafe = async (...args) => { state.locks.push(args); return 1; };
  tx.$queryRawUnsafe = async (...args) => { state.locks.push(args); return []; };
  const prisma = { ...tx, $transaction: async (work, options) => {
    state.transactions.push(options);
    return work(tx);
  } };
  const assertGrant = async ({ caseId, grantId }) => {
    const record = state.manualCase.find(item => item.id === caseId);
    const grant = state.manualGrant.find(item => item.id === grantId && item.caseId === caseId && !item.revokedAt && item.expiresAt > new Date());
    if (!grant || !record || ["ARCHIVED", "REJECTED"].includes(record.application?.status)) throw new Error("MANUAL_ACCESS_DENIED");
    return record;
  };
  const loader = sourceLoader({
    "node:crypto": require("node:crypto"),
    "@prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/lib/db/prisma": { prisma },
    "@/features/manual-v21/service": { assertManualGrant: assertGrant },
    "@/features/manual-v21/policy": { isManualAccessOpen: () => true },
    "@/features/applications/display-number": {
      getApplicationDisplayNumber: async () => "PMC-SYNTHETIC-CALENDAR",
      attachApplicationDisplayNumbers: async rows => rows.map(row => ({ ...row, displayNumber: "PMC-SYNTHETIC-CALENDAR" }))
    }
  });
  return { state, tx, prisma, service: loader("src/features/calendar/service.ts") };
}

const futureStart = () => new Date("2031-11-05T07:00:00Z");
const futureEnd = () => new Date("2031-11-05T07:30:00Z");
function availableSlot(extra = {}) {
  return { id: "synthetic-open-slot", startsAt: futureStart(), endsAt: futureEnd(), timezone: "Europe/Moscow", status: "AVAILABLE", caseId: null, case: null, ...extra };
}

test("both existing consultations and closed/held legacy time prevent preliminary overlap", async () => {
  for (const [model, row] of [
    ["appointment", { id: "synthetic-legacy-appointment", startsAt: futureStart(), endsAt: futureEnd(), status: "SCHEDULED" }],
    ["calendarSlot", { id: "synthetic-legacy-held", startsAt: futureStart(), endsAt: futureEnd(), status: "HELD", holdExpiresAt: new Date("2031-11-05T06:55:00Z") }],
    ["calendarSlot", { id: "synthetic-legacy-blocked", startsAt: futureStart(), endsAt: futureEnd(), status: "BLOCKED" }],
    ["manualCase", { id: "synthetic-old-unslotted", callStartsAt: futureStart(), callEndsAt: futureEnd(), callConfirmedAt: new Date("2031-11-01T07:00:00Z"), callCompletedAt: null, application: { status: "NEW" } }]
  ]) {
    const f = calendarFixture({ [model]: [row] });
    await assert.rejects(() => f.service.assertCalendarIntervalFree(f.tx, { startsAt: futureStart(), endsAt: futureEnd() }));
    assert.equal(f.state.writes.length, 0);
  }
});

test("an absent or nonavailable slot cannot be selected for a preliminary call", async () => {
  for (const rows of [[], [availableSlot({ status: "BLOCKED" })], [availableSlot({ status: "PENDING", caseId: "another-case" })]]) {
    const f = calendarFixture({ preliminarySlot: rows });
    await assert.rejects(() => f.service.reservePreliminarySlot(f.tx, { caseId: "synthetic-case", slotId: "synthetic-open-slot" }));
    assert.equal(f.state.preliminarySlot.some(slot => slot.caseId === "synthetic-case"), false);
  }
});

test("an atomic claim cannot give the same open slot to two different cases", async () => {
  const f = calendarFixture({ preliminarySlot: [availableSlot()] });
  const attempts = await Promise.allSettled([
    f.service.reservePreliminarySlot(f.tx, { caseId: "synthetic-case-a", slotId: "synthetic-open-slot" }),
    f.service.reservePreliminarySlot(f.tx, { caseId: "synthetic-case-b", slotId: "synthetic-open-slot" })
  ]);
  assert.equal(attempts.filter(attempt => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter(attempt => attempt.status === "rejected").length, 1);
  assert.equal(f.state.preliminarySlot[0].status, "PENDING");
  assert.ok(["synthetic-case-a", "synthetic-case-b"].includes(f.state.preliminarySlot[0].caseId));
  assert.equal(f.state.writes.some(write => ["payment", "offer", "appointment"].includes(write.model)), false);
});

test("releasing a case cannot release another patient's pending reservation", async () => {
  const f = calendarFixture({ preliminarySlot: [availableSlot({ status: "PENDING", caseId: "synthetic-case-b" })] });
  await f.service.releasePreliminarySlot(f.tx, { caseId: "synthetic-case-a" });
  assert.equal(f.state.preliminarySlot[0].status, "PENDING");
  assert.equal(f.state.preliminarySlot[0].caseId, "synthetic-case-b");
});

test("moving to an unavailable target cannot discard the case's existing reservation", async () => {
  const original = availableSlot({ id: "synthetic-current-slot", status: "CONFIRMED", caseId: "synthetic-case-a" });
  const target = availableSlot({ status: "PENDING", caseId: "synthetic-case-b", startsAt: new Date("2031-11-05T08:00:00Z"), endsAt: new Date("2031-11-05T08:30:00Z") });
  const f = calendarFixture({ preliminarySlot: [original, target] });
  await assert.rejects(() => f.service.reservePreliminarySlot(f.tx, { caseId: "synthetic-case-a", slotId: target.id }));
  assert.equal(f.state.preliminarySlot[0].status, "CONFIRMED");
  assert.equal(f.state.preliminarySlot[0].caseId, "synthetic-case-a");
  assert.equal(f.state.writes.length, 0);
});

test("a stale conditional claim is rejected instead of returning a successful reservation", async () => {
  const f = calendarFixture({ preliminarySlot: [availableSlot()] });
  f.tx.preliminarySlot.updateMany = async () => ({ count: 0 });
  await assert.rejects(() => f.service.reservePreliminarySlot(f.tx, { caseId: "synthetic-case-a", slotId: "synthetic-open-slot" }), /CALENDAR_SLOT_UNAVAILABLE/);
  assert.equal(f.state.preliminarySlot[0].caseId, null);
});

test("reselecting an owned confirmed slot preserves its confirmation and still checks the conditional write", async () => {
  const f = calendarFixture({ preliminarySlot: [availableSlot({ status: "CONFIRMED", caseId: "synthetic-case-a" })] });
  const selected = await f.service.reservePreliminarySlot(f.tx, { caseId: "synthetic-case-a", slotId: "synthetic-open-slot" });
  assert.equal(selected.status, "CONFIRMED");
  assert.equal(f.state.preliminarySlot[0].status, "CONFIRMED");
  f.tx.preliminarySlot.updateMany = async () => ({ count: 0 });
  await assert.rejects(() => f.service.reservePreliminarySlot(f.tx, { caseId: "synthetic-case-a", slotId: "synthetic-open-slot" }), /CALENDAR_SLOT_CHANGED/);
});

test("confirmation must still belong to the case and match its reserved interval", async () => {
  const f = calendarFixture({ preliminarySlot: [availableSlot({ status: "PENDING", caseId: "synthetic-case-a" })] });
  await assert.rejects(() => f.service.confirmPreliminarySlot(f.tx, {
    caseId: "synthetic-case-a", startsAt: new Date("2031-11-05T08:00:00Z"), endsAt: new Date("2031-11-05T08:30:00Z")
  }), /CALENDAR_SLOT_CHANGED/);
  assert.equal(f.state.preliminarySlot[0].status, "PENDING");
  await f.service.confirmPreliminarySlot(f.tx, { caseId: "synthetic-case-a", startsAt: futureStart(), endsAt: futureEnd() });
  assert.equal(f.state.preliminarySlot[0].status, "CONFIRMED");
});

test("calendar transactions use one shared lock and retry only known serialization aborts", async () => {
  const f = calendarFixture();
  let attempts = 0; let workCalls = 0;
  f.prisma.$transaction = async (work, options) => {
    attempts++;
    assert.equal(options.isolationLevel, "Serializable");
    if (attempts < 3) throw Object.assign(new Error("SYNTHETIC_ROLLED_BACK"), { code: "P2034" });
    return work(f.tx);
  };
  const result = await f.service.withCalendarTransaction(async () => { workCalls++; return "synthetic-committed"; });
  assert.equal(result, "synthetic-committed");
  assert.equal(attempts, 3);
  assert.equal(workCalls, 1);
  assert.equal(f.state.locks.length, 1);
  assert.match(String(f.state.locks[0][0]), /pg_advisory_xact_lock/);
  let unexpectedAttempts = 0;
  f.prisma.$transaction = async () => { unexpectedAttempts++; throw new Error("SYNTHETIC_UNEXPECTED_ERROR"); };
  await assert.rejects(() => f.service.withCalendarTransaction(async () => "unreachable"), /SYNTHETIC_UNEXPECTED_ERROR/);
  assert.equal(unexpectedAttempts, 1);
});

test("opening multiple doctor-local days creates the intended UTC windows without offers or payments", async () => {
  const f = calendarFixture();
  const created = await f.service.openPreliminarySlots({
    actor: { id: "synthetic-doctor" }, dates: ["2031-11-05", "2031-11-06"],
    startTime: "10:00", endTime: "11:00", durationMinutes: 30, timezone: "Europe/Moscow"
  });
  assert.equal(created.length, 4);
  assert.equal(f.state.preliminarySlot.length, 4);
  assert.equal(f.state.preliminarySlot[0].startsAt.toISOString(), "2031-11-05T07:00:00.000Z");
  assert.equal(f.state.preliminarySlot[3].endsAt.toISOString(), "2031-11-06T08:00:00.000Z");
  assert.equal(f.state.preliminarySlot.every(slot => slot.status === "AVAILABLE" && slot.timezone === "Europe/Moscow"), true);
  assert.equal(f.state.locks.length, 1);
  assert.equal(f.state.writes.every(write => ["preliminarySlot", "auditEvent"].includes(write.model)), true);
});

test("opening time requires active staff and rejects invalid or conflicting batch windows", async () => {
  const input = {
    actor: { id: "synthetic-doctor" }, dates: ["2031-11-05"],
    startTime: "10:00", endTime: "11:00", durationMinutes: 30, timezone: "Europe/Moscow"
  };
  const denied = calendarFixture({ user: [{ id: "synthetic-doctor", role: "PATIENT", isActive: true }] });
  await assert.rejects(() => denied.service.openPreliminarySlots(input), /CALENDAR_STAFF_REQUIRED/);
  assert.equal(denied.state.preliminarySlot.length, 0);
  for (const change of [
    { dates: ["2031-11-05", "2031-11-05"] },
    { durationMinutes: 0 },
    { startTime: "11:00", endTime: "10:00" },
    { endTime: "10:40" },
    { timezone: "Not/A_Real_Zone" }
  ]) {
    const invalid = calendarFixture();
    await assert.rejects(() => invalid.service.openPreliminarySlots({ ...input, ...change }));
    assert.equal(invalid.state.preliminarySlot.length, 0);
  }
  const conflict = calendarFixture({ calendarSlot: [{ ...availableSlot(), id: "synthetic-legacy-slot", status: "BOOKED" }] });
  await assert.rejects(() => conflict.service.openPreliminarySlots(input), /CALENDAR_INTERVAL_OCCUPIED/);
  assert.equal(conflict.state.preliminarySlot.length, 0);
});

test("batch windows crossing a clock change cannot silently create missing or repeated wall-clock slots", async () => {
  for (const date of ["2031-03-09", "2031-11-02"]) {
    const f = calendarFixture();
    await assert.rejects(() => f.service.openPreliminarySlots({
      actor: { id: "synthetic-doctor" }, dates: [date], startTime: "00:00", endTime: "04:00", durationMinutes: 30, timezone: "America/New_York"
    }), /CALENDAR_WINDOW_DST_TRANSITION/);
    assert.equal(f.state.writes.length, 0);
  }
});

test("a patient's reserved slot cannot be turned available through the doctor's block/release controls", async () => {
  for (const action of ["block", "release"]) {
    const f = calendarFixture({ preliminarySlot: [availableSlot({ status: "PENDING", caseId: "synthetic-case-a" })] });
    await assert.rejects(() => f.service.changePreliminarySlot({ actor: { id: "synthetic-doctor" }, slotId: "synthetic-open-slot", action }), /CALENDAR_SLOT_RESERVED/);
    assert.equal(f.state.preliminarySlot[0].status, "PENDING");
    assert.equal(f.state.preliminarySlot[0].caseId, "synthetic-case-a");
  }
});

test("the month overview returns all slots, including more than the previous 60-row limit", async () => {
  const rows = Array.from({ length: 80 }, (_, index) => {
    const startsAt = new Date(Date.UTC(2031, 10, 1 + Math.floor(index / 4), 7 + index % 4));
    return availableSlot({ id: `synthetic-month-slot-${index}`, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60000) });
  });
  const f = calendarFixture({ preliminarySlot: rows });
  const result = await f.service.getAdminCalendarMonth({ month: "2031-11", timezone: "Europe/Moscow" });
  assert.equal(result.days.length, 30);
  assert.equal(result.days.flatMap(day => day.slots).length, 80);
  assert.equal(result.days[0].date, "2031-11-01");
  assert.equal(result.days[0].slots.length, 4);
  assert.equal(result.days[29].slots.length, 0);
  assert.equal(result.timeZone, "Europe/Moscow");
  assert.equal(f.state.writes.length, 0, "merely viewing a month must not release or change reservations");
});

function patientCalendarFixture() {
  const startsAt = new Date(Date.now() + 2 * 86400000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60000);
  const record = { id: "synthetic-case-a", phase: "REVIEW", application: { status: "NEW" } };
  const own = { ...record };
  return calendarFixture({
    manualCase: [record],
    manualGrant: [{ id: "synthetic-grant-a", caseId: record.id, revokedAt: null, expiresAt: new Date(Date.now() + 86400000), case: own }],
    preliminarySlot: [
      availableSlot({ id: "synthetic-public-slot", startsAt, endsAt, patientName: "SYNTHETIC_PRIVATE_NAME", applicationId: "SYNTHETIC_PRIVATE_APPLICATION", case: { application: { patient: { fullName: "SYNTHETIC_PRIVATE_NAME" } } } }),
      availableSlot({ id: "synthetic-other-reservation", startsAt: new Date(startsAt.getTime() + 3600000), endsAt: new Date(endsAt.getTime() + 3600000), status: "PENDING", caseId: "synthetic-case-b" })
    ]
  });
}

test("patient availability requires a current grant for that exact case", async () => {
  const f = patientCalendarFixture();
  await assert.rejects(() => f.service.getPatientAvailableSlots("synthetic-case-a", "wrong-grant"), /CALENDAR_ACCESS_DENIED/);
  await assert.rejects(() => f.service.getPatientAvailableSlots("synthetic-case-b", "synthetic-grant-a"), /CALENDAR_ACCESS_DENIED/);
  assert.equal(f.state.writes.length, 0);
});

test("patient availability projects only booking fields and never another patient's details", async () => {
  const f = patientCalendarFixture();
  const slots = await f.service.getPatientAvailableSlots("synthetic-case-a", "synthetic-grant-a");
  assert.equal(slots.length, 1);
  assert.equal(slots[0].id, "synthetic-public-slot");
  assert.deepEqual(Object.keys(slots[0]).sort(), ["endsAt", "id", "own", "startsAt", "status", "timezone"]);
  assert.equal(JSON.stringify(slots).includes("SYNTHETIC_PRIVATE"), false);
  assert.equal(JSON.stringify(slots).includes("synthetic-case-b"), false);
  assert.equal(f.state.writes.length, 0);
});

test("new-patient availability excludes legacy appointments, blocks and expired grants", async () => {
  for (const model of ["calendarSlot", "appointment"]) {
    const f = patientCalendarFixture();
    const slot = f.state.preliminarySlot[0];
    f.state[model].push({ id: `synthetic-${model}-occupied`, startsAt: slot.startsAt, endsAt: slot.endsAt, status: model === "appointment" ? "SCHEDULED" : "BLOCKED" });
    const result = await f.service.getPatientAvailableSlots("synthetic-case-a", "synthetic-grant-a");
    assert.equal(result.length, 0);
  }
  for (const change of [{ expiresAt: new Date(Date.now() - 1000) }, { revokedAt: new Date() }]) {
    const f = patientCalendarFixture();
    Object.assign(f.state.manualGrant[0], change);
    await assert.rejects(() => f.service.getPatientAvailableSlots("synthetic-case-a", "synthetic-grant-a"), /CALENDAR_ACCESS_DENIED/);
  }
});

test("legacy patient choices hide time already occupied by preliminary calls", async () => {
  const original = availableSlot({ id: "synthetic-legacy-choice" });
  const f = calendarFixture({ preliminarySlot: [availableSlot({ status: "PENDING", caseId: "synthetic-case-a" })] });
  assert.equal((await f.service.filterLegacySlotsForPatient([original])).length, 0);
  f.state.preliminarySlot.length = 0;
  f.state.manualCase.push({ id: "synthetic-unslotted-call", callStartsAt: original.startsAt, callEndsAt: original.endsAt, application: { status: "NEW" } });
  assert.equal((await f.service.filterLegacySlotsForPatient([original])).length, 0);
  f.state.manualCase.length = 0;
  assert.equal((await f.service.filterLegacySlotsForPatient([original])).length, 1);
  assert.equal(f.state.writes.length, 0);
});

function routeFixture(options = {}) {
  const calls = [];
  const actualAccess = sourceLoader({
    "@/lib/auth/manual-session": { getManualSession: async () => options.patientSession === false ? null : { caseId: "synthetic-case-a", grantId: "synthetic-grant-a" } },
    "@/lib/auth/session": { getStaffSession: async () => options.staffSession === false ? null : { id: "synthetic-doctor" } },
    "@/lib/db/prisma": { prisma: { user: { findFirst: async () => ({ id: "synthetic-doctor", role: options.role || "DOCTOR", isActive: true }) } } },
    "@/features/manual-v21/service": { assertManualGrant: async input => {
      if (options.revoked) throw Object.assign(new Error("SYNTHETIC_DENIED"), { status: 403 });
      assert.equal(input.caseId, "synthetic-case-a");
      assert.equal(input.grantId, "synthetic-grant-a");
    } }
  })("src/features/manual-v21/access.ts");
  const calendar = {
    openPreliminarySlots: async input => { calls.push({ action: "open", input }); if (options.failure) throw new Error("SYNTHETIC_PRIVATE_SERVICE_FAILURE"); return [{ id: "synthetic-created-slot" }]; },
    changePreliminarySlot: async input => { calls.push({ action: "change", input }); return { id: input.slotId }; },
    getAdminCalendarMonth: async input => { calls.push({ action: "month", input }); return { month: "2031-11", timeZone: "Europe/Moscow", days: [] }; },
    getAvailablePreliminarySlots: async caseId => { calls.push({ action: "staff-availability", caseId }); return []; },
    getPatientAvailableSlots: async (caseId, grantId) => { calls.push({ action: "patient-availability", caseId, grantId }); return [{ id: "synthetic-available-slot" }]; }
  };
  const loader = sourceLoader({
    zod,
    "next/server": { NextResponse: { json: (body, init = {}) => ({ body: structuredClone(body), status: init.status || 200, headers: structuredClone(init.headers || {}) }) } },
    "@/features/manual-v21/access": actualAccess,
    "@/features/calendar/service": calendar
  });
  const admin = loader("src/app/api/admin/calendar/preliminary/route.ts");
  const patient = loader("src/app/api/manual/slots/route.ts");
  return { calls, admin, patient };
}

function adminRequest(overrides = {}) {
  const body = overrides.body || {
    action: "open", dates: ["2031-11-05"], startTime: "10:00", endTime: "11:00", durationMinutes: 30, timeZone: "Europe/Moscow"
  };
  return {
    url: overrides.url || "https://preview.example.invalid/api/admin/calendar/preliminary",
    headers: { get(name) {
      if (name === "origin") return Object.hasOwn(overrides, "origin") ? overrides.origin : "https://preview.example.invalid";
      if (name === "content-type") return overrides.contentType || "application/json";
      return null;
    } },
    text: async () => overrides.text || JSON.stringify(body)
  };
}

test("calendar writes require the actual same-origin guard and an authorized staff session", async () => {
  for (const origin of [null, "https://other.example.invalid"]) {
    const f = routeFixture();
    const response = await f.admin.POST(adminRequest({ origin }));
    assert.equal(response.status, 403);
    assert.equal(f.calls.length, 0);
  }
  const signedOut = routeFixture({ staffSession: false });
  assert.equal((await signedOut.admin.POST(adminRequest())).status, 401);
  assert.equal(signedOut.calls.length, 0);
  const wrongRole = routeFixture({ role: "PATIENT" });
  assert.equal((await wrongRole.admin.POST(adminRequest())).status, 403);
  assert.equal(wrongRole.calls.length, 0);
});

test("calendar routes validate payload and timezone before passing a write to the service", async () => {
  const f = routeFixture();
  const successful = await f.admin.POST(adminRequest());
  assert.equal(successful.status, 200);
  assert.equal(successful.body.createdCount, 1);
  assert.equal(successful.headers["Cache-Control"], "private, no-store");
  assert.equal(f.calls[0].input.actor.id, "synthetic-doctor");
  assert.equal(f.calls[0].input.timezone, "Europe/Moscow");
  for (const request of [
    adminRequest({ contentType: "text/plain" }),
    adminRequest({ text: "x".repeat(32001) }),
    adminRequest({ body: { action: "open", dates: [], startTime: "10:00", endTime: "11:00", durationMinutes: 30, timeZone: "Europe/Moscow" } }),
    adminRequest({ body: { action: "open", dates: ["2031-11-05"], startTime: "10:00", endTime: "11:00", durationMinutes: 30, timeZone: "Europe/Moscow", timezone: "UTC" } }),
    adminRequest({ body: { action: "release", slotId: "synthetic-slot", caseId: "injected-case" } })
  ]) {
    const invalid = routeFixture();
    const response = await invalid.admin.POST(request);
    assert.ok([400, 413, 415].includes(response.status));
    assert.equal(invalid.calls.length, 0);
  }
});

test("an internal calendar failure is not exposed as raw private details or a successful result", async () => {
  const f = routeFixture({ failure: true });
  const response = await f.admin.POST(adminRequest());
  assert.notEqual(response.status, 200);
  assert.equal(response.body.code, "CALENDAR_REQUEST_FAILED");
  assert.equal(response.body.success, undefined);
  assert.equal(JSON.stringify(response.body).includes("SYNTHETIC_PRIVATE_SERVICE_FAILURE"), false);
});

test("availability APIs protect both admin data and the current patient's grant", async () => {
  const unauthenticatedStaff = routeFixture({ staffSession: false });
  const adminResponse = await unauthenticatedStaff.admin.GET(adminRequest());
  assert.equal(adminResponse.status, 401);
  assert.equal(unauthenticatedStaff.calls.length, 0);
  for (const options of [{ patientSession: false }, { revoked: true }]) {
    const f = routeFixture(options);
    const response = await f.patient.GET();
    assert.ok([401, 403].includes(response.status));
    assert.equal(f.calls.length, 0);
  }
  const valid = routeFixture();
  const response = await valid.patient.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(valid.calls, [{ action: "patient-availability", caseId: "synthetic-case-a", grantId: "synthetic-grant-a" }]);
});

function manualActionFixture(phase = "CALL_REQUESTED") {
  const calls = [];
  const record = {
    id: "synthetic-case-a", applicationId: "synthetic-application-a", version: 1, phase,
    application: { status: "NEW" }, preliminarySlot: { id: "synthetic-current-slot", status: phase === "CALL_CONFIRMED" ? "CONFIRMED" : "PENDING" },
    callStartsAt: futureStart(), callEndsAt: futureEnd(), callTimezone: "Europe/Moscow",
    callRequestedAt: new Date("2031-11-01T06:00:00Z"),
    callConfirmedAt: phase === "CALL_CONFIRMED" ? new Date("2031-11-01T07:00:00Z") : null,
    callCompletedAt: null, currentAgreement: null, completedAt: null, patientAccessEndsAt: null
  };
  const tx = {
    user: { findUnique: async () => ({ id: "synthetic-doctor", role: "DOCTOR", isActive: true }) },
    manualGrant: { findFirst: async ({ where }) => where.id === "synthetic-grant-a" && where.caseId === record.id ? { id: where.id, case: record } : null },
    manualCase: {
      findUnique: async () => record, updateMany: async () => ({ count: 1 }),
      update: async ({ data }) => { calls.push({ action: "case-write", data }); Object.assign(record, data); return record; },
      findUniqueOrThrow: async () => record
    },
    auditEvent: { create: async () => ({ id: "synthetic-audit" }) }
  };
  const calendar = {
    withCalendarTransaction: async work => work(tx),
    reservePreliminarySlot: async () => { calls.push({ action: "reserve" }); return { ...availableSlot(), id: "synthetic-new-slot" }; },
    confirmPreliminarySlot: async () => { calls.push({ action: "confirm" }); return {}; },
    releasePreliminarySlot: async () => { calls.push({ action: "release" }); return { id: "synthetic-current-slot" }; }
  };
  const service = sourceLoader({
    zod,
    "node:crypto": require("node:crypto"),
    "@prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/lib/db/prisma": { prisma: { $transaction: async work => work(tx) } },
    "@/features/calendar/service": calendar,
    "@/lib/security/tokens": { createOpaqueToken: () => "synthetic-token-not-for-online-use", hashOpaqueToken: () => "synthetic-hash" }
  })("src/features/manual-v21/service.ts");
  return { calls, record, service };
}

test("a replayed patient choice cannot demote a doctor-confirmed call or move its slot", async () => {
  const f = manualActionFixture("CALL_CONFIRMED");
  const before = f.record.callConfirmedAt.toISOString();
  await assert.rejects(() => f.service.patientManualAction({
    caseId: "synthetic-case-a", grantId: "synthetic-grant-a", action: "request-call", data: { slotId: "synthetic-current-slot" }
  }), /CALL_STAGE_CLOSED/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.record.phase, "CALL_CONFIRMED");
  assert.equal(f.record.callConfirmedAt.toISOString(), before);
});

test("a doctor reselecting the current slot does not reset a confirmed call", async () => {
  const f = manualActionFixture("CALL_CONFIRMED");
  const before = f.record.callConfirmedAt.toISOString();
  await f.service.staffManualAction({
    caseId: "synthetic-case-a", actor: { id: "synthetic-doctor" }, action: "request-call", data: { slotId: "synthetic-current-slot" }
  });
  assert.equal(f.calls.length, 0);
  assert.equal(f.record.phase, "CALL_CONFIRMED");
  assert.equal(f.record.callConfirmedAt.toISOString(), before);
});

test("stale doctor confirmation or cancellation cannot operate on the replacement slot", async () => {
  for (const action of ["confirm-call", "cancel-call"]) {
    const f = manualActionFixture();
    await assert.rejects(() => f.service.staffManualAction({
      caseId: "synthetic-case-a", actor: { id: "synthetic-doctor" }, action,
      data: action === "cancel-call" ? { slotId: "synthetic-stale-slot", reason: "Synthetic cancellation" } : { slotId: "synthetic-stale-slot" }
    }), /CALENDAR_SLOT_CHANGED/);
    assert.equal(f.calls.length, 0);
    assert.equal(f.record.phase, "CALL_REQUESTED");
  }
});

test("arbitrary date/time payloads cannot bypass the opened-slot requirement", async () => {
  const f = manualActionFixture("REVIEW");
  await assert.rejects(() => f.service.patientManualAction({
    caseId: "synthetic-case-a", grantId: "synthetic-grant-a", action: "request-call",
    data: { startsAt: futureStart().toISOString(), endsAt: futureEnd().toISOString(), timezone: "Europe/Moscow" }
  }));
  assert.equal(f.calls.length, 0);
});
