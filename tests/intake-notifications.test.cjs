// Synthetic notification regressions. Source is transpiled only inside explicit
// mocked boundaries: no application startup, .env, real Prisma, network, storage,
// credentials or Postmark client can be reached. These do not prove inbox delivery.
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const base = path.resolve(__dirname, "..");

function loadSource(relative, permitted, extraGlobals = {}) {
  const source = fs.readFileSync(path.join(base, relative), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    },
    reportDiagnostics: true
  });
  const errors = (compiled.diagnostics || []).filter(entry => entry.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `Source must parse: ${relative}`);
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports, URL, Date, Intl, Buffer, Promise,
    process: { env: {} },
    console: { warn() {}, error() {} },
    require(name) {
      if (Object.hasOwn(permitted, name)) return permitted[name];
      throw new Error(`UNEXPECTED_IMPORT:${name}`);
    },
    ...extraGlobals
  }, { filename: relative, timeout: 2000 });
  return exports;
}

const captured = id => ({ status: "captured", provider: "capture", captureId: id, manualFallbackRequired: false });
const sent = () => ({ status: "sent", provider: "postmark", manualFallbackRequired: false });

function staffInput(overrides = {}) {
  return {
    applicationId: "synthetic-application-a",
    applicationDisplayNumber: "PMC-SYNTHETIC-030",
    patientName: "SYNTHETIC_PRIVATE_NAME",
    patientEmail: "patient@example.invalid",
    patientPhone: "+00000000000",
    preferredContact: "EMAIL",
    country: "Synthetic country",
    city: "Synthetic city",
    timezone: "UTC",
    requestedProductCode: null,
    ...overrides
  };
}

function helperFixture(options = {}) {
  const calls = [];
  const audit = [];
  const warnings = [];
  const prisma = options.prisma || {
    auditEvent: {
      create: async ({ data }) => {
        audit.push(structuredClone(data));
        if (options.audit) await options.audit(data);
        return { id: `synthetic-audit-${audit.length}` };
      }
    }
  };
  const notifications = {
    sendQuestionnaireSubmittedStaffEmail: async input => {
      calls.push({ recipient: "staff", input: structuredClone(input) });
      return options.staff ? options.staff(input) : captured("synthetic-staff-capture");
    },
    sendIntakeReceivedPatientEmail: async input => {
      calls.push({ recipient: "patient", input: structuredClone(input) });
      return options.patient ? options.patient(input) : captured("synthetic-patient-capture");
    }
  };
  const source = loadSource("src/features/messages/intake-notifications.ts", {
    "server-only": {},
    "@/lib/db/prisma": { prisma },
    "@/lib/preview/guard": { isPreviewIsolationRequired: () => options.preview !== false },
    "@/features/messages/notifications": notifications
  }, { console: { warn: message => warnings.push(message), error() {} } });
  return { ...source, calls, audit, warnings, prisma };
}

for (const kind of ["questionnaire", "organizational"]) {
  test(`${kind}: staff rejection does not prevent the patient receipt`, async () => {
    const f = helperFixture({ staff: async () => { throw new Error("SYNTHETIC_PRIVATE_PROVIDER_DETAIL"); } });
    const staff = staffInput();
    const outcome = await f.notifyIntakeReceived({ kind, staff });
    assert.equal(outcome.staff.status, "failed");
    assert.equal(outcome.patient.status, "captured");
    assert.equal(f.calls.filter(call => call.recipient === "staff").length, 1);
    assert.equal(f.calls.filter(call => call.recipient === "patient").length, 1);
    assert.equal(f.audit.length, 2);
    assert.equal(f.audit.every(event => event.applicationId === staff.applicationId), true);
    const staffEvent = f.audit.find(event => event.action.includes("staff"));
    const patientEvent = f.audit.find(event => event.action.includes("patient"));
    assert.equal(staffEvent.action, kind === "questionnaire" ? "questionnaire_staff_email_failed" : "organizational_staff_notification");
    assert.equal(patientEvent.action, kind === "questionnaire" ? "questionnaire_patient_email_captured" : "organizational_patient_notification");
    assert.equal(staffEvent.metadataJson.status, "failed");
    assert.equal(patientEvent.metadataJson.status, "captured");
    assert.equal(JSON.stringify({ outcome, audit: f.audit }).includes("SYNTHETIC_PRIVATE_PROVIDER_DETAIL"), false);
  });

  test(`${kind}: patient rejection does not invalidate the staff notification`, async () => {
    const f = helperFixture({ patient: async () => { throw new Error("SYNTHETIC_PROVIDER_REJECTION"); } });
    const outcome = await f.notifyIntakeReceived({ kind, staff: staffInput() });
    assert.equal(outcome.staff.status, "captured");
    assert.equal(outcome.patient.status, "failed");
    assert.equal(f.audit.length, 2);
    assert.equal(f.audit.find(event => event.action.includes("patient")).metadataJson.manualFallbackRequired, true);
    assert.equal(f.audit.find(event => event.action.includes("staff")).metadataJson.manualFallbackRequired, false);
    assert.equal(f.calls.length, 2);
  });
}

