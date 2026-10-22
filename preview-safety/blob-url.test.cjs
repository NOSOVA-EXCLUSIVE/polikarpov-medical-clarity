"use strict";

// Standalone offline contract tests: run directly with node, not node --test.
// The real core source runs in a VM with an entirely synthetic environment/pins.
// No app, SDK, .env, real credentials, network, or child processes are loaded.
// Fixtures model the SDK 2.4.0 URL contract; SDK equivalence is a separate check.
const assert = require("node:assert/strict");
const { createHash, createHmac } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const corePath = path.join(__dirname, "core.cjs");
const coreSource = readFileSync(corePath, "utf8");
const NOW = 2_000_000_000_000;
const KEY = "intake/incoming/document/synthetic-fixture.pdf";
const CONTENT_TYPE = "application/pdf";
const MAX_BYTES = 512;
const DEADLINE = NOW + 60_000;
const FAKE_BLOB_TOKEN = "synthetic-blob-credential-never-valid-at-any-provider";
const CLIENT_SIGNING_TOKEN = "synthetic-client-signing-token-for-offline-fixtures";
const pins = Object.freeze({
  ready: true,
  branch: "codex/offline-fixture-only",
  vercelProjectId: "prj_offline_fixture_only",
  neonProjectId: "offline-project-only",
  neonBranchId: "br-offline-fixture-only",
  databaseName: "offline_fixture",
  databaseRole: "offline_owner",
  databaseHostnames: Object.freeze(["ep-offline-fixture.example.neon.tech"]),
  blobStoreId: "store_fixture123",
  blobHostname: "fixture123.private.blob.vercel-storage.com",
  blobTokenSha256: createHash("sha256").update(FAKE_BLOB_TOKEN).digest("hex")
});

const syntheticEnv = Object.freeze({
  VERCEL: "1",
  VERCEL_ENV: "preview",
  NODE_ENV: "production",
  VERCEL_PROJECT_ID: pins.vercelProjectId,
  VERCEL_GIT_COMMIT_REF: pins.branch,
  VERCEL_URL: "offline-fixture-only.vercel.app",
  MC_PREVIEW_ISOLATION: "1",
  MC_PREVIEW_MAIL_MODE: "capture",
  MC_PREVIEW_PAYMENTS_MODE: "disabled",
  MC_PREVIEW_JOBS_MODE: "disabled",
  BOOKING_MODE: "manual",
  DATABASE_URL: "postgresql://offline_owner:synthetic-only@ep-offline-fixture.example.neon.tech/offline_fixture?sslmode=require",
  DIRECT_URL: "postgresql://offline_owner:synthetic-only@ep-offline-fixture.example.neon.tech/offline_fixture?sslmode=require",
  BLOB_READ_WRITE_TOKEN: FAKE_BLOB_TOKEN,
  BLOB_STORE_ID: pins.blobStoreId,
  S3_REGION: "disabled-for-preview",
  S3_BUCKET: "disabled-for-preview",
  S3_ENDPOINT: "disabled-for-preview",
  S3_ACCESS_KEY_ID: "disabled-for-preview",
  S3_SECRET_ACCESS_KEY: "disabled-for-preview",
  BLOB_WEBHOOK_PUBLIC_KEY: "disabled-for-preview",
  STRIPE_SECRET_KEY: "disabled-for-preview",
  STRIPE_WEBHOOK_SECRET: "disabled-for-preview",
  POSTMARK_SERVER_TOKEN: "disabled-for-preview",
  INNGEST_APP_ID: "disabled-for-preview",
  INNGEST_EVENT_KEY: "disabled-for-preview",
  INNGEST_SIGNING_KEY: "disabled-for-preview",
  POSTMARK_FROM_EMAIL: "from@fixture.invalid",
  POSTMARK_REPLY_TO_EMAIL: "reply@fixture.invalid",
  STAFF_NOTIFICATION_EMAIL: "staff@fixture.invalid",
  ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString("base64"),
  TOKEN_HASH_SECRET: "synthetic-token-secret-offline-only-0000000000",
  STAFF_SESSION_SECRET: "synthetic-session-secret-offline-only-0000000",
  APP_URL: "https://mc-preview.invalid"
});

class FixedDate extends Date {
  constructor(...args) {
    if (args.length === 0) super(NOW);
    else super(...args);
  }
  static now() { return NOW; }
}

