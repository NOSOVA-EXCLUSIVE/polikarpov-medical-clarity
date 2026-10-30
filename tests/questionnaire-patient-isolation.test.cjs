// Focused service regression tests with a synthetic in-memory transaction boundary.
// No application startup, environment files, Prisma client, database, storage or
// notification provider is loaded. These do not prove database isolation.
// Consent signature verification and the production ownership validator are mocked.
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");
const zod = require("zod");
const base = path.resolve(__dirname, "..");

class IntakeConsentRequiredError extends Error {}

function loadService(prisma, notifications) {
  const cache = new Map();
  const mapped = {
    "@/features/legal/versions": "src/features/legal/versions.ts",
    "@/features/questionnaire/lead-flow": "src/features/questionnaire/lead-flow.ts",
    "@/features/questionnaire/service-selection": "src/features/questionnaire/service-selection.ts",
    "@/features/products/services-v21": "src/features/products/services-v21.ts",
    "@/features/questionnaire/status": "src/features/questionnaire/status.ts",
    "@/features/questionnaire/upload-validation": "src/features/questionnaire/upload-validation.ts",
    "@/features/uploads/policies": "src/features/uploads/policies.ts",
    "@/features/messages/intake-notifications": "src/features/messages/intake-notifications.ts"
  };
  const permitted = {
    "server-only": {},
    "node:crypto": crypto,
    zod,
    "@/lib/db/prisma": { prisma },
    "@/lib/preview/guard": { isPreviewIsolationRequired: () => true },
    "@/lib/security/encryption": { encryptSensitiveField: () => "synthetic-ciphertext" },
    "@/features/applications/display-number": {
      getApplicationDisplayNumber: async ({ applicationId }) => `PMC-${applicationId}`
    },
    "@/features/questionnaire/intake-consent": {
      IntakeConsentRequiredError,
      assertIntakeUploadOwnership: (storageKey, receiptId) => {
        assert.ok(storageKey.startsWith(`intake/incoming/${receiptId}/`));
      }
    },
    "@/features/questionnaire/operational-artifacts": {
      persistQuestionnaireOperationalArtifacts: async () => {
        throw new Error("UNEXPECTED_FILESYSTEM_WRITE");
      }
    },
    "@/features/messages/notifications": {
      sendQuestionnaireSubmittedStaffEmail: async (input) => {
        notifications.push(structuredClone(input));
        return { status: "captured", provider: "capture", captureId: "synthetic-staff-capture", manualFallbackRequired: false };
      },
      sendIntakeReceivedPatientEmail: async () => ({
        status: "captured", provider: "capture", captureId: "synthetic-patient-capture", manualFallbackRequired: false
      })
    }
  };
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const source = fs.readFileSync(path.join(base, relative), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const exports = {};
    cache.set(relative, exports);
    const requireOnly = (name) => {
      if (Object.hasOwn(permitted, name)) return permitted[name];
      if (mapped[name]) return load(mapped[name]);
      throw new Error(`UNEXPECTED_IMPORT:${name}`);
    };
    vm.runInNewContext(compiled, {
      exports, require: requireOnly, Date, Intl, Buffer,
      process: { env: { NODE_ENV: "production", TOKEN_HASH_SECRET: "synthetic-test-only" } }
    }, { filename: relative, timeout: 2000 });
    return exports;
  }
  return load("src/features/questionnaire/service.ts");
}

function request(receiptId = "receipt-a") {
  return { intakeConsent: { receiptId, acceptedAt: "2026-10-29T09:00:00Z", textVersion: "synthetic-consent" } };
}

