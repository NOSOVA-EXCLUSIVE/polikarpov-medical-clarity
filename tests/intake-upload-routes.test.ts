import assert from "node:assert/strict";
import net from "node:net";
import { test } from "node:test";

// This process has only non-working synthetic settings. Every socket connection
// is forbidden, so the negative checks cannot contact any live service.
Object.assign(process.env, {
  NODE_ENV: "test", APP_URL: "https://preview.example.invalid",
  DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:1/synthetic",
  DIRECT_URL: "postgresql://synthetic:synthetic@127.0.0.1:1/synthetic",
  ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 1).toString("base64"),
  TOKEN_HASH_SECRET: "synthetic-intake-secret", STAFF_SESSION_SECRET: "synthetic-session-secret",
  STRIPE_SECRET_KEY: "synthetic-disabled", STRIPE_WEBHOOK_SECRET: "synthetic-disabled",
  POSTMARK_SERVER_TOKEN: "synthetic-disabled", POSTMARK_FROM_EMAIL: "staff@example.invalid",
  POSTMARK_REPLY_TO_EMAIL: "staff@example.invalid", INNGEST_APP_ID: "synthetic-disabled",
  INNGEST_EVENT_KEY: "synthetic-disabled", INNGEST_SIGNING_KEY: "synthetic-disabled",
  S3_REGION: "", S3_BUCKET: "", S3_ENDPOINT: "", S3_ACCESS_KEY_ID: "", S3_SECRET_ACCESS_KEY: "",
  BLOB_READ_WRITE_TOKEN: "", BLOB_STORE_ID: "", VERCEL_ENV: "", VERCEL: ""
});
let connectionAttempts = 0;
net.Socket.prototype.connect = function () {
  connectionAttempts += 1;
  throw new Error("Network disabled in negative consent tests");
} as typeof net.Socket.prototype.connect;

const invalidBody = "synthetic-private-body-that-must-not-be-read";

for (const route of ["presign", "complete", "direct"] as const) {
  test(`upload ${route}: missing consent produces specific 403 before body or storage access`, async () => {
    const module = route === "presign" ? await import("../src/app/api/uploads/presign/route") :
      route === "complete" ? await import("../src/app/api/uploads/complete/route") :
      await import("../src/app/api/uploads/direct/route");
    const request = new Request(`https://preview.example.invalid/api/uploads/${route}`, {
      method: route === "direct" ? "PUT" : "POST", body: invalidBody,
      headers: { "Content-Type": "application/json" }
    });
    const handler = route === "direct" ? (module as { PUT: (request: Request) => Promise<Response> }).PUT :
      (module as { POST: (request: Request) => Promise<Response> }).POST;
    const response = await handler(request);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "INTAKE_CONSENT_REQUIRED");
    assert.equal(request.bodyUsed, false);
    assert.equal(connectionAttempts, 0);
  });
}

test("the consent endpoint rejects unchecked consent and cross-origin requests without a receipt or DB call", async () => {
  const { POST } = await import("../src/app/api/questionnaire/consent/route");
  for (const [origin, accepted] of [["https://preview.example.invalid", false], ["https://other.example.invalid", true]] as const) {
    const response = await POST(new Request("https://preview.example.invalid/api/questionnaire/consent", {
      method: "POST", headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify({ accepted, textVersion: "2026-10-27-v1" })
    }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.has("set-cookie"), false);
    assert.equal(connectionAttempts, 0);
  }
});
