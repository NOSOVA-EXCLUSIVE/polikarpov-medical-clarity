import { createHmac, timingSafeEqual } from "node:crypto";

import type { CompleteUploadInput } from "@/features/questionnaire/schemas";

export type MaterialsUploadScope = {
  applicationId: string;
  requirementId: string;
  tokenId: string;
};

const PREPARED_UPLOAD_ERROR = "Подготовленная загрузка не найдена или недоступна.";
const UUID_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([a-z0-9]{1,16})$/;

export function getMaterialsUploadTicketId(
  scope: MaterialsUploadScope,
  input: Pick<CompleteUploadInput, "category" | "storageKey" | "extension">
) {
  const segments = [scope.applicationId, scope.requirementId, scope.tokenId];
  if (segments.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) {
    throw new Error(PREPARED_UPLOAD_ERROR);
  }

  const prefix = `portal/materials/${segments.join("/")}/${input.category.toLowerCase()}/`;
  const filename = input.storageKey.startsWith(prefix)
    ? input.storageKey.slice(prefix.length)
    : "";
  const match = UUID_FILE.exec(filename);

  if (!match || match[2] !== input.extension.toLowerCase()) {
    throw new Error(PREPARED_UPLOAD_ERROR);
  }

  return match[1];
}

export function createMaterialsUploadDescriptorHmac(
  rawToken: string,
  scope: MaterialsUploadScope,
  input: CompleteUploadInput
) {
  // Keep names and access details out of the audit ticket. The opaque token is the HMAC key.
  const descriptor = JSON.stringify([
    "materials-upload-v1",
    scope.applicationId,
    scope.requirementId,
    scope.tokenId,
    input.storageKey,
    input.category,
    input.originalName,
    input.mimeType,
    input.extension.toLowerCase(),
    input.sizeBytes,
    input.durationSeconds ?? null
  ]);

  return createHmac("sha256", rawToken).update(descriptor, "utf8").digest("hex");
}

export function assertMaterialsUploadTicket(input: {
  rawToken: string;
  scope: MaterialsUploadScope;
  upload: CompleteUploadInput;
  metadata: unknown;
  now: Date;
}) {
  const metadata = input.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(PREPARED_UPLOAD_ERROR);
  }

  const ticket = metadata as Record<string, unknown>;
  const expiresAt = typeof ticket.expiresAt === "string" ? Date.parse(ticket.expiresAt) : NaN;
  if (
    ticket.version !== 1 ||
    ticket.tokenId !== input.scope.tokenId ||
    ticket.requirementId !== input.scope.requirementId ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= input.now.getTime() ||
    typeof ticket.descriptorHmac !== "string" ||
    !/^[0-9a-f]{64}$/.test(ticket.descriptorHmac)
  ) {
    throw new Error(PREPARED_UPLOAD_ERROR);
  }

  const expected = createMaterialsUploadDescriptorHmac(input.rawToken, input.scope, input.upload);
  if (!timingSafeEqual(Buffer.from(ticket.descriptorHmac, "hex"), Buffer.from(expected, "hex"))) {
    throw new Error(PREPARED_UPLOAD_ERROR);
  }
}