function input(receiptId = "receipt-a", patient = {}) {
  return {
    isAdult: true,
    confirmsNonEmergency: true,
    requestedProductCode: "SECOND_OPINION",
    patient: {
      fullName: "Synthetic new intake", age: "40", email: "shared@example.invalid", phone: "+00000000000",
      preferredContact: "TELEGRAM", country: "Synthetic new country", city: "Synthetic new city", timezone: "Europe/Moscow",
      ...patient
    },
    caseDetails: { chiefComplaint: "Synthetic intake for regression testing" },
    redFlags: {
      hasFever: false, hasAcuteSwelling: false, unableToBearWeight: false, hasNumbness: false,
      hasWeakness: false, hasBladderOrBowelSymptoms: false, hasChestPain: false,
      hasShortnessOfBreath: false, hasConfusion: false
    },
    legal: {
      acceptedOffer: true, acceptedPrivacy: true, acceptedMedicalData: true,
      acceptedConsent: true, confirmedInformationAccuracy: true
    },
    uploads: [{ category: "DOCUMENT", originalName: "synthetic-new.pdf", mimeType: "application/pdf", extension: "pdf", sizeBytes: 10, storageKey: `intake/incoming/${receiptId}/document/synthetic-new.pdf` }],
    externalLinks: []
  };
}

function fixture({ failApplicationCreate = false } = {}) {
  let state = {
    patients: [{
      id: "patient-old", fullName: "Synthetic old patient", email: "shared@example.invalid", phone: "+00000000000",
      preferredContact: "EMAIL", country: "Synthetic old country", city: "Synthetic old city", timezone: "UTC"
    }],
    applications: [{ id: "application-old", patientId: "patient-old", chiefComplaint: "Synthetic prior case" }],
    uploads: [{ id: "upload-old", applicationId: "application-old", storageKey: "synthetic-old-file" }],
    auditEvents: [{ id: "audit-old", applicationId: "application-old", action: "questionnaire_snapshot_saved", metadataJson: { patient: { fullName: "Synthetic old patient", city: "Synthetic old city" } } }],
    consents: ["receipt-a", "receipt-b"].map((id) => ({
      id, entityId: id, actorType: "PATIENT", entityType: "TOKEN",
      action: "intake_data_consent_accepted", applicationId: null
    }))
  };
  const original = structuredClone(state);
  const notifications = [];
  const patientCalls = { lookup: 0, update: 0, create: 0 };
  const prisma = {
    $transaction: async (work) => {
      const draft = structuredClone(state);
      const tx = {
        patient: {
          findFirst: async ({ where }) => {
            patientCalls.lookup++;
            return draft.patients.find((patient) => patient.email === where.email && patient.phone === where.phone) ?? null;
          },
          update: async ({ where, data }) => {
            patientCalls.update++;
            const patient = draft.patients.find((entry) => entry.id === where.id);
            Object.assign(patient, structuredClone(data));
            return patient;
          },
          create: async ({ data }) => {
            patientCalls.create++;
            const patient = { id: `patient-new-${draft.patients.length}`, ...structuredClone(data) };
            draft.patients.push(patient);
            return patient;
          }
        },
        application: {
          create: async ({ data }) => {
            if (failApplicationCreate) throw new Error("SYNTHETIC_APPLICATION_WRITE_FAILURE");
            const application = { id: `application-new-${draft.applications.length}`, ...structuredClone(data) };
            draft.applications.push(application);
            draft.uploads.push(...application.uploads.create.map((upload) => ({ ...upload, applicationId: application.id })));
            return application;
          }
        },
        auditEvent: {
          updateMany: async ({ where, data }) => {
            assert.deepEqual(structuredClone(where), {
              id: where.id, entityId: where.id, actorType: "PATIENT", entityType: "TOKEN",
              action: "intake_data_consent_accepted", applicationId: null
            });
            const receipt = draft.consents.find((entry) =>
              Object.entries(where).every(([key, value]) => entry[key] === value));
            if (!receipt) return { count: 0 };
            Object.assign(receipt, structuredClone(data));
            return { count: 1 };
          },
          createMany: async ({ data }) => { draft.auditEvents.push(...structuredClone(data)); }
        }
      };
      const result = await work(tx);
      state = draft;
      return result;
    },
    auditEvent: { create: async ({ data }) => { state.auditEvents.push(structuredClone(data)); } }
  };
  return { get state() { return state; }, original, notifications, patientCalls, service: loadService(prisma, notifications) };
}

