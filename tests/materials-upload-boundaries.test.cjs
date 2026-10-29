// Actual materials service with in-memory boundaries only. This does not verify PostgreSQL locks,
// SDK behavior, storage networking or a deployed route. Never loads application settings or clients.
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");
const base = path.resolve(__dirname, "..");

function fixture() {
  const rawToken = "synthetic-materials-token";
  const calls = [];
  const tickets = [];
  const uploads = [];
  const token = { id: "token-a", applicationId: "application-a", requirementId: "requirement-a",
    tokenHash: "synthetic-token-hash", purpose: "MATERIALS", revokedAt: null,
    expiresAt: new Date(Date.now() + 86400000),
    application: { id: "application-a", patient: { fullName: "Synthetic patient" } },
    requirement: { id: "requirement-a", applicationId: "application-a", status: "OPEN" } };
  const state = { sizeBytes: 20, contentType: "application/pdf", afterHead: () => {}, headError: null };
  const db = {
    accessToken: { findFirst: async ({ where }) => {
      calls.push("authorize");
      return token.tokenHash === where.tokenHash && token.purpose === where.purpose &&
        token.revokedAt === null && token.expiresAt > where.expiresAt.gt ? token : null;
    } },
    auditEvent: {
      create: async ({ data }) => { const item = { id: `audit-${tickets.length}`, ...data };
        tickets.push(item); calls.push(data.action); return item; },
      findFirst: async ({ where }) => tickets.find(item =>
        Object.entries(where).every(([key, value]) => item[key] === value)) || null
    },
    applicationUpload: {
      findUnique: async ({ where }) => uploads.find(item => item.storageKey === where.storageKey) || null,
      create: async ({ data }) => { const item = { id: `upload-${uploads.length}`, durationSeconds: null, ...data };
        if (item.durationSeconds === undefined) item.durationSeconds = null;
        uploads.push(item); calls.push("attach"); return item; }
    },
    $queryRaw: async (query) => { calls.push(query.text.includes('"ApplicationRequirement"') ? "lock-requirement" : "lock-token"); return []; }
  };
  const prisma = { ...db, $transaction: async fn => fn(db) };
  const storage = {
    buildPrivateStorageKey: parts => parts.join("/"),
    createPrivateUploadUrl: async options => { calls.push("sign"); assert.equal(options.expiresInSeconds, 900);
      return "https://storage.example.invalid/synthetic-put"; },
    getPrivateObjectMetadata: async () => { calls.push("head"); state.afterHead();
      if (state.headError) throw state.headError;
      return { sizeBytes: state.sizeBytes, contentType: state.contentType, etag: "synthetic-etag" }; }
  };
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const compiled = ts.transpileModule(fs.readFileSync(path.join(base, relative), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const exports = {}; cache.set(relative, exports);
    const permitted = {
      "server-only": {}, "node:crypto": crypto,
      "@prisma/client": { Prisma: { sql: (strings, ...values) => ({ text: strings.join("?"), values }),
        TransactionIsolationLevel: { ReadCommitted: "ReadCommitted" } } },
      "@/features/applications/display-number": {}, "@/features/messages/notifications": {},
      "@/lib/db/prisma": { prisma }, "@/lib/security/encryption": { encryptSensitiveField: value => `encrypted:${value}` },
      "@/lib/security/tokens": { hashOpaqueToken: value => value === rawToken ? token.tokenHash : "invalid-token" },
      "@/lib/storage/s3": storage,
      "@/features/questionnaire/upload-validation": {
        validatePresignUpload: input => ({ extension: input.filename.split(".").at(-1).toLowerCase() }),
        validateCompletedUpload: () => {}
      }
    };
    const requireOnly = name => {
      if (Object.hasOwn(permitted, name)) return permitted[name];
      if (name === "./materials-upload-binding") return load("src/features/portal/materials-upload-binding.ts");
      throw new Error(`UNEXPECTED_IMPORT:${name}`);
    };
    vm.runInNewContext(compiled, { exports, require: requireOnly, Buffer, Date }, { filename: relative, timeout: 2000 });
    return exports;
  }
  const service = load("src/features/portal/materials-service.ts");
  const presignInput = { category: "DOCUMENT", filename: "synthetic.pdf", mimeType: "application/pdf", sizeBytes: 20 };
  async function prepare() {
    const prepared = await service.createMaterialsUploadUrl(rawToken, presignInput);
    return { category: presignInput.category, originalName: presignInput.filename, mimeType: presignInput.mimeType,
      extension: "pdf", sizeBytes: presignInput.sizeBytes, storageKey: prepared.storageKey };
  }
  return { service, rawToken, token, state, tickets, uploads, calls, prepare, presignInput };
}

test("preparation records a scope-bound opaque ticket before signing and does not expose an upload", async () => {
  const f = fixture(); const input = await f.prepare();
  assert.equal(f.uploads.length, 0);
  assert.ok(input.storageKey.startsWith("portal/materials/application-a/requirement-a/token-a/document/"));
  assert.ok(f.calls.indexOf("materials_upload_prepared") < f.calls.indexOf("sign"));
  const metadata = f.tickets[0].metadataJson;
  assert.equal(metadata.expiresAt, f.token.expiresAt.toISOString());
  assert.equal(metadata.uploadUrlTtlSeconds, 900);
  assert.match(metadata.descriptorHmac, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(metadata).includes(f.presignInput.filename), false);
  assert.equal(JSON.stringify(metadata).includes(f.rawToken), false);
});

test("invalid, revoked, expired or closed materials access is rejected before storage", async () => {
  for (const change of [f => { f.rawToken = "invalid"; }, f => { f.token.revokedAt = new Date(); },
    f => { f.token.expiresAt = new Date(0); }, f => { f.token.requirement.status = "RESOLVED"; },
    f => { f.token.requirement.applicationId = "application-b"; }]) {
    const f = fixture(); const input = await f.prepare(); change(f); f.calls.length = 0;
    await assert.rejects(() => f.service.attachMaterialsUpload(f.rawToken, input));
    assert.equal(f.calls.includes("head"), false); assert.equal(f.uploads.length, 0);
  }
});

test("foreign application, requirement, token, category and unrelated storage namespaces never reach HEAD", async () => {
  for (const replace of [key => key.replace("application-a", "application-b"), key => key.replace("requirement-a", "requirement-b"),
    key => key.replace("token-a", "token-b"), key => key.replace("/document/", "/image/"),
    () => "manual-deliverables/case-a/synthetic.pdf", key => key.replace("/document/", "/document/../")]) {
    const f = fixture(); const input = await f.prepare(); input.storageKey = replace(input.storageKey); f.calls.length = 0;
    await assert.rejects(() => f.service.attachMaterialsUpload(f.rawToken, input));
    assert.equal(f.calls.includes("head"), false); assert.equal(f.uploads.length, 0);
  }
});

test("a correctly shaped key still requires its server-prepared ticket", async () => {
  const f = fixture(); const input = await f.prepare(); f.tickets.length = 0; f.calls.length = 0;
  await assert.rejects(() => f.service.attachMaterialsUpload(f.rawToken, input));
  assert.equal(f.calls.includes("head"), false); assert.equal(f.uploads.length, 0);
});

test("descriptor substitutions cannot reuse a prepared ticket", async () => {
  for (const change of [{ originalName: "other.pdf" }, { mimeType: "application/zip" }, { sizeBytes: 21 },
    { durationSeconds: 10 }, { category: "IMAGE" }, { extension: "zip" }]) {
    const f = fixture(); const input = { ...await f.prepare(), ...change }; f.calls.length = 0;
    await assert.rejects(() => f.service.attachMaterialsUpload(f.rawToken, input));
    assert.equal(f.calls.includes("head"), false); assert.equal(f.uploads.length, 0);
  }
});

test("actual size and available MIME must match before attachment", async () => {
  for (const change of [{ sizeBytes: 21 }, { contentType: "text/html" }]) {
    const f = fixture(); const input = await f.prepare(); Object.assign(f.state, change);
    await assert.rejects(() => f.service.attachMaterialsUpload(f.rawToken, input));
    assert.equal(f.uploads.length, 0);
  }
});

test("private provider errors are replaced with a generic flow error", async () => {
  const f = fixture(); const input = await f.prepare();
  f.state.headError = new Error("synthetic-private-storage-detail");
  await assert.rejects(() => f.service.attachMaterialsUpload(f.rawToken, input), error =>
    !error.message.includes("synthetic-private-storage-detail") && error.message.includes("подтвердить"));
  assert.equal(f.uploads.length, 0);
});

test("local metadata can omit unavailable MIME while still requiring the prepared descriptor and actual size", async () => {
  const f = fixture(); const input = await f.prepare(); f.state.contentType = null;
  await f.service.attachMaterialsUpload(f.rawToken, input);
  assert.equal(f.uploads.length, 1);
});

test("token revocation, expiry and requirement closure during HEAD block final attachment", async () => {
  for (const change of [f => { f.token.revokedAt = new Date(); }, f => { f.token.expiresAt = new Date(0); },
    f => { f.token.requirement.status = "RESOLVED"; }]) {
    const f = fixture(); const input = await f.prepare(); f.state.afterHead = () => change(f);
    await assert.rejects(() => f.service.attachMaterialsUpload(f.rawToken, input));
    assert.equal(f.uploads.length, 0);
  }
});

test("an upload started during PUT validity can complete after signing expiry under still-valid access", async () => {
  const f = fixture(); const input = await f.prepare();
  f.tickets[0].metadataJson.preparedAt = new Date(Date.now() - 960000).toISOString();
  await f.service.attachMaterialsUpload(f.rawToken, input);
  assert.equal(f.uploads.length, 1);
});

test("expired prepared tickets are rejected even when current token access is valid", async () => {
  const f = fixture(); const input = await f.prepare();
  f.tickets[0].metadataJson.expiresAt = new Date(0).toISOString(); f.calls.length = 0;
  await assert.rejects(() => f.service.attachMaterialsUpload(f.rawToken, input));
  assert.equal(f.calls.includes("head"), false); assert.equal(f.uploads.length, 0);
});

test("repeated completion returns one attachment and revalidates access after requirement/token locks", async () => {
  const f = fixture(); const input = await f.prepare(); f.calls.length = 0;
  const first = await f.service.attachMaterialsUpload(f.rawToken, input);
  const second = await f.service.attachMaterialsUpload(f.rawToken, input);
  assert.equal(first.id, second.id); assert.equal(f.uploads.length, 1);
  assert.equal(f.tickets.filter(item => item.action === "materials_upload_attached").length, 1);
  const requirementLock = f.calls.indexOf("lock-requirement");
  assert.deepEqual(f.calls.slice(requirementLock, requirementLock + 3), ["lock-requirement", "lock-token", "authorize"]);
});
