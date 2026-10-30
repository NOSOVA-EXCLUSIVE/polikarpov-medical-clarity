"use strict";

// One opt-in Git build only. Future commits and production do not open clients.
// This is evidence collection, not a delivery task or a permanent fixture gate.
const OPT_IN_COMMIT_MESSAGE = "verify: inspect synthetic intake mail captures";
let stage = "ISOLATION";
if (process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_MESSAGE?.trim() === OPT_IN_COMMIT_MESSAGE) {
  inspectEvidence().catch(() => {
    // Never serialize SDK/Prisma errors, credentials, private URLs or mail bodies.
    console.log("MAIL_PREVIEW_EVIDENCE " + JSON.stringify({
      status: "unavailable", reason: "READ_OR_VALIDATION_FAILED", stage, verifiedArtifacts: 0
    }));
  });
}

async function inspectEvidence() {
  const guard = require("./core.cjs");
  const context = guard.assertPreviewIsolation();
  guard.assertPreviewAllowedOperation("database");
  guard.assertPreviewAllowedOperation("storage:blob");
  guard.assertPreviewDatabaseUrl(process.env.DIRECT_URL);
  guard.assertPreviewBlobToken(process.env.BLOB_READ_WRITE_TOKEN);

  // Imports and connections occur only after the full existing isolation guard.
  const { PrismaClient } = require("@prisma/client");
  const { get } = require("@vercel/blob");
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } }, log: []
  });
  const start = new Date("2026-10-29T21:00:00Z");
  const end = new Date("2026-10-30T21:00:00Z");
  const fixtures = [
    { kind: "organizational", email: "qa-selection@example.invalid", number: "PMC-20261030-001" },
    { kind: "questionnaire", email: "qa-full@example.invalid", number: "PMC-20261030-002" }
  ];
  const actions = [
    "organizational_staff_notification", "organizational_patient_notification",
    ...["staff", "patient"].flatMap((recipient) =>
      ["sent", "captured", "failed", "skipped"].map((status) => `questionnaire_${recipient}_email_${status}`))
  ];
  let applications;
  stage = "READ_FIXTURES";
  try {
    applications = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '10000ms'");
      const results = [];
      for (const fixture of fixtures) {
        results.push(await tx.application.findMany({
          where: { patient: { email: fixture.email }, submittedAt: { gte: start, lt: end } },
          // Never load medical fields, uploaded objects, grants or patient contacts.
          select: {
            id: true,
            auditEvents: {
              where: { action: { in: actions } }, take: 10,
              select: { action: true, metadataJson: true, createdAt: true }
            }
          },
          take: 2
        }));
      }
      return results;
    }, { timeout: 25000, maxWait: 10000 });
  } finally {
    await prisma.$disconnect();
  }

  const evidence = [];
  const seenCaptureIds = new Set();
  for (let index = 0; index < fixtures.length; index++) {
    const fixture = fixtures[index];
    stage = `${fixture.kind.toUpperCase()}_FIXTURE`;
    const matches = applications[index];
    ensure(matches.length === 1 && matches[0].auditEvents.length === 2);
    const application = matches[0];
    for (const recipient of ["staff", "patient"]) {
      stage = `${fixture.kind.toUpperCase()}_${recipient.toUpperCase()}_AUDIT`;
      const action = fixture.kind === "organizational"
        ? `organizational_${recipient}_notification`
        : `questionnaire_${recipient}_email_captured`;
      const matching = application.auditEvents.filter((event) => event.action === action);
      ensure(matching.length === 1);
      const event = matching[0];
      ensure(event.createdAt >= start && event.createdAt < end);
      const metadata = event.metadataJson;
      ensure(metadata && metadata.status === "captured" && metadata.provider === "capture" &&
        metadata.manualFallbackRequired === false &&
        typeof metadata.captureId === "string" &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(metadata.captureId) &&
        !seenCaptureIds.has(metadata.captureId));
      seenCaptureIds.add(metadata.captureId);
      const key = `preview-mail/${metadata.captureId}.json`;
      guard.assertPreviewStorageKey(key);
      // SDK pathname construction preserves token store-ID case. Use the exact
      // already pinned canonical hostname, validating it before the request too.
      const blobUrl = `https://${context.pins.blobHostname}/${key}`;
      guard.assertPreviewBlobUrl(blobUrl, key);
      stage = `${fixture.kind.toUpperCase()}_${recipient.toUpperCase()}_BLOB`;
      const result = await get(blobUrl, {
        access: "private", token: process.env.BLOB_READ_WRITE_TOKEN,
        useCache: false, abortSignal: AbortSignal.timeout(10000)
      });
      ensure(result?.statusCode === 200 && result.stream);
      guard.assertPreviewBlobUrl(result.blob.url, key);
      ensure(result.blob.pathname === key &&
        /^application\/json(?:;|$)/i.test(result.blob.contentType) &&
        // SDK reports zero if Content-Length is absent; bound actual bytes below.
        Number.isSafeInteger(result.blob.size) && result.blob.size >= 0 && result.blob.size <= 256 * 1024);
      const artifact = await readJson(result.stream);
      stage = `${fixture.kind.toUpperCase()}_${recipient.toUpperCase()}_CONTENT`;
      const expectedKeys = ["deliveryMode", "captureId", "capturedAt", "from", "replyTo", "to", "subject", "htmlBody", "textBody"];
      ensure(artifact && !Array.isArray(artifact) &&
        Object.keys(artifact).sort().join("|") === expectedKeys.sort().join("|") &&
        artifact.deliveryMode === "capture" && artifact.captureId === metadata.captureId &&
        new Date(artifact.capturedAt) >= start && new Date(artifact.capturedAt) < end &&
        artifact.from === process.env.POSTMARK_FROM_EMAIL &&
        artifact.replyTo === process.env.POSTMARK_REPLY_TO_EMAIL &&
        Array.isArray(artifact.to) && artifact.to.length === 1 &&
        artifact.to.every(guard.isSyntheticEmail) &&
        artifact.to[0] === (recipient === "patient" ? fixture.email : process.env.STAFF_NOTIFICATION_EMAIL) &&
        typeof artifact.subject === "string" && typeof artifact.textBody === "string" && typeof artifact.htmlBody === "string");
      if (recipient === "patient") {
        const message = `Ваше обращение №${fixture.number} получено.`;
        const followUp = "Врач рассмотрит переданные сведения и свяжется с Вами для согласования дальнейших шагов.";
        const signatureText = "С уважением,\nPOLIKARPOV MEDICAL CLARITY\n\nЖелаем Вам здоровья и спокойного восстановления.";
        const signatureHtml = "<p>С уважением,<br />POLIKARPOV MEDICAL CLARITY</p><p>Желаем Вам здоровья и спокойного восстановления.</p>";
        ensure(artifact.subject === "Polikarpov Medical Clarity — обращение получено" &&
          artifact.textBody === `${message}\n\n${followUp}\n\n${signatureText}` &&
          artifact.htmlBody === `<p>${message}</p><p>${followUp}</p>${signatureHtml}`);
      } else {
        ensure(artifact.subject.startsWith("Новая анкета · ") &&
          artifact.textBody.split("\n").includes(`Номер анкеты: ${fixture.number}`) &&
          artifact.textBody.split("\n").includes(`Email: ${fixture.email}`) &&
          artifact.htmlBody.includes(`<p><strong>Номер анкеты:</strong> ${fixture.number}</p>`));
        // Historical mail belongs to the submission deployment, not this build.
        const links = [...artifact.htmlBody.matchAll(/href="([^"]+)"/g)];
        ensure(links.length === 1);
        const adminUrl = new URL(links[0][1]);
        ensure(adminUrl.protocol === "https:" && !adminUrl.username && !adminUrl.password &&
          !adminUrl.port && !adminUrl.search && !adminUrl.hash &&
          /^polikarpov-medical-clarity-[a-z0-9]+\.vercel\.app$/.test(adminUrl.hostname) &&
          adminUrl.pathname === `/admin/applications/${application.id}` &&
          artifact.textBody.includes(`Открыть в admin: ${adminUrl.href}`));
      }
      evidence.push({ kind: fixture.kind, recipient, auditCaptured: true,
        artifactRead: true, syntheticEnvelopeVerified: true, applicationNumberVerified: true,
        ...(recipient === "patient" ? { exactAcknowledgmentVerified: true } : { adminLinkVerified: true }) });
    }
  }
  console.log("MAIL_PREVIEW_EVIDENCE " + JSON.stringify({
    status: "verified", verifiedArtifacts: evidence.length, fixtures: evidence,
    databaseReadOnly: true, newSubmissions: 0, realEmailsSent: 0, productionTouched: false
  }));
}

function ensure(condition) {
  if (!condition) throw new Error("Synthetic mail evidence not verified.");
}

async function readJson(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      ensure(size <= 256 * 1024);
      chunks.push(Buffer.from(item.value));
    }
    ensure(size > 0);
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