test("both delivery failures resolve as separate failures without retries or a false success", async () => {
  const fail = async () => { throw new Error("SYNTHETIC_SECRET_ERROR"); };
  const f = helperFixture({ staff: fail, patient: fail });
  const outcome = await f.notifyIntakeReceived({ kind: "questionnaire", staff: staffInput() });
  assert.equal(outcome.staff.status, "failed");
  assert.equal(outcome.patient.status, "failed");
  assert.equal(f.calls.length, 2);
  assert.equal(f.audit.length, 2);
  assert.equal(f.audit.every(event => event.metadataJson.status === "failed"), true);
  assert.equal(JSON.stringify(outcome).includes("SYNTHETIC_SECRET_ERROR"), false);
});

test("the patient send starts without waiting for an unresolved staff send", async () => {
  let releaseStaff;
  let patientStarted = false;
  const waiting = new Promise(resolve => { releaseStaff = resolve; });
  const f = helperFixture({
    staff: () => waiting,
    patient: async () => { patientStarted = true; return captured("synthetic-patient"); }
  });
  const pending = f.notifyIntakeReceived({ kind: "questionnaire", staff: staffInput() });
  try {
    assert.equal(patientStarted, true);
  } finally {
    releaseStaff(captured("synthetic-staff"));
  }
  const result = await pending;
  assert.equal(result.patient.status, "captured");
});

test("audit write failures cannot suppress either recipient or escape the saved intake", async () => {
  const f = helperFixture({ audit: async () => { throw new Error("SYNTHETIC_AUDIT_FAILURE"); } });
  const outcome = await f.notifyIntakeReceived({ kind: "organizational", staff: staffInput() });
  assert.equal(outcome.staff.status, "captured");
  assert.equal(outcome.patient.status, "captured");
  assert.equal(f.calls.length, 2);
  assert.equal(f.audit.length, 2);
  assert.equal(f.warnings.length, 2);
  assert.equal(f.warnings.every(message => !message.includes("SYNTHETIC_AUDIT_FAILURE")), true);
});

test("a missing patient email skips only that receipt", async () => {
  const f = helperFixture();
  const outcome = await f.notifyIntakeReceived({ kind: "organizational", staff: staffInput({ patientEmail: "  " }) });
  assert.equal(outcome.staff.status, "captured");
  assert.equal(outcome.patient.status, "skipped");
  assert.equal(outcome.patient.reason, "NO_PATIENT_EMAIL");
  assert.equal(outcome.patient.manualFallbackRequired, false);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].recipient, "staff");
  assert.equal(f.audit.find(event => event.action === "organizational_patient_notification").metadataJson.status, "skipped");
});

