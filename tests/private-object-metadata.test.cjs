// Storage adapter source with synthetic SDK/filesystem boundaries. No environment, file,
// socket, database or real object is accessed by the adapter in these tests.
const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const base = path.resolve(__dirname, "..");

function fixture(provider) {
  const key = "portal/materials/application-a/requirement-a/token-a/document/synthetic.pdf";
  const calls = [];
  const state = { size: 20, isFile: true, mimeType: "application/pdf", pathname: key,
    etag: "synthetic-etag" };
  const env = { NODE_ENV: "test", S3_REGION: provider === "s3" ? "synthetic" : "",
    S3_BUCKET: provider === "s3" ? "synthetic" : "",
    S3_ENDPOINT: provider === "s3" ? "https://storage.example.invalid" : "",
    S3_ACCESS_KEY_ID: provider === "s3" ? "synthetic" : "",
    S3_SECRET_ACCESS_KEY: provider === "s3" ? "synthetic" : "",
    S3_FORCE_PATH_STYLE: false, BLOB_READ_WRITE_TOKEN: provider === "blob" ? "synthetic" : "" };
  class HeadObjectCommand { constructor(input) { this.input = input; } }
  class S3Client { async send(command) { calls.push(command.input); return {
    ContentLength: state.size, ContentType: state.mimeType, ETag: state.etag }; } }
  const guard = { isPreviewIsolationRequired: () => false,
    assertPreviewStorageKey: value => calls.push({ guard: value }),
    assertPreviewAllowedOperation: () => {}, assertPreviewBlobToken: () => {},
    assertPreviewBlobSignedUrl: () => {}, assertPreviewBlobUrl: () => {} };
  const permitted = {
    "server-only": {}, "node:path": path,
    "node:fs/promises": { stat: async target => { calls.push({ stat: target });
      return { size: state.size, isFile: () => state.isFile }; } },
    "@aws-sdk/client-s3": { HeadObjectCommand, S3Client }, "@aws-sdk/s3-request-presigner": {},
    "@vercel/blob": { head: async pathname => { calls.push({ blob: pathname }); return {
      pathname: state.pathname, size: state.size, contentType: state.mimeType, etag: state.etag,
      url: `https://storage.example.invalid/${pathname}` }; } },
    "@/lib/env/server": { env }, "@/lib/preview/guard": guard, "@/lib/security/tokens": {}
  };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(base, "src/lib/storage/s3.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, URL, process: { cwd: () => base },
    require: name => { if (Object.hasOwn(permitted, name)) return permitted[name]; throw new Error(`UNEXPECTED_IMPORT:${name}`); }
  }, { filename: "src/lib/storage/s3.ts", timeout: 2000 });
  return { storage: exports, state, key, calls };
}

test("generic Blob metadata validates exact pathname, size and available MIME", async () => {
  const f = fixture("blob"); const result = await f.storage.getPrivateObjectMetadata(f.key);
  assert.equal(result.sizeBytes, 20); assert.equal(result.contentType, "application/pdf");
  assert.equal(f.calls.some(call => call.blob === f.key), true);
  for (const change of [{ pathname: "foreign/file.pdf" }, { size: 0 }, { size: 20.5 }, { mimeType: undefined }, { mimeType: "text/html\r\n" }]) {
    const invalid = fixture("blob"); Object.assign(invalid.state, change);
    await assert.rejects(() => invalid.storage.getPrivateObjectMetadata(invalid.key));
  }
});

test("generic S3 metadata uses HEAD on the exact key and refuses missing/invalid real metadata", async () => {
  const f = fixture("s3"); const result = await f.storage.getPrivateObjectMetadata(f.key);
  assert.equal(result.sizeBytes, 20); assert.equal(result.contentType, "application/pdf");
  assert.equal(f.calls.find(call => call.Key).Bucket, "synthetic");
  assert.equal(f.calls.find(call => call.Key).Key, f.key);
  for (const change of [{ size: undefined }, { size: 0 }, { size: Number.MAX_SAFE_INTEGER + 1 },
    { mimeType: undefined }, { mimeType: "application/pdf\r\n" }]) {
    const invalid = fixture("s3"); Object.assign(invalid.state, change);
    await assert.rejects(() => invalid.storage.getPrivateObjectMetadata(invalid.key));
  }
});

test("local metadata returns actual regular-file stat size without inventing MIME", async () => {
  const f = fixture("local"); const result = await f.storage.getPrivateObjectMetadata(f.key);
  assert.equal(result.sizeBytes, 20); assert.equal(result.contentType, null); assert.equal(result.etag, null);
  assert.equal(f.calls.some(call => call.stat), true);
  for (const change of [{ isFile: false }, { size: 0 }, { size: -1 }]) {
    const invalid = fixture("local"); Object.assign(invalid.state, change);
    await assert.rejects(() => invalid.storage.getPrivateObjectMetadata(invalid.key));
  }
});

test("the original manual-flow Blob helper remains Blob-only", async () => {
  for (const provider of ["s3", "local"]) {
    const f = fixture(provider);
    await assert.rejects(() => f.storage.getPrivateBlobMetadata(f.key), /Private Blob storage is required/);
    assert.equal(f.calls.some(call => call.Key || call.stat || call.blob), false);
  }
});
