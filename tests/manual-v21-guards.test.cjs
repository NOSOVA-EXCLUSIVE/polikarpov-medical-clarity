// Executes the actual service in a VM with an in-memory DB boundary. No project startup,
// environment, Prisma constructor, network, database, storage or SDK is loaded.
// These are application guard tests, not PostgreSQL transaction/isolation proof.
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");
const zod = require("zod");
const base = path.resolve(__dirname, "..");

function loadService(prisma) {
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const source = fs.readFileSync(path.join(base, relative), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const exports = {};
    cache.set(relative, exports);
    const permitted = {
      "server-only": {}, "node:crypto": crypto, "zod": zod,
      "@prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
      "@/lib/db/prisma": { prisma },
      "@/lib/security/tokens": { createOpaqueToken: () => "synthetic-only-token-never-used-online", hashOpaqueToken: (v) => crypto.createHash("sha256").update(v).digest("hex") }
    };
    const mapped = {
      "./policy": "src/features/manual-v21/policy.ts", "./schemas": "src/features/manual-v21/schemas.ts",
      "@/features/products/services-v21": "src/features/products/services-v21.ts",
      "@/features/questionnaire/service-selection": "src/features/questionnaire/service-selection.ts"
    };
    const requireOnly = (name) => {
      if (Object.hasOwn(permitted, name)) return permitted[name];
      if (mapped[name]) return load(mapped[name]);
      throw new Error(`UNEXPECTED_IMPORT:${name}`);
    };
    vm.runInNewContext(compiled, { exports, require: requireOnly, Date, Intl, Set, Buffer }, { filename: relative, timeout: 2000 });
    return exports;
  }
  return load("src/features/manual-v21/service.ts");
}

function fixture(overrides = {}) {
  const writes = [];
  const record = {
    id: "case-a", applicationId: "application-a", reference: "PMC-SYNTHETIC", phase: "REVIEW", version: 0,
    application: { id: "application-a", status: "NEW", patient: { email: "synthetic@example.invalid" } },
    currentAgreement: null, agreements: [], receipts: [], contacts: [], messages: [], deliverables: [],
    callCompletedAt: null, workEndsAt: null, resultDeliveredAt: null, completedAt: null, patientAccessEndsAt: null,
    ...overrides
  };
  const tx = {
    user: { findUnique: async () => ({ id: "doctor-a", role: "DOCTOR", isActive: true }) },
    manualCase: {
      findUnique: async () => record,
      updateMany: async () => ({ count: 1 }),
      update: async ({ data }) => { writes.push({ model: "case", data }); Object.assign(record, data); return record; },
      findUniqueOrThrow: async () => record
    },
    manualMessage: { create: async ({ data }) => { writes.push({ model: "message", data }); return { id: "message-a", ...data }; } },
    manualContact: { update: async ({ data }) => { writes.push({ model: "contact", data }); return data; } },
    manualGrant: { findFirst: async ({ where }) => where.caseId === "case-a" && where.id === "grant-a" ? { id: "grant-a", case: record } : null },
    auditEvent: { create: async () => ({}) }
  };
  return { record, writes, tx, service: loadService({ ...tx, $transaction: async (fn) => fn(tx) }) };
}
const doctor = { id: "doctor-a" };

test("finaloffer is denied before the completed clarification call", async () => {
  const f = fixture();
  await assert.rejects(() => f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "create-agreement", data: { serviceId: "second-opinion", amountCents: 8000, scope: "Synthetic agreed scope", turnaround: "3–5 рабочих дней" } }), /COMPLETED_CALL_REQUIRED/);
  assert.equal(f.writes.length, 0);
});

test("acceptedterms alone cannot start work or create a payment", async () => {
  const f = fixture({ phase: "ACCEPTED", currentAgreement: { id: "agreement-a", acceptedAt: new Date(), supersededAt: null } });
  await assert.rejects(() => f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "start", data: { ready: true } }), /ACCEPTED_PAID_AGREEMENT_REQUIRED/);
  assert.equal(f.writes.length, 0);
});