test("the receipt sender receives only email and the saved display number", async () => {
  const f = helperFixture();
  const staff = staffInput({ patientEmail: " patient@example.invalid ", chiefComplaint: "SYNTHETIC_MEDICAL_CONTEXT", accessUrl: "https://example.invalid/manual/access/synthetic-token" });
  await f.notifyIntakeReceived({ kind: "questionnaire", staff });
  const patient = f.calls.find(call => call.recipient === "patient").input;
  assert.deepEqual(patient, {
    patientEmail: "patient@example.invalid",
    applicationDisplayNumber: staff.applicationDisplayNumber
  });
});

test("captured test mail remains distinct from provider-accepted mail", async () => {
  const f = helperFixture({ preview: false, staff: async () => sent() });
  const outcome = await f.notifyIntakeReceived({ kind: "questionnaire", staff: staffInput() });
  assert.equal(outcome.staff.status, "sent");
  assert.equal(outcome.staff.provider, "postmark");
  assert.equal(outcome.patient.status, "captured");
  assert.equal(outcome.patient.provider, "capture");
  assert.equal(f.audit.find(event => event.action.includes("staff")).action, "questionnaire_staff_email_sent");
  assert.equal(f.audit.find(event => event.action.includes("patient")).action, "questionnaire_patient_email_captured");
});

test("malformed or unconfirmed sender results are normalized to generic failure", async () => {
  for (const bad of [
    undefined, null, {},
    { status: "sent", provider: "capture", manualFallbackRequired: false },
    { status: "captured", provider: "capture", captureId: " ", manualFallbackRequired: false },
    { status: "captured", provider: "capture", captureId: "synthetic", manualFallbackRequired: true },
    { status: "failed", provider: "postmark", errorMessage: "SYNTHETIC_SECRET_DETAIL", manualFallbackRequired: true }
  ]) {
    const f = helperFixture({ staff: async () => bad });
    const result = await f.notifyIntakeReceived({ kind: "questionnaire", staff: staffInput() });
    assert.equal(result.staff.status, "failed");
    assert.equal(result.patient.status, "captured");
    assert.equal(JSON.stringify({ result, audit: f.audit }).includes("SYNTHETIC_SECRET_DETAIL"), false);
    assert.equal(f.audit.find(event => event.action.includes("staff")).action, "questionnaire_staff_email_failed");
  }
});

test("explicitly disabled local audit does not attempt a database write", async () => {
  const f = helperFixture();
  const result = await f.notifyIntakeReceived({ kind: "questionnaire", staff: staffInput(), recordAudit: false });
  assert.equal(result.patient.status, "captured");
  assert.equal(f.calls.length, 2);
  assert.equal(f.audit.length, 0);
});

function receiptFixture(send = async () => ({ status: "captured", provider: "capture", captureId: "synthetic-receipt" })) {
  const messages = [];
  const notifications = loadSource("src/features/messages/notifications.ts", {
    "server-only": {},
    "@/features/admin/presentation": {},
    "@/features/booking/mode": {},
    "@/features/questionnaire/service-selection": {},
    "@/features/messages/content": {},
    "@/lib/db/prisma": { prisma: {} },
    "@/lib/email/postmark": { sendTransactionalEmail: async input => {
      messages.push(structuredClone(input));
      return send(input);
    } },
    "@/lib/env/server": { env: { APP_URL: "https://example.invalid" } },
    "@/lib/preview/guard": { isPreviewIsolationRequired: () => true }
  });
  return { ...notifications, messages };
}

