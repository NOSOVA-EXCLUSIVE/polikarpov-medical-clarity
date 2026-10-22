"use strict";

const { createHash, createHmac, timingSafeEqual } = require("node:crypto");
const resourcePins = require("./pins.cjs");
const DISABLED = "disabled-for-preview";
const APP_URL_SENTINEL = "https://mc-preview.invalid";

function fail(code) {
  // Do not include configuration values, URLs with credentials, or message bodies.
  throw new Error(`Preview isolation blocked: ${code}`);
}

function isPreviewIsolationRequired(raw = process.env) {
  return Boolean(
    raw.VERCEL_ENV === "preview" ||
    (raw.VERCEL === "1" && raw.VERCEL_ENV !== "production") ||
    raw.MC_PREVIEW_ISOLATION
  );
}

function assertReadyPins(pins) {
  if (
    pins.ready !== true ||
    !Array.isArray(pins.databaseHostnames) ||
    pins.databaseHostnames.length === 0 ||
    pins.databaseHostnames.some((host) => !/^[a-z0-9.-]+\.neon\.tech$/.test(host)) ||
    !/^[a-f0-9]{64}$/.test(pins.blobTokenSha256 || "") ||
    !/^[a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(pins.blobHostname || "")
  ) {
    fail("RESOURCE_PINS_NOT_READY");
  }
}

function assertDatabaseUrlValue(value, pins) {
  let parsed;
  try {
    parsed = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !pins.databaseHostnames.includes(parsed.hostname) ||
      (parsed.port && parsed.port !== "5432") ||
      decodeURIComponent(parsed.username) !== pins.databaseRole ||
      !parsed.password ||
      decodeURIComponent(parsed.pathname) !== `/${pins.databaseName}` ||
      parsed.hash ||
      parsed.searchParams.get("sslmode") !== "require"
    ) {
      fail("DATABASE_IDENTITY_MISMATCH");
    }
    const allowedOptions = new Set([
      "sslmode", "channel_binding", "pgbouncer", "connection_limit",
      "pool_timeout", "connect_timeout"
    ]);
    for (const key of parsed.searchParams.keys()) {
      if (!allowedOptions.has(key) || parsed.searchParams.getAll(key).length !== 1) {
        fail("DATABASE_URL_OPTION_NOT_ALLOWED");
      }
    }
  } catch {
    fail("DATABASE_URL_INVALID_OR_UNPINNED");
  }
}

function assertTokenValue(token, pins) {
  if (typeof token !== "string" || !token || token !== token.trim()) {
    fail("BLOB_TOKEN_MISSING_OR_INVALID");
  }
  const actual = createHash("sha256").update(token, "utf8").digest();
  const expected = Buffer.from(pins.blobTokenSha256, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    fail("BLOB_TOKEN_NOT_PINNED");
  }
}