function loadGuard(envOverrides = {}, pinOverrides = {}) {
  const fakeEnv = Object.freeze({ ...syntheticEnv, ...envOverrides });
  const fakePins = Object.freeze({ ...pins, ...pinOverrides });
  const moduleObject = { exports: {} };
  const context = vm.createContext({
    module: moduleObject,
    exports: moduleObject.exports,
    process: Object.freeze({ env: fakeEnv }),
    Buffer,
    URL,
    Date: FixedDate,
    require(name) {
      if (name === "node:crypto") return require("node:crypto");
      if (name === "./pins.cjs") return fakePins;
      throw new Error("Offline fixture forbids unexpected module imports.");
    }
  });
  vm.runInContext(coreSource, context, { filename: corePath, timeout: 1_000 });
  return moduleObject.exports;
}

function delegationToken(scope) {
  return `${Buffer.from(JSON.stringify(scope)).toString("base64url")}.${Buffer.from("synthetic-server-signature").toString("base64url")}`;
}

function expectedContext(operation = "get", overrides = {}, scopeOverrides = {}) {
  const key = overrides.key ?? KEY;
  const scope = {
    storeId: pins.blobStoreId,
    pathname: key,
    operations: [operation],
    validUntil: NOW + 30_000,
    ...(operation === "put" ? {
      allowedContentTypes: [CONTENT_TYPE],
      maximumSizeInBytes: MAX_BYTES
    } : {}),
    ...scopeOverrides
  };
  return {
    key,
    operation,
    signedToken: {
      delegationToken: delegationToken(scope),
      clientSigningToken: CLIENT_SIGNING_TOKEN
    },
    validUntil: DEADLINE,
    ...(operation === "put" ? {
      contentType: CONTENT_TYPE,
      maximumSizeInBytes: MAX_BYTES
    } : {}),
    ...overrides
  };
}

function signedUrl(expected) {
  const isPut = expected.operation === "put";
  const url = new URL(isPut
    ? "https://vercel.com/api/blob/"
    : `https://${pins.blobHostname}/${expected.key}`);
  if (isPut) {
    url.searchParams.set("pathname", expected.key);
    url.searchParams.set("vercel-blob-add-random-suffix", "false");
    if (expected.contentType !== undefined) {
      url.searchParams.set("vercel-blob-allowed-content-types", expected.contentType);
    }
    if (expected.maximumSizeInBytes !== undefined) {
      url.searchParams.set("vercel-blob-maximum-size-in-bytes", String(expected.maximumSizeInBytes));
    }
  }
  const signingParameters = [
    `operation=${expected.operation}`,
    `pathname=${expected.key}`,
    ...[...url.searchParams]
      .filter(([name]) => name.startsWith("vercel-blob-"))
      .map(([name, value]) => `${name}=${value}`)
  ].sort().join("\n");
  url.searchParams.set("vercel-blob-delegation", expected.signedToken.delegationToken);
  url.searchParams.set("vercel-blob-signature", createHmac("sha256", expected.signedToken.clientSigningToken)
    .update(signingParameters).digest("base64url"));
  return url.toString();
}

function mutateUrl(value, edit) {
  const url = new URL(value);
  edit(url);
  return url.toString();
}

function blocked(action, code = "BLOB_URL_INVALID_OR_UNPINNED") {
  assert.throws(action, (error) => error?.message === `Preview isolation blocked: ${code}`);
}