test("actual receipt contains the approved wording and number but no private intake data or links", async () => {
  const f = receiptFixture();
  const result = await f.sendIntakeReceivedPatientEmail({
    patientEmail: "patient@example.invalid",
    applicationDisplayNumber: "PMC-SYNTHETIC-030",
    patientName: "SYNTHETIC_PRIVATE_NAME",
    chiefComplaint: "SYNTHETIC_MEDICAL_CONTEXT",
    patientPhone: "+00000000000",
    accessUrl: "https://example.invalid/manual/access/synthetic-secret-token",
    uploads: [{ originalName: "synthetic-medical-file.pdf" }]
  });
  assert.equal(result.status, "captured");
  assert.equal(f.messages.length, 1);
  const message = f.messages[0];
  assert.equal(message.to, "patient@example.invalid");
  assert.deepEqual(Object.keys(message).sort(), ["htmlBody", "subject", "textBody", "to"]);
  assert.ok(message.textBody.includes("Ваше обращение №PMC-SYNTHETIC-030 получено."));
  assert.ok(message.textBody.includes("Врач рассмотрит переданные сведения и свяжется с Вами для согласования дальнейших шагов."));
  assert.ok(message.htmlBody.includes("Ваше обращение №PMC-SYNTHETIC-030 получено."));
  const bodies = `${message.textBody}\n${message.htmlBody}`;
  for (const marker of ["SYNTHETIC_PRIVATE_NAME", "SYNTHETIC_MEDICAL_CONTEXT", "+00000000000", "synthetic-secret-token", "synthetic-medical-file.pdf", "patient@example.invalid"]) {
    assert.equal(bodies.includes(marker), false);
  }
  assert.doesNotMatch(bodies, /https?:\/\/|<a\b|href=/i);
});

test("receipt HTML escapes the displayed reference", async () => {
  const f = receiptFixture();
  await f.sendIntakeReceivedPatientEmail({ patientEmail: "patient@example.invalid", applicationDisplayNumber: "PMC-<img src=x>&\"'" });
  assert.ok(f.messages[0].htmlBody.includes("PMC-&lt;img src=x&gt;&amp;&quot;&#39;"));
  assert.doesNotMatch(f.messages[0].htmlBody, /<img\b/);
});

test("an actual receipt send rejection is not reported as sent or captured", async () => {
  const f = receiptFixture(async () => { throw new Error("SYNTHETIC_PROVIDER_FAILURE"); });
  const result = await f.sendIntakeReceivedPatientEmail({ patientEmail: "patient@example.invalid", applicationDisplayNumber: "PMC-SYNTHETIC-030" });
  assert.equal(result.status, "failed");
  assert.equal(result.manualFallbackRequired, true);
});

function adapterFixture(options = {}) {
  const preview = options.preview === true;
  const acceptance = Object.hasOwn(options, "acceptance")
    ? options.acceptance
    : { ErrorCode: 0, MessageID: "synthetic-message-id" };
  const calls = { sends: [], captures: [], constructors: 0, operations: [] };
  class FakeServerClient {
    constructor(token) {
      assert.equal(token, "synthetic-postmark-token");
      calls.constructors++;
    }
    async sendEmail(input) {
      calls.sends.push(structuredClone(input));
      return acceptance;
    }
  }
  const guard = {
    assertPreviewAllowedOperation: operation => {
      calls.operations.push(operation);
      if (preview && operation === "mail:postmark") throw new Error("REAL_MAIL_FORBIDDEN_IN_PREVIEW");
    },
    assertPreviewIsolation: () => preview ? { appUrl: "https://example.invalid" } : null,
    assertPreviewBlobToken: () => {},
    assertPreviewBlobUrl: () => {},
    assertPreviewStorageKey: key => assert.equal(key, "preview-mail/synthetic-capture-id.json"),
    isSyntheticEmail: address => address.endsWith(".invalid")
  };
  const adapter = loadSource("src/lib/email/postmark.ts", {
    "server-only": {},
    "node:crypto": { randomUUID: () => "synthetic-capture-id" },
    "@/lib/env/server": { env: {
      POSTMARK_SERVER_TOKEN: "synthetic-postmark-token",
      POSTMARK_FROM_EMAIL: "sender@example.invalid",
      POSTMARK_REPLY_TO_EMAIL: "reply@example.invalid",
      BLOB_READ_WRITE_TOKEN: "synthetic-blob-token"
    } },
    "@/lib/preview/guard": guard,
    postmark: { ServerClient: FakeServerClient },
    "@vercel/blob": { put: async (key, artifact, options) => {
      calls.captures.push({ key, artifact: JSON.parse(artifact), options: structuredClone(options) });
      return { url: `https://storage.example.invalid/${key}` };
    } }
  });
  return { ...adapter, calls };
}