function isSyntheticEmail(value) {
  return typeof value === "string" &&
    /^[a-z0-9.!#$&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.invalid$/i.test(value);
}

function trustedPreviewAppUrl(raw) {
  const hostname = raw.VERCEL_URL;
  if (
    typeof hostname !== "string" ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/i.test(hostname)
  ) {
    fail("TRUSTED_DEPLOYMENT_URL_MISSING");
  }
  return `https://${hostname.toLowerCase()}`;
}

function assertPreviewIsolation(raw = process.env, pins = resourcePins) {
  if (!isPreviewIsolationRequired(raw)) {
    return null;
  }
  if (
    raw.VERCEL !== "1" || raw.VERCEL_ENV !== "preview" || raw.NODE_ENV !== "production" ||
    raw.MC_PREVIEW_ISOLATION !== "1" ||
    raw.VERCEL_PROJECT_ID !== pins.vercelProjectId ||
    raw.VERCEL_GIT_COMMIT_REF !== pins.branch
  ) {
    fail("DEPLOYMENT_IDENTITY_MISMATCH");
  }
  assertReadyPins(pins);
  // SDK 2.4.0 reads these before issuing a signed token (and in head/put/del).
  // Reject overrides before any SDK request, not only after building its URL.
  for (const key of ["VERCEL_BLOB_API_URL", "NEXT_PUBLIC_VERCEL_BLOB_API_URL"]) {
    if (raw[key]) fail("BLOB_API_OVERRIDE_NOT_ALLOWED");
  }
  assertDatabaseUrlValue(raw.DATABASE_URL, pins);
  assertDatabaseUrlValue(raw.DIRECT_URL, pins);
  assertTokenValue(raw.BLOB_READ_WRITE_TOKEN, pins);
  if (raw.BLOB_STORE_ID !== pins.blobStoreId) {
    fail("BLOB_STORE_ID_MISMATCH");
  }
  for (const key of [
    "S3_REGION", "S3_BUCKET", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY",
    "BLOB_WEBHOOK_PUBLIC_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
    "POSTMARK_SERVER_TOKEN", "INNGEST_APP_ID", "INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"
  ]) {
    if (raw[key] !== DISABLED) {
      fail(`INTEGRATION_NOT_DISABLED_${key}`);
    }
  }
  if (
    raw.MC_PREVIEW_MAIL_MODE !== "capture" ||
    raw.MC_PREVIEW_PAYMENTS_MODE !== "disabled" ||
    raw.MC_PREVIEW_JOBS_MODE !== "disabled" ||
    raw.BOOKING_MODE !== "manual"
  ) {
    fail("PREVIEW_MODES_NOT_SAFE");
  }
  for (const key of ["POSTMARK_FROM_EMAIL", "POSTMARK_REPLY_TO_EMAIL", "STAFF_NOTIFICATION_EMAIL"]) {
    if (!isSyntheticEmail(raw[key])) {
      fail(`SYNTHETIC_EMAIL_REQUIRED_${key}`);
    }
  }
  if (raw.ADMIN_SEED_EMAIL && !isSyntheticEmail(raw.ADMIN_SEED_EMAIL)) {
    fail("SYNTHETIC_ADMIN_EMAIL_REQUIRED");
  }
  const encryptionKey = raw.ENCRYPTION_KEY_BASE64 || "";
  if (
    Buffer.from(encryptionKey, "base64").length !== 32 ||
    Buffer.from(encryptionKey, "base64").toString("base64") !== encryptionKey ||
    typeof raw.TOKEN_HASH_SECRET !== "string" || raw.TOKEN_HASH_SECRET.length < 32 ||
    typeof raw.STAFF_SESSION_SECRET !== "string" || raw.STAFF_SESSION_SECRET.length < 32
  ) {
    fail("SYNTHETIC_SECURITY_SECRETS_REQUIRED");
  }
  if (raw.APP_URL !== APP_URL_SENTINEL) {
    fail("APP_URL_SENTINEL_REQUIRED");
  }
  if (raw.NEXT_PUBLIC_APP_URL && raw.NEXT_PUBLIC_APP_URL !== APP_URL_SENTINEL) {
    fail("PUBLIC_APP_URL_NOT_SAFE");
  }
  const appUrl = trustedPreviewAppUrl(raw);
  return Object.freeze({ appUrl, pins });
}

function assertPreviewDatabaseUrl(value) {
  const context = assertPreviewIsolation();
  if (context) assertDatabaseUrlValue(value, context.pins);
}

function assertPreviewBlobToken(value) {
  const context = assertPreviewIsolation();
  if (context) assertTokenValue(value, context.pins);
}

function assertStorageKeyValue(key) {
  if (
    typeof key !== "string" || !key || key.length > 1024 ||
    key.startsWith("/") || /[\\%?#:\u0000-\u0020\u007f]/.test(key) ||
    key.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    fail("STORAGE_KEY_NOT_ALLOWED");
  }
}

function assertPreviewStorageKey(key) {
  if (assertPreviewIsolation()) assertStorageKeyValue(key);
}

function parseBlobUrl(value) {
  if (typeof value !== "string" || /[\\\u0000-\u0020\u007f]/.test(value)) {
    fail("BLOB_URL_INVALID_OR_UNPINNED");
  }
  const raw = /^https:\/\/([^/?#]+)(\/[^?#]*)?(?:\?[^#]*)?$/.exec(value);
  const parsed = new URL(value);
  if (!raw || raw[2] !== parsed.pathname || parsed.username || parsed.password || parsed.port || parsed.hash) {
    fail("BLOB_URL_INVALID_OR_UNPINNED");
  }
  return { rawHost: raw[1], parsed };
}

function assertPrivateBlobPath(url, key, pins) {
  assertStorageKeyValue(key);
  if (
    url.rawHost !== pins.blobHostname || url.parsed.hostname !== pins.blobHostname ||
    url.parsed.pathname !== `/${key}`
  ) fail("BLOB_OBJECT_NOT_PINNED");
}

// A stored object's plain URL (including the mail-capture artifact), not a PUT URL.
function assertPreviewBlobUrl(value, expectedKey) {
  const context = assertPreviewIsolation();
  if (!context) return;
  try {
    const url = parseBlobUrl(value);
    assertPrivateBlobPath(url, expectedKey, context.pins);
    if (url.parsed.search) fail("BLOB_OBJECT_QUERY_NOT_ALLOWED");
  } catch {
    fail("BLOB_URL_INVALID_OR_UNPINNED");
  }
}

// Context comes from the server's pinned-token SDK call, never from a client URL.
function assertPreviewBlobSignedUrl(value, expected) {
  const context = assertPreviewIsolation();
  if (!context) return;
  try {
    const { key, operation, signedToken, validUntil, contentType, maximumSizeInBytes } = expected;
    assertStorageKeyValue(key);
    if (
      !["get", "put"].includes(operation) ||
      typeof signedToken?.delegationToken !== "string" ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(signedToken.delegationToken) ||
      typeof signedToken.clientSigningToken !== "string" || !signedToken.clientSigningToken
    ) fail("BLOB_SIGNED_CONTEXT_INVALID");
    const scope = JSON.parse(Buffer.from(signedToken.delegationToken.split(".")[0], "base64url").toString("utf8"));
    if (
      ![context.pins.blobStoreId, context.pins.blobStoreId.replace(/^store_/, "")].includes(scope.storeId) ||
      scope.pathname !== key || !Array.isArray(scope.operations) ||
      scope.operations.length !== 1 || scope.operations[0] !== operation ||
      !Number.isSafeInteger(scope.validUntil) || !Number.isSafeInteger(validUntil) ||
      scope.validUntil <= Date.now() || scope.validUntil > validUntil
    ) fail("BLOB_DELEGATION_NOT_PINNED");

    const url = parseBlobUrl(value);
    const wanted = new Map([["vercel-blob-delegation", signedToken.delegationToken]]);
    if (operation === "get") {
      assertPrivateBlobPath(url, key, context.pins);
    } else {
      // SDK 2.4.0 PUT uses the API endpoint, not the private GET hostname.
      if (url.rawHost !== "vercel.com" || url.parsed.pathname !== "/api/blob/") {
        fail("BLOB_PUT_ENDPOINT_NOT_PINNED");
      }
      wanted.set("pathname", key);
      wanted.set("vercel-blob-add-random-suffix", "false");
      if (contentType !== undefined) {
        if (!Array.isArray(scope.allowedContentTypes) || scope.allowedContentTypes.length !== 1 ||
            scope.allowedContentTypes[0] !== contentType) fail("BLOB_CONTENT_TYPE_NOT_PINNED");
        wanted.set("vercel-blob-allowed-content-types", contentType);
      }
      if (maximumSizeInBytes !== undefined) {
        if (!Number.isSafeInteger(maximumSizeInBytes) || maximumSizeInBytes <= 0 ||
            scope.maximumSizeInBytes !== maximumSizeInBytes) fail("BLOB_SIZE_NOT_PINNED");
        wanted.set("vercel-blob-maximum-size-in-bytes", String(maximumSizeInBytes));
      }
    }

    // The SDK signs these exact query entries plus operation and pathname.
    // Checking HMAC also detects mutation; decoding delegation alone is not authentication.
    const canonical = [`operation=${operation}`, `pathname=${key}`];
    for (const [name, entry] of wanted) {
      if (name.startsWith("vercel-blob-") && name !== "vercel-blob-delegation") canonical.push(`${name}=${entry}`);
    }
    const signature = createHmac("sha256", signedToken.clientSigningToken)
      .update(canonical.sort().join("\n")).digest("base64url");
    wanted.set("vercel-blob-signature", signature);
    const actual = url.parsed.searchParams;
    if ([...actual.keys()].length !== wanted.size) fail("BLOB_QUERY_NOT_PINNED");
    for (const [name, entry] of actual) {
      if (actual.getAll(name).length !== 1 || !wanted.has(name) || wanted.get(name) !== entry) {
        fail("BLOB_QUERY_NOT_PINNED");
      }
    }
  } catch {
    fail("BLOB_URL_INVALID_OR_UNPINNED");
  }
}

function assertPreviewAllowedOperation(operation) {
  if (
    assertPreviewIsolation() &&
    !["build", "database", "storage:blob", "mail:capture"].includes(operation)
  ) {
    fail("OPERATION_NOT_ALLOWED");
  }
}

function getPreviewAppUrl() {
  return assertPreviewIsolation()?.appUrl || null;
}

module.exports = {
  isPreviewIsolationRequired, assertPreviewIsolation, assertPreviewDatabaseUrl,
  assertPreviewBlobToken, assertPreviewStorageKey, assertPreviewBlobUrl, assertPreviewBlobSignedUrl,
  assertPreviewAllowedOperation, getPreviewAppUrl, isSyntheticEmail
};