test("matching anonymous contacts cannot mutate or reuse an existing patient and prior case", async () => {
  const f = fixture();
  const submitted = input();
  const result = await f.service.submitQuestionnaire(submitted, request());
  const application = f.state.applications.find((entry) => entry.id === result.applicationId);
  const patient = f.state.patients.find((entry) => entry.id === application.patientId);
  assert.notEqual(patient.id, "patient-old");
  assert.equal(result.patientId, patient.id);
  assert.deepEqual(f.patientCalls, { lookup: 0, update: 0, create: 1 });
  assert.deepEqual(f.state.patients[0], f.original.patients[0]);
  assert.deepEqual(f.state.applications[0], f.original.applications[0]);
  assert.deepEqual(f.state.uploads[0], f.original.uploads[0]);
  assert.deepEqual(f.state.auditEvents[0], f.original.auditEvents[0]);
  const { age, ...patientFields } = submitted.patient;
  assert.deepEqual(patient, { id: patient.id, ...patientFields });
  assert.equal(application.uploads.create[0].storageKey, submitted.uploads[0].storageKey);
  const snapshot = f.state.auditEvents.find((event) => event.applicationId === application.id && event.action === "questionnaire_snapshot_saved");
  assert.deepEqual(snapshot.metadataJson.patient, submitted.patient);
  assert.equal(result.preferredContact, submitted.patient.preferredContact);
  assert.equal(result.workflowHooks.communication.primaryChannel, submitted.patient.preferredContact);
  assert.equal(f.notifications.length, 1);
  for (const field of ["email", "phone"]) assert.equal(f.notifications[0][`patient${field[0].toUpperCase()}${field.slice(1)}`], submitted.patient[field]);
  assert.equal(f.notifications[0].patientName, submitted.patient.fullName);
  for (const field of ["preferredContact", "country", "city", "timezone"]) assert.equal(f.notifications[0][field], submitted.patient[field]);
});

test("successive full questionnaires with identical contacts each retain their own submitted metadata", async () => {
  const f = fixture();
  const first = await f.service.submitQuestionnaire(input(), request());
  const firstPatient = structuredClone(f.state.patients.find((entry) => entry.id === first.patientId));
  const secondInput = input("receipt-b", { fullName: "Synthetic second intake", preferredContact: "WHATSAPP", city: "Synthetic second city", timezone: "UTC" });
  const second = await f.service.submitQuestionnaire(secondInput, request("receipt-b"));
  assert.notEqual(first.patientId, second.patientId);
  assert.notEqual(first.applicationId, second.applicationId);
  assert.deepEqual(f.state.patients.find((entry) => entry.id === first.patientId), firstPatient);
  assert.equal(f.state.patients.find((entry) => entry.id === second.patientId).city, secondInput.patient.city);
  assert.equal(f.state.applications.find((entry) => entry.id === first.applicationId).patientId, first.patientId);
  assert.deepEqual(f.patientCalls, { lookup: 0, update: 0, create: 2 });
  assert.equal(f.notifications[1].preferredContact, "WHATSAPP");
});

test("application write failure does not report success, retain a new patient, or notify staff", async () => {
  const f = fixture({ failApplicationCreate: true });
  await assert.rejects(() => f.service.submitQuestionnaire(input(), request()), /SYNTHETIC_APPLICATION_WRITE_FAILURE/);
  assert.deepEqual(f.state, f.original);
  assert.equal(f.notifications.length, 0);
});

test("replaying consumed intake consent cannot leave an extra patient or application", async () => {
  const f = fixture();
  await f.service.submitQuestionnaire(input(), request());
  const committed = structuredClone(f.state);
  // Omit uploads so a unique storage key violation cannot mask receipt replay.
  const replay = { ...input(), uploads: [] };
  await assert.rejects(() => f.service.submitQuestionnaire(replay, request()), IntakeConsentRequiredError);
  assert.deepEqual(f.state, committed);
  assert.equal(f.notifications.length, 1);
});