function syntheticMessage(to = "patient@example.invalid") {
  return { to, subject: "Synthetic receipt", textBody: "Synthetic body", htmlBody: "<p>Synthetic body</p>" };
}

test("the production adapter reports sent only after explicit successful provider acceptance", async () => {
  const f = adapterFixture();
  const result = await f.sendTransactionalEmail(syntheticMessage());
  assert.deepEqual(structuredClone(result), { status: "sent", provider: "postmark" });
  assert.equal(f.calls.sends.length, 1);
  assert.equal(f.calls.captures.length, 0);
  assert.equal(f.calls.sends[0].To, "patient@example.invalid");
  assert.equal(f.calls.sends[0].From, "sender@example.invalid");
});

test("unconfirmed provider responses cannot become a successful send result", async () => {
  for (const acceptance of [undefined, null, {}, { ErrorCode: 1, MessageID: "synthetic" }, { MessageID: "synthetic" }, { ErrorCode: 0 }, { ErrorCode: 0, MessageID: " " }]) {
    const f = adapterFixture({ acceptance });
    await assert.rejects(() => f.sendTransactionalEmail(syntheticMessage()), /acceptance was not confirmed/);
    assert.equal(f.calls.sends.length, 1);
    assert.equal(f.calls.captures.length, 0);
  }
});

test("Preview uses private synthetic capture and cannot instantiate a Postmark sender", async () => {
  const f = adapterFixture({ preview: true });
  const result = await f.sendTransactionalEmail(syntheticMessage());
  assert.equal(result.status, "captured");
  assert.equal(result.provider, "capture");
  assert.equal(result.captureId, "synthetic-capture-id");
  assert.equal(f.calls.constructors, 0);
  assert.equal(f.calls.sends.length, 0);
  assert.equal(f.calls.captures.length, 1);
  assert.equal(f.calls.captures[0].options.access, "private");
  assert.deepEqual(f.calls.captures[0].artifact.to, ["patient@example.invalid"]);
  await assert.rejects(() => f.sendTransactionalEmail(syntheticMessage("patient@example.com")), /synthetic/);
  assert.equal(f.calls.captures.length, 1);
  assert.equal(f.calls.sends.length, 0);
});

function organizationalFixture(options = {}) {
  const state = { saved: false, applications: [], notificationCalls: [], audit: [], cookies: [] };
  const input = {
    name: "Synthetic organizational intake", email: "patient@example.invalid", phone: "",
    preferredContact: "EMAIL", country: "Synthetic country", timezone: "UTC",
    task: "Synthetic nonmedical format question", materials: "Synthetic material list"
  };
  const tx = {
    patient: { create: async () => ({ id: "synthetic-patient" }) },
    application: { create: async ({ data }) => {
      const application = { id: "synthetic-organizational-application", submittedAt: new Date("2026-10-30T00:00:00Z"), ...data };
      state.applications.push(application);
      return application;
    } },
    auditEvent: { updateMany: async () => ({ count: 1 }), update: async () => ({}), createMany: async () => ({ count: 2 }) }
  };
  const prisma = {
    $transaction: async work => {
      if (options.writeFailure) throw new Error("SYNTHETIC_WRITE_FAILURE");
      const result = await work(tx);
      state.saved = true;
      return result;
    },
    auditEvent: { create: async ({ data }) => {
      state.audit.push(structuredClone(data));
      if (options.auditFailure) throw new Error("SYNTHETIC_AUDIT_FAILURE");
      return { id: "synthetic-audit" };
    } }
  };
  const helper = helperFixture({
    prisma,
    staff: async () => {
      assert.equal(state.saved, true, "staff notification must follow the transaction commit");
      state.notificationCalls.push("staff");
      if (options.staffFailure) throw new Error("SYNTHETIC_STAFF_FAILURE");
      return captured("synthetic-staff");
    },
    patient: async () => {
      assert.equal(state.saved, true, "patient receipt must follow the transaction commit");
      state.notificationCalls.push("patient");
      if (options.patientFailure) throw new Error("SYNTHETIC_PATIENT_FAILURE");
      return captured("synthetic-patient");
    }
  });
  class SyntheticZodError extends Error {}
  const route = loadSource("src/app/api/organizational-inquiry/route.ts", {
    "next/server": { NextResponse: { json: (body, init = {}) => ({
      body: structuredClone(body), status: init.status || 200,
      cookies: { set: (...args) => state.cookies.push(args) }, headers: { set() {} }
    }) } },
    zod: { z: { ZodError: SyntheticZodError } },
    "@/features/questionnaire/intake-consent": {
      requireIntakeConsent: async () => ({ receiptId: "synthetic-consent" }),
      intakeConsentErrorResponse: () => null
    },
    "@/features/questionnaire/service-selection": { buildServiceSelectionSnapshot: () => ({ id: "service-selection" }) },
    "@/features/questionnaire/organizational-inquiry": {
      organizationalInquirySchema: { parse: value => value }, createOrganizationalContactMetadata: () => null
    },
    "@/lib/db/prisma": { prisma },
    "@/features/applications/display-number": { getApplicationDisplayNumber: async () => "PMC-SYNTHETIC-031" },
    "@/features/messages/intake-notifications": helper
  });
  const request = {
    url: "https://example.invalid/api/organizational-inquiry",
    headers: { get: name => name === "content-type" ? "application/json" : name === "origin" ? "https://example.invalid" : null },
    json: async () => input
  };
  return { state, route, request };
}