let passed = 0;
let failed = 0;
function test(name, action) {
  try {
    action();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const guard = loadGuard();
const plain = `https://${pins.blobHostname}/${KEY}`;
const getContext = expectedContext("get");
const putContext = expectedContext("put");
const getUrl = signedUrl(getContext);
const putUrl = signedUrl(putContext);

test("synthetic environment reaches the pinned Preview path", () => {
  assert.equal(guard.assertPreviewIsolation().appUrl, "https://offline-fixture-only.vercel.app");
});
test("plain private object URL matches its exact key", () => guard.assertPreviewBlobUrl(plain, KEY));
test("GET signed fixture is accepted", () => guard.assertPreviewBlobSignedUrl(getUrl, getContext));
test("PUT SDK API endpoint fixture is accepted", () => guard.assertPreviewBlobSignedUrl(putUrl, putContext));
test("GET delegation accepts the store ID without its store_ prefix", () => {
  const expected = expectedContext("get", {}, { storeId: "fixture123" });
  guard.assertPreviewBlobSignedUrl(signedUrl(expected), expected);
});
test("query order is semantically irrelevant", () => {
  const reordered = new URL(putUrl);
  const entries = [...reordered.searchParams].reverse();
  reordered.search = "";
  for (const [key, value] of entries) reordered.searchParams.append(key, value);
  guard.assertPreviewBlobSignedUrl(reordered.toString(), putContext);
});

for (const [name, value] of [
  ["public host", plain.replace(".private.", ".public.")],
  ["different private store", plain.replace("fixture123.", "anotherstore.")],
  ["suffix host", plain.replace(pins.blobHostname, `${pins.blobHostname}.invalid`)],
  ["userinfo", plain.replace("https://", "https://fixture:fixture@")],
  ["explicit default port", plain.replace(pins.blobHostname, `${pins.blobHostname}:443`)],
  ["HTTP", plain.replace("https://", "http://")],
  ["wrong object key", plain.replace("synthetic-fixture.pdf", "another.pdf")],
  ["percent-encoded path", plain.replace("/intake/", "/%69ntake/")],
  ["dot traversal before normalization", plain.replace("/intake/", "/intake/../intake/")],
  ["fragment", `${plain}#fixture`],
  ["plain URL query", `${plain}?fixture=1`],
  ["signed URL passed as plain", getUrl],
  ["missing object key", `https://${pins.blobHostname}/`]
]) {
  test(`plain rejects ${name}`, () => blocked(() => guard.assertPreviewBlobUrl(value, KEY)));
}
for (const invalidKey of [undefined, "", "/intake/file.pdf", "intake/../file.pdf", "intake//file.pdf", "intake\\file.pdf", "intake/%2f.pdf", "intake/file.pdf?x=1"]) {
  test(`plain rejects invalid expected key ${String(invalidKey)}`, () => blocked(() => guard.assertPreviewBlobUrl(plain, invalidKey)));
}

for (const [name, operation, edit] of [
  ["GET wrong host", "get", (url) => { url.hostname = "other.private.blob.vercel-storage.com"; }],
  ["GET public host", "get", (url) => { url.hostname = "fixture123.public.blob.vercel-storage.com"; }],
  ["GET wrong path", "get", (url) => { url.pathname = "/intake/other.pdf"; }],
  ["GET copied onto PUT API", "get", (url) => { url.hostname = "vercel.com"; url.pathname = "/api/blob/"; }],
  ["PUT wrong API host", "put", (url) => { url.hostname = "api.vercel.com"; }],
  ["PUT private object host", "put", (url) => { url.hostname = pins.blobHostname; url.pathname = `/${KEY}`; }],
  ["PUT wrong API path", "put", (url) => { url.pathname = "/api/blob"; }],
  ["PUT wrong pathname query", "put", (url) => { url.searchParams.set("pathname", "intake/other.pdf"); }],
  ["PUT random suffix enabled", "put", (url) => { url.searchParams.set("vercel-blob-add-random-suffix", "true"); }],
  ["PUT unexpected access override", "put", (url) => { url.searchParams.set("vercel-blob-access", "public"); }],
  ["GET extra query", "get", (url) => { url.searchParams.set("unexpected", "fixture"); }],
  ["GET missing delegation", "get", (url) => { url.searchParams.delete("vercel-blob-delegation"); }],
  ["GET duplicate delegation", "get", (url) => { url.searchParams.append("vercel-blob-delegation", "synthetic"); }],
  ["PUT duplicate pathname", "put", (url) => { url.searchParams.append("pathname", KEY); }],
  ["GET missing signature", "get", (url) => { url.searchParams.delete("vercel-blob-signature"); }],
  ["GET mutated signature", "get", (url) => { url.searchParams.set("vercel-blob-signature", "synthetic-wrong-signature"); }],
  ["GET duplicate signature", "get", (url) => { url.searchParams.append("vercel-blob-signature", "synthetic"); }],
  ["PUT changed content type", "put", (url) => { url.searchParams.set("vercel-blob-allowed-content-types", "image/png"); }],
  ["PUT changed size limit", "put", (url) => { url.searchParams.set("vercel-blob-maximum-size-in-bytes", "1024"); }]
]) {
  test(`signed rejects ${name}`, () => {
    const expected = operation === "get" ? getContext : putContext;
    blocked(() => guard.assertPreviewBlobSignedUrl(mutateUrl(signedUrl(expected), edit), expected));
  });
}

for (const [name, scopePatch] of [
  ["another store", { storeId: "store_anotherfixture" }],
  ["another delegated key", { pathname: "intake/another.pdf" }],
  ["wrong operation", { operations: ["put"] }],
  ["multiple operations", { operations: ["get", "put"] }],
  ["empty operation scope", { operations: [] }],
  ["expired delegation", { validUntil: NOW - 1 }],
  ["delegation expiring now", { validUntil: NOW }],
  ["scope beyond expected deadline", { validUntil: DEADLINE + 1 }],
  ["fractional expiration", { validUntil: NOW + 0.5 }]
]) {
  test(`delegation rejects ${name}`, () => {
    const expected = expectedContext("get", {}, scopePatch);
    blocked(() => guard.assertPreviewBlobSignedUrl(signedUrl(expected), expected));
  });
}
test("PUT rejects scope content type mismatch", () => {
  const expected = expectedContext("put", {}, { allowedContentTypes: ["image/png"] });
  blocked(() => guard.assertPreviewBlobSignedUrl(signedUrl(expected), expected));
});
test("PUT rejects multiple scope content types", () => {
  const expected = expectedContext("put", {}, { allowedContentTypes: [CONTENT_TYPE, "image/png"] });
  blocked(() => guard.assertPreviewBlobSignedUrl(signedUrl(expected), expected));
});
test("PUT rejects scope size mismatch", () => {
  const expected = expectedContext("put", {}, { maximumSizeInBytes: MAX_BYTES + 1 });
  blocked(() => guard.assertPreviewBlobSignedUrl(signedUrl(expected), expected));
});
test("signed context rejects delete operation", () => blocked(() => guard.assertPreviewBlobSignedUrl(getUrl, { ...getContext, operation: "delete" })));
test("signed context rejects missing signing token", () => blocked(() => guard.assertPreviewBlobSignedUrl(getUrl, {
  ...getContext, signedToken: { ...getContext.signedToken, clientSigningToken: "" }
})));
test("signed context rejects another signing secret", () => blocked(() => guard.assertPreviewBlobSignedUrl(getUrl, {
  ...getContext, signedToken: { ...getContext.signedToken, clientSigningToken: "synthetic-other-secret" }
})));
test("signed context rejects malformed delegation", () => blocked(() => guard.assertPreviewBlobSignedUrl(getUrl, {
  ...getContext, signedToken: { ...getContext.signedToken, delegationToken: "not-a-delegation" }
})));
test("signed context rejects absent context", () => blocked(() => guard.assertPreviewBlobSignedUrl(getUrl, null)));

for (const variable of ["VERCEL_BLOB_API_URL", "NEXT_PUBLIC_VERCEL_BLOB_API_URL"]) {
  const blockedGuard = loadGuard({ [variable]: "https://offline-override.invalid" });
  test(`${variable} blocks isolation before SDK`, () => blocked(
    () => blockedGuard.assertPreviewIsolation(), "BLOB_API_OVERRIDE_NOT_ALLOWED"
  ));
  test(`${variable} also blocks signed URL validation`, () => blocked(
    () => blockedGuard.assertPreviewBlobSignedUrl(getUrl, getContext), "BLOB_API_OVERRIDE_NOT_ALLOWED"
  ));
}
test("pending resource pins remain blocked", () => blocked(
  () => loadGuard({}, { ready: false }).assertPreviewIsolation(), "RESOURCE_PINS_NOT_READY"
));
test("another Blob credential remains blocked", () => blocked(
  () => loadGuard({ BLOB_READ_WRITE_TOKEN: "synthetic-unpinned-token" }).assertPreviewIsolation(), "BLOB_TOKEN_NOT_PINNED"
));
test("missing Preview opt-in does not select production behavior", () => blocked(
  () => loadGuard({ MC_PREVIEW_ISOLATION: undefined }).assertPreviewIsolation(), "DEPLOYMENT_IDENTITY_MISMATCH"
));
test("another Preview branch remains blocked", () => blocked(
  () => loadGuard({ VERCEL_GIT_COMMIT_REF: "codex/other-fixture" }).assertPreviewIsolation(), "DEPLOYMENT_IDENTITY_MISMATCH"
));
test("production without opt-in remains a no-op", () => {
  const production = loadGuard({ VERCEL_ENV: "production", MC_PREVIEW_ISOLATION: undefined });
  assert.equal(production.assertPreviewIsolation(), null);
  assert.doesNotThrow(() => production.assertPreviewBlobUrl("not-a-preview-url", undefined));
  assert.doesNotThrow(() => production.assertPreviewBlobSignedUrl("not-a-preview-url", null));
});
test("production no-op does not require ready Preview pins", () => {
  const production = loadGuard({ VERCEL_ENV: "production", MC_PREVIEW_ISOLATION: undefined }, { ready: false });
  assert.equal(production.assertPreviewIsolation(), null);
});
test("Preview opt-in cannot silently run as production", () => blocked(
  () => loadGuard({ VERCEL_ENV: "production" }).assertPreviewIsolation(), "DEPLOYMENT_IDENTITY_MISMATCH"
));

console.log(`Offline Blob guard tests: ${passed} PASS, ${failed} FAIL.`);
if (failed) process.exitCode = 1;
