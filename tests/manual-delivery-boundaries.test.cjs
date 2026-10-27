// Actual delivery module, transpiled in a VM with explicit in-memory DB/storage/fetch boundaries.
// No application startup, environment, SDK, real fetch, database or object storage is loaded.
// These verify application gates, not Blob SDK/network/PostgreSQL behavior.
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");
const base = path.resolve(__dirname, "..");

function fixture() {
  const bytes = Buffer.from("%PDF-1.7\nsynthetic\n");
  const record = { id: "case-a", applicationId: "application-a", phase: "ACTIVE", version: 0 };
  const files = [{ id: "file-a", caseId: "case-a", status: "PENDING", title: "Synthetic material", mimeType: "application/pdf",
    sizeBytes: BigInt(bytes.length), storageKey: "manual-deliverables/case-a/synthetic.pdf", verifiedEtag: null }];
  const calls = [];
  const state = { actorActive: true, headSize: bytes.length, headType: "application/pdf", headEtag: '"synthetic-etag"',
    getHostname: "synthetic.private.blob.vercel-storage.com", getStatus: 206, prefix: bytes,
    putHost: "vercel.com", objectStatus: 200 };
  const tx = {
    user: { findFirst: async () => state.actorActive ? { role: "DOCTOR" } : null },
    manualCase: {
      findUnique: async ({ where }) => where.id === record.id ? record : null,
      updateMany: async ({ where }) => { if (where.id !== record.id || where.version !== record.version) return { count: 0 };
        record.version += 1; return { count: 1 }; }
    },
    manualDeliverable: {
      findFirst: async ({ where }) => files.find(file => file.id === where.id && file.caseId === where.caseId &&
        (!where.status || file.status === where.status)) || null,
      create: async ({ data }) => { const file = { id: `file-${files.length + 1}`, verifiedEtag: null, ...data }; files.push(file); calls.push("create"); return file; },
      update: async ({ where, data }) => { const file = files.find(file => file.id === where.id); Object.assign(file, data); calls.push("ready"); return file; }
    },
    auditEvent: { create: async () => ({}) }
  };
  const prisma = { ...tx, $transaction: async fn => fn(tx) };
  const storage = {
    createPrivateUploadUrl: async ({ key }) => {
      assert.equal(files.find(file => file.storageKey === key)?.status, "PENDING", "PENDING must exist before signed URL");
      calls.push("presign"); return `https://${state.putHost}/api/blob/?pathname=${encodeURIComponent(key)}`;
    },
    createPrivateDownloadUrl: async ({ key }) => `https://${state.getHostname}/${key}?synthetic=not-a-real-signature`,
    getPrivateBlobMetadata: async () => { calls.push("head"); return { sizeBytes: state.headSize, contentType: state.headType, etag: state.headEtag }; },
    privateObjectExists: async () => true, deletePrivateObject: async () => { calls.push("delete"); }
  };
  const fakeFetch = async (url, options) => {
    calls.push({ fetch: String(url), options });
    if (options.headers.Range && options.headers.Range.startsWith("bytes=0-")) {
      return new Response(state.prefix, { status: state.getStatus, headers: state.getStatus === 206 ? {
        "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}` } : {} });
    }
    return new Response(state.objectStatus === 200 ? bytes : null, { status: state.objectStatus });
  };
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const compiled = ts.transpileModule(fs.readFileSync(path.join(base, relative), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const exports = {}; cache.set(relative, exports);
    const permitted = { "server-only": {}, "node:crypto": crypto,
      "@prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
      "@/lib/db/prisma": { prisma }, "@/lib/storage/s3": storage,
      "@/lib/preview/guard": { assertPreviewIsolation: () => ({ pins: { blobHostname: "synthetic.private.blob.vercel-storage.com" } }) } };
    const requireOnly = name => {
      if (Object.hasOwn(permitted, name)) return permitted[name];
      if (name === "./delivery-policy") return load("src/features/manual-v21/delivery-policy.ts");
      throw new Error(`UNEXPECTED_IMPORT:${name}`);
    };
    vm.runInNewContext(compiled, { exports, require: requireOnly, Buffer, URL, Headers, Response,
      ReadableStream, AbortSignal, fetch: fakeFetch, Set, Date }, { filename: relative, timeout: 2000 });
    return exports;
  }
  return { service: load("src/features/manual-v21/delivery.ts"), bytes, record, files, state, calls };
}

test("prepare creates unpublished pending record before issuing a case-bound PUT URL", async () => {
  const f = fixture();
  const result = await f.service.prepareManualDeliverableUpload({ caseId: "case-a", actorId: "doctor-a",
    title: "Synthetic material", mimeType: "video/mp4", sizeBytes: 20 * 1024 * 1024 });
  assert.deepEqual(f.calls.slice(0, 2), ["create", "presign"]);
  const file = f.files.find(file => file.id === result.id);
  assert.equal(file.status, "PENDING"); assert.equal(file.verifiedEtag, null);
  assert.equal(new URL(result.uploadUrl).searchParams.get("pathname"), file.storageKey);
});

test("foreign PUT endpoint is rejected without publishing the pending record", async () => {
  const f = fixture(); f.state.putHost = "foreign.invalid";
  await assert.rejects(() => f.service.prepareManualDeliverableUpload({ caseId: "case-a", actorId: "doctor-a",
    title: "Synthetic material", mimeType: "video/mp4", sizeBytes: 100 }), /Недопустимый адрес загрузки/);
  assert.equal(f.files.at(-1).status, "PENDING"); assert.equal(f.calls.includes("ready"), false);
});

test("completion refuses another case before any storage request", async () => {
  const f = fixture();
  await assert.rejects(() => f.service.completeManualDeliverableUpload({ caseId: "case-b", id: "file-a", actorId: "doctor-a" }), /не найдена/);
  assert.equal(f.calls.length, 0);
});

test("head metadata mismatch cannot publish a file", async () => {
  for (const change of [{ headSize: 999 }, { headType: "text/html" }]) {
    const f = fixture(); Object.assign(f.state, change);
    await assert.rejects(() => f.service.completeManualDeliverableUpload({ caseId: "case-a", id: "file-a", actorId: "doctor-a" }), /Размер или тип/);
    assert.equal(f.files[0].status, "PENDING"); assert.equal(f.calls.some(c => c.fetch), false);
  }
});

test("completion requires exact storage host, Range response and file signature", async () => {
  for (const change of [{ getHostname: "foreign.invalid" }, { getStatus: 200 }, { prefix: Buffer.alloc(Buffer.byteLength("%PDF-1.7\nsynthetic\n"), 60) }]) {
    const f = fixture(); Object.assign(f.state, change);
    await assert.rejects(() => f.service.completeManualDeliverableUpload({ caseId: "case-a", id: "file-a", actorId: "doctor-a" }));
    assert.equal(f.files[0].status, "PENDING"); assert.equal(f.calls.includes("ready"), false);
  }
});

test("verified pending file becomes ready with the exact ETag", async () => {
  const f = fixture();
  await f.service.completeManualDeliverableUpload({ caseId: "case-a", id: "file-a", actorId: "doctor-a" });
  assert.equal(f.files[0].status, "READY"); assert.equal(f.files[0].verifiedEtag, f.state.headEtag);
  assert.equal(f.calls.find(c => c.fetch).options.headers["If-Match"], f.state.headEtag);
});

test("case completion or staff revocation blocks publication after a valid upload", async () => {
  for (const change of [f => { f.record.phase = "COMPLETED"; }, f => { f.state.actorActive = false; }]) {
    const f = fixture(); change(f);
    await assert.rejects(() => f.service.completeManualDeliverableUpload({ caseId: "case-a", id: "file-a", actorId: "doctor-a" }));
    assert.equal(f.files[0].status, "PENDING"); assert.equal(f.calls.includes("ready"), false);
  }
});

test("pending, foreign-case and unverified files are not downloadable", async () => {
  const f = fixture();
  await assert.rejects(() => f.service.getManualDeliverableResponse({ caseId: "case-a", id: "file-a", range: null }));
  f.files[0].status = "READY";
  await assert.rejects(() => f.service.getManualDeliverableResponse({ caseId: "case-b", id: "file-a", range: null }));
  await assert.rejects(() => f.service.getManualDeliverableResponse({ caseId: "case-a", id: "file-a", range: null }), /целостности/);
  assert.equal(f.calls.length, 0);
});

test("proxy uses verified ETag, streams exact content, and rejects changed object", async () => {
  const f = fixture(); Object.assign(f.files[0], { status: "READY", verifiedEtag: f.state.headEtag });
  const response = await f.service.getManualDeliverableResponse({ caseId: "case-a", id: "file-a", range: null });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), f.bytes);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(f.calls.find(c => c.fetch).options.headers["If-Match"], f.state.headEtag);
  f.state.objectStatus = 412;
  await assert.rejects(() => f.service.getManualDeliverableResponse({ caseId: "case-a", id: "file-a", range: null }), /Файл изменился/);
});