test("organizational intake stays saved and returns its number when both notifications and audits fail", async () => {
  const f = organizationalFixture({ staffFailure: true, patientFailure: true, auditFailure: true });
  const response = await f.route.POST(f.request);
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.displayNumber, "PMC-SYNTHETIC-031");
  assert.equal(f.state.saved, true);
  assert.equal(f.state.applications.length, 1);
  assert.deepEqual(f.state.notificationCalls.sort(), ["patient", "staff"]);
  assert.equal(f.state.audit.length, 2);
  assert.equal(f.state.audit.every(event => event.metadataJson.status === "failed"), true);
  assert.equal(Object.hasOwn(response.body, "emailSent"), false);
});

test("organizational persistence failure sends no notifications and reports no successful intake", async () => {
  const f = organizationalFixture({ writeFailure: true });
  const response = await f.route.POST(f.request);
  assert.equal(response.status, 503);
  assert.equal(response.body.success, false);
  assert.equal(f.state.saved, false);
  assert.equal(f.state.applications.length, 0);
  assert.equal(f.state.notificationCalls.length, 0);
});

test("full questionnaire uses the shared notification helper only after its transaction", () => {
  const source = fs.readFileSync(path.join(base, "src/features/questionnaire/service.ts"), "utf8");
  const transaction = source.indexOf("result = await prisma.$transaction");
  const resultReturn = source.indexOf("return {", source.indexOf("await notifyIntakeReceived"));
  const notification = source.indexOf("await notifyIntakeReceived");
  assert.ok(transaction >= 0 && notification > transaction && resultReturn > notification);
  assert.match(source.slice(notification, resultReturn), /kind:\s*"questionnaire"/);
  assert.match(source.slice(notification, resultReturn), /applicationDisplayNumber:\s*displayNumber/);
});

test("personal cabinet email remains an explicit staff sendLink action", () => {
  const source = fs.readFileSync(path.join(base, "src/app/api/admin/applications/[id]/manual/route.ts"), "utf8");
  const accessAction = source.indexOf('input.action === "reissue-access"');
  const optIn = source.indexOf('input.data?.sendLink === "on"', accessAction);
  const sender = source.indexOf("await sendTransactionalEmail", accessAction);
  assert.ok(accessAction >= 0 && optIn > accessAction && sender > optIn);
  const intake = fs.readFileSync(path.join(base, "src/features/messages/intake-notifications.ts"), "utf8");
  assert.doesNotMatch(intake, /createManualGrant|reissue-access|\/manual\/access\//);
});
