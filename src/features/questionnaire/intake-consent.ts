import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { LEGAL_DOCUMENT_VERSIONS } from "@/features/legal/versions";
import {
  INTAKE_DATA_CONSENT_LABEL,
  INTAKE_DATA_CONSENT_VERSION
} from "./intake-consent-content";

export const INTAKE_CONSENT_COOKIE_NAME = "pmc-intake-consent";
export const INTAKE_CONSENT_TTL_SECONDS = 24 * 60 * 60;
const ACCEPTED_ACTION = "intake_data_consent_accepted";

export type IntakeConsentReceipt = {
  receiptId: string;
  acceptedAt: string;
  textVersion: string;
};

type SignedReceiptPayload = IntakeConsentReceipt & {
  expiresAt: number;
  privacyVersion: string;
  consentVersion: string;
};

export class IntakeConsentRequiredError extends Error {
  readonly code = "INTAKE_CONSENT_REQUIRED";
  readonly status = 403;

  constructor() {
    super("Сначала подтвердите согласие на обработку персональных и медицинских данных на первом шаге анкеты.");
    this.name = "IntakeConsentRequiredError";
  }
}

function getSigningSecret() {
  const secret = process.env.TOKEN_HASH_SECRET?.trim();
  if (!secret) throw new Error("INTAKE_CONSENT_SIGNING_NOT_CONFIGURED");
  return secret;
}

/** Kept separate from persistence so malformed receipts fail before any DB access. */
export function signIntakeConsentPayload(payload: SignedReceiptPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`pmc-intake-consent-v1:${encoded}`)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyIntakeConsentPayload(
  cookie: string | undefined,
  secret: string,
  now = Date.now()
): SignedReceiptPayload {
  if (!cookie || cookie.length > 4096) throw new IntakeConsentRequiredError();
  const parts = cookie.split(".");
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
    throw new IntakeConsentRequiredError();
  }
  const [encoded, signature] = parts;
  const expected = createHmac("sha256", secret)
    .update(`pmc-intake-consent-v1:${encoded}`)
    .digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new IntakeConsentRequiredError();
  }

  let payload: SignedReceiptPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new IntakeConsentRequiredError();
  }
  if (
    !payload ||
    typeof payload.receiptId !== "string" ||
    !/^[a-f0-9-]{36}$/.test(payload.receiptId) ||
    typeof payload.acceptedAt !== "string" ||
    !Number.isFinite(Date.parse(payload.acceptedAt)) ||
    Date.parse(payload.acceptedAt) > now ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt <= now ||
    payload.expiresAt - Date.parse(payload.acceptedAt) !== INTAKE_CONSENT_TTL_SECONDS * 1000 ||
    payload.textVersion !== INTAKE_DATA_CONSENT_VERSION ||
    payload.privacyVersion !== LEGAL_DOCUMENT_VERSIONS.privacy ||
    payload.consentVersion !== LEGAL_DOCUMENT_VERSIONS.consent
  ) {
    throw new IntakeConsentRequiredError();
  }
  return payload;
}

function getReceiptCookie(request: Request) {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${INTAKE_CONSENT_COOKIE_NAME}=`));
  if (values.length !== 1) return undefined;
  return values[0].slice(INTAKE_CONSENT_COOKIE_NAME.length + 1);
}

/** Persists the server timestamp and exact text version before signing a receipt. */
export async function recordIntakeConsent() {
  const secret = getSigningSecret();
  const { prisma } = await import("@/lib/db/prisma");
  const receiptId = randomUUID();
  const event = await prisma.auditEvent.create({
    data: {
      id: receiptId,
      actorType: "PATIENT",
      entityType: "TOKEN",
      entityId: receiptId,
      action: ACCEPTED_ACTION,
      metadataJson: {
        accepted: true,
        text: INTAKE_DATA_CONSENT_LABEL,
        textVersion: INTAKE_DATA_CONSENT_VERSION,
        privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
        consentVersion: LEGAL_DOCUMENT_VERSIONS.consent
      }
    },
    select: { createdAt: true }
  });
  const acceptedAt = event.createdAt.toISOString();
  const receipt: IntakeConsentReceipt = {
    receiptId,
    acceptedAt,
    textVersion: INTAKE_DATA_CONSENT_VERSION
  };
  const cookie = signIntakeConsentPayload({
    ...receipt,
    expiresAt: event.createdAt.getTime() + INTAKE_CONSENT_TTL_SECONDS * 1000,
    privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
    consentVersion: LEGAL_DOCUMENT_VERSIONS.consent
  }, secret);
  return { receipt, cookie };
}

/** Must run before reading medical data or contacting a storage provider. */
export async function requireIntakeConsent(request: Request): Promise<IntakeConsentReceipt> {
  const cookie = getReceiptCookie(request);
  if (!cookie) throw new IntakeConsentRequiredError();
  const payload = verifyIntakeConsentPayload(cookie, getSigningSecret());
  const { prisma } = await import("@/lib/db/prisma");
  const event = await prisma.auditEvent.findUnique({
    where: { id: payload.receiptId },
    select: {
      actorType: true,
      entityType: true,
      entityId: true,
      action: true,
      applicationId: true,
      metadataJson: true,
      createdAt: true
    }
  }).catch(() => {
    throw new Error("Не удалось проверить сохранённое согласие. Повторите попытку.");
  });
  const metadata = event?.metadataJson as Record<string, unknown> | null;
  if (
    !event ||
    event.actorType !== "PATIENT" ||
    event.entityType !== "TOKEN" ||
    event.entityId !== payload.receiptId ||
    event.action !== ACCEPTED_ACTION ||
    event.applicationId !== null ||
    event.createdAt.toISOString() !== payload.acceptedAt ||
    metadata?.accepted !== true ||
    metadata.textVersion !== payload.textVersion ||
    metadata.privacyVersion !== payload.privacyVersion ||
    metadata.consentVersion !== payload.consentVersion
  ) {
    throw new IntakeConsentRequiredError();
  }
  return {
    receiptId: payload.receiptId,
    acceptedAt: payload.acceptedAt,
    textVersion: payload.textVersion
  };
}

/** Only newly created uploads are scoped; downloads of existing cases stay unchanged. */
export function assertIntakeUploadOwnership(storageKey: string, receiptId: string) {
  const prefix = `intake/incoming/${receiptId}/`;
  if (
    !storageKey.startsWith(prefix) ||
    storageKey.split("/").some((part) => !part || part === "." || part === "..") ||
    /[\\%?#]/.test(storageKey)
  ) throw new IntakeConsentRequiredError();
}

export function intakeConsentErrorResponse(error: unknown) {
  if (!(error instanceof IntakeConsentRequiredError)) return null;
  return Response.json({
    ok: false,
    success: false,
    error: { code: error.code, message: error.message }
  }, { status: error.status });
}