test("staff role is fetched again and administrators cannot claim doctor start", async () => {
  const f = fixture({ phase: "PAID" });
  f.tx.user.findUnique = async () => ({ id: "doctor-a", role: "ADMIN", isActive: true });
  await assert.rejects(() => f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "start", data: { ready: true } }), /DOCTOR_ACTION_REQUIRED/);
  f.tx.user.findUnique = async () => ({ id: "doctor-a", role: "DOCTOR", isActive: false });
  await assert.rejects(() => f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "start", data: { ready: true } }), /STAFF_ACCESS_DENIED/);
});

test("acceptedpaid support starts only through explicit doctor action and lasts28days", async () => {
  const f = fixture({ phase: "PAID", currentAgreement: { id: "agreement-a", acceptedAt: new Date(), supersededAt: null, policyJson: { contactLimit: 4, packageDays: 28, clarificationDays: null, replyWorkingDays: 3, historyDays: 30 } }, receipts: [{ agreementId: "agreement-a" }] });
  await f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "start", data: { ready: true } });
  assert.equal(f.record.phase, "ACTIVE");
  assert.equal(f.record.workEndsAt.getTime() - f.record.workStartedAt.getTime(), 28 * 86400000);
});

test("casebinding rejects a differentcase despite a valid-looking grant", async () => {
  const f = fixture();
  await assert.rejects(() => f.service.patientManualAction({ caseId: "case-b", grantId: "grant-a", action: "message", data: { body: "Synthetic organizational question" } }), /MANUAL_ACCESS_DENIED/);
  assert.equal(f.writes.length, 0);
});

test("staleagreement cannot be accepted", async () => {
  const f = fixture({ phase: "OFFERED", currentAgreement: { id: "agreement-new", supersededAt: null } });
  await assert.rejects(() => f.service.patientManualAction({ caseId: "case-a", grantId: "grant-a", action: "accept-agreement", data: { agreementId: "agreement-old", accepted: true } }), /CURRENT_AGREEMENT_REQUIRED/);
});

test("contact completion requires an actual doctor response", async () => {
  const f = fixture({ phase: "ACTIVE", contacts: [{ id: "contact-a", status: "OPEN" }], messages: [{ contactId: "contact-a", authorRole: "ADMIN" }] });
  await assert.rejects(() => f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "complete-contact", data: { contactId: "contact-a" } }), /DOCTOR_RESPONSE_REQUIRED/);
  assert.equal(f.writes.length, 0);
});

test("doctoropeningprompt is not counted as a completed substantive reply", async () => {
  const f = fixture({ phase: "ACTIVE", contacts: [{ id: "contact-a", status: "OPEN" }], messages: [{ contactId: "contact-a", authorRole: "DOCTOR", kind: "OPENING" }] });
  await assert.rejects(() => f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "complete-contact", data: { contactId: "contact-a" } }), /DOCTOR_RESPONSE_REQUIRED/);
  assert.equal(f.writes.length, 0);
  f.record.messages.push({ contactId: "contact-a", authorRole: "DOCTOR", kind: "REPLY" });
  await f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "complete-contact", data: { contactId: "contact-a" } });
  assert.equal(f.writes.find((write) => write.model === "contact").data.status, "ANSWERED");
});

test("recoverycannotfinishbeforefourplannedcontactsareanswered", async () => {
  const f = fixture({ phase: "ACTIVE", currentAgreement: { serviceId: "recovery-control", policyJson: { contactLimit: 4, packageDays: 28, clarificationDays: null, replyWorkingDays: 3, historyDays: 30 } }, resultDeliveredAt: new Date(), workEndsAt: new Date(Date.now() - 1000), contacts: [{ id: "contact-a", status: "ANSWERED" }] });
  f.tx.auditEvent.findFirst = async () => null;
  await assert.rejects(() => f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "complete" }), /FOUR_COMPLETED_CONTACTS_REQUIRED/);
  assert.equal(f.writes.length, 0);
});

test("completion cannot abandon a timely pendingcontact", async () => {
  const f = fixture({ phase: "ACTIVE", currentAgreement: { policyJson: { contactLimit: 4, packageDays: 28, clarificationDays: null, replyWorkingDays: 3, historyDays: 30 } }, resultDeliveredAt: new Date(), contacts: [{ id: "contact-a", status: "OPEN" }] });
  f.tx.auditEvent.findFirst = async () => null;
  await assert.rejects(() => f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "complete" }), /PENDING_CONTACT_RESPONSE/);
});

function organizationalLinkFixture(changeSource = {}) {
  const f = fixture();
  const source = { id: "org-source", applicationId: "org-application", application: { status: "NEW", patient: { email: " Synthetic@Example.Invalid " } }, callRequestedAt: new Date("2026-10-27T09:00:00Z"), callStartsAt: new Date("2026-10-27T10:00:00Z"), callEndsAt: new Date("2026-10-27T10:30:00Z"), callConfirmedAt: new Date("2026-10-27T09:30:00Z"), callCompletedAt: new Date("2026-10-27T10:30:00Z"), callTimezone: "UTC", ...changeSource };
  const snapshot = (kind) => ({ catalogVersion: "2.1", id: kind === "organizational_selection" ? "service-selection" : "second-opinion", title: "Synthetic service", amountCents: kind === "organizational_selection" ? 0 : 8000, currency: "EUR", kind, priceFrom: false, durationLabel: null, priceLabel: "Synthetic" });
  f.tx.manualCase.findUnique = async ({ where }) => where.id === "org-source" ? source : f.record;
  f.tx.legalAcceptance = { findUnique: async () => ({ id: "synthetic-legal" }) };
  f.tx.auditEvent.findFirst = async ({ where }) => ({ metadataJson: snapshot(where.applicationId === "org-application" ? "organizational_selection" : "paid_service") });
  return { ...f, source, snapshot };
}

test("confirmedorganizationalcall can be reused only for samepatient fullconsentedquestionnaire", async () => {
  const f = organizationalLinkFixture();
  const sourceBefore = JSON.stringify(f.source);
  await f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "link-organizational-call", data: { sourceCaseId: "org-source", sameTask: true } });
  assert.equal(f.record.phase, "CALL_COMPLETED");
  assert.equal(f.record.callCompletedAt.toISOString(), "2026-10-27T10:30:00.000Z");
  assert.equal(JSON.stringify(f.source), sourceBefore);
});

test("organizationalcall reuse rejects wrongpatient, nonorganizationalsource and incompletecall", async () => {
  const wrongPatient = organizationalLinkFixture({ application: { status: "NEW", patient: { email: "another@example.invalid" } } });
  await assert.rejects(() => wrongPatient.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "link-organizational-call", data: { sourceCaseId: "org-source", sameTask: true } }), /PATIENT_MISMATCH/);
  const notOrganizational = organizationalLinkFixture();
  notOrganizational.tx.auditEvent.findFirst = async () => ({ metadataJson: notOrganizational.snapshot("paid_service") });
  await assert.rejects(() => notOrganizational.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "link-organizational-call", data: { sourceCaseId: "org-source", sameTask: true } }), /SOURCE_REQUIRED/);
  const incomplete = organizationalLinkFixture({ callCompletedAt: null });
  await assert.rejects(() => incomplete.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "link-organizational-call", data: { sourceCaseId: "org-source", sameTask: true } }), /COMPLETED_ORGANIZATIONAL_CALL_REQUIRED/);
});

test("organizationalcall reuse cannot substitute for fresh fullquestionnaire consent", async () => {
  const f = organizationalLinkFixture();
  f.tx.legalAcceptance.findUnique = async () => null;
  await assert.rejects(() => f.service.staffManualAction({ caseId: "case-a", actor: doctor, action: "link-organizational-call", data: { sourceCaseId: "org-source", sameTask: true } }), /FULL_PAID_QUESTIONNAIRE_REQUIRED/);
  assert.equal(f.writes.length, 0);
});
