import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPreviewIsolation } from "@/lib/preview/guard";
import { createPrivateDownloadUrl, createPrivateUploadUrl, deletePrivateObject,
  getPrivateBlobMetadata, privateObjectExists } from "@/lib/storage/s3";
import { MANUAL_DELIVERY_TYPES, MANUAL_DIRECT_DELIVERY_MAX_BYTES, parseManualRange, validateManualFile,
  validateManualFileMetadata, validateManualFilePrefix } from "./delivery-policy";

// The multipart fallback stays below Vercel's request-body limit; direct PUT handles larger files.
export { MANUAL_DELIVERY_MAX_BYTES } from "./delivery-policy";

function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

function generatedStorageUrl(value: string, key: string, operation: "get" | "put") {
  // Only URLs freshly returned by the guarded storage adapter enter here. No client URL is accepted.
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port) {
    fail("Недопустимый адрес приватного хранилища.");
  }
  const preview = assertPreviewIsolation();
  if (operation === "get" && (url.pathname !== `/${key}` || (preview && url.hostname !== preview.pins.blobHostname))) {
    fail("Адрес хранилища не соответствует ожидаемому файлу.");
  }
  if (operation === "put" && (url.hostname !== "vercel.com" || url.pathname !== "/api/blob/" ||
      url.searchParams.get("pathname") !== key)) fail("Недопустимый адрес загрузки Blob.");
  return url;
}

export async function publishManualDeliverable(input: {
  caseId: string; actorId: string; title: string; mimeType: string; bytes: Uint8Array;
}) {
  validateManualFile(input.bytes, input.mimeType);
  const title = input.title.trim();
  if (!title || title.length > 180) fail("Укажите название до 180 символов.");
  const manualCase = await prisma.manualCase.findUnique({ where: { id: input.caseId }, select: { id: true, phase: true } });
  if (!manualCase || manualCase.phase !== "ACTIVE") {
    fail("Материалы выдаются только по начатой работе.", 409);
  }
  const ext = input.mimeType === "application/pdf" ? "pdf" : input.mimeType === "image/png" ? "png" :
    input.mimeType === "image/jpeg" ? "jpg" : "mp4";
  const storageKey = `manual-deliverables/${manualCase.id}/${randomUUID()}.${ext}`;
  const signedUrl = await createPrivateUploadUrl({ key: storageKey, contentType: input.mimeType,
    maximumSizeInBytes: input.bytes.length, expiresInSeconds: 60 });
  const target = generatedStorageUrl(signedUrl, storageKey, "put");
  // The SDK's guard has already verified the PUT endpoint, store delegation, pathname and signature.
  const response = await fetch(target, { method: "PUT", body: Buffer.from(input.bytes),
    headers: { "Content-Type": input.mimeType }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) fail("Приватное хранилище не приняло файл.", 409);
  try {
    if (!await privateObjectExists(storageKey)) fail("Файл ещё не подтверждён в хранилище.", 409);
    const metadata = await getPrivateBlobMetadata(storageKey);
    if (metadata.sizeBytes !== input.bytes.length || metadata.contentType !== input.mimeType) {
      fail("Размер или тип загруженного файла не совпадает.", 409);
    }
    return await prisma.$transaction(async (tx) => {
      const [current, actor] = await Promise.all([
        tx.manualCase.findUnique({ where: { id: manualCase.id } }),
        tx.user.findFirst({ where: { id: input.actorId, isActive: true }, select: { role: true } })
      ]);
      if (!actor || !["ADMIN", "DOCTOR"].includes(actor.role)) fail("Доступ сотрудника отозван.", 403);
      if (!current || current.phase !== "ACTIVE") fail("Работа уже завершена или состояние изменилось.", 409);
      const claimed = await tx.manualCase.updateMany({ where: { id: current.id, version: current.version },
        data: { version: { increment: 1 } } });
      if (claimed.count !== 1) fail("Состояние обращения изменилось. Повторите после обновления.", 409);
      const deliverable = await tx.manualDeliverable.create({ data: {
        caseId: manualCase.id, storageKey, title, mimeType: input.mimeType,
        sizeBytes: BigInt(input.bytes.length), uploadedByUserId: input.actorId, markedInFile: false,
        status: "READY", verifiedEtag: metadata.etag
      } });
      await tx.auditEvent.create({ data: { actorType: "USER", actorUserId: input.actorId,
        applicationId: current.applicationId, entityType: "APPLICATION", entityId: current.applicationId,
        action: "manual_v21_material_published", metadataJson: { caseId: current.id, deliverableId: deliverable.id,
          mimeType: input.mimeType, sizeBytes: input.bytes.length, markedInFile: false } } });
      return deliverable;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    // Only this newly created unpredictable key can be removed here; existing materials are untouched.
    try { await deletePrivateObject(storageKey); } catch { /* Preserve failure without exposing signed URLs. */ }
    throw error;
  }
}

export async function prepareManualDeliverableUpload(input: {
  caseId: string; actorId: string; title: string; mimeType: string; sizeBytes: number;
}) {
  validateManualFileMetadata(input.sizeBytes, input.mimeType);
  const title = input.title.trim();
  if (!title || title.length > 180) fail("Укажите название до 180 символов.");
  const ext = input.mimeType === "application/pdf" ? "pdf" : input.mimeType === "image/png" ? "png" :
    input.mimeType === "image/jpeg" ? "jpg" : "mp4";
  const file = await prisma.$transaction(async (tx) => {
    const [current, actor] = await Promise.all([
      tx.manualCase.findUnique({ where: { id: input.caseId } }),
      tx.user.findFirst({ where: { id: input.actorId, isActive: true }, select: { role: true } })
    ]);
    if (!actor || !["ADMIN", "DOCTOR"].includes(actor.role)) fail("Доступ сотрудника отозван.", 403);
    if (!current || current.phase !== "ACTIVE") fail("Работа ещё не начата или уже завершена.", 409);
    const claimed = await tx.manualCase.updateMany({ where: { id: current.id, version: current.version }, data: { version: { increment: 1 } } });
    if (claimed.count !== 1) fail("Состояние обращения изменилось.", 409);
    const pending = await tx.manualDeliverable.create({ data: { caseId: current.id, title,
      mimeType: input.mimeType, sizeBytes: BigInt(input.sizeBytes), uploadedByUserId: input.actorId,
      storageKey: `manual-deliverables/${current.id}/${randomUUID()}.${ext}`, status: "PENDING", markedInFile: false } });
    await tx.auditEvent.create({ data: { actorType: "USER", actorUserId: input.actorId,
      applicationId: current.applicationId, entityType: "APPLICATION", entityId: current.applicationId,
      action: "manual_v21_material_upload_prepared", metadataJson: { caseId: current.id,
        deliverableId: pending.id, sizeBytes: input.sizeBytes, mimeType: input.mimeType } } });
    return pending;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  // A failed signing call leaves an unpublished PENDING record. Existing objects are never touched.
  const uploadUrl = await createPrivateUploadUrl({ key: file.storageKey, contentType: file.mimeType,
    maximumSizeInBytes: input.sizeBytes, expiresInSeconds: 15 * 60 });
  generatedStorageUrl(uploadUrl, file.storageKey, "put");
  return { id: file.id, uploadUrl };
}

export async function completeManualDeliverableUpload(input: { caseId: string; id: string; actorId: string }) {
  const file = await prisma.manualDeliverable.findFirst({ where: { id: input.id, caseId: input.caseId } });
  if (!file || !["PENDING", "READY"].includes(file.status) || !file.storageKey.startsWith(`manual-deliverables/${input.caseId}/`)) {
    fail("Подготовленная загрузка не найдена.", 404);
  }
  const size = Number(file.sizeBytes);
  validateManualFileMetadata(size, file.mimeType);
  const head = await getPrivateBlobMetadata(file.storageKey);
  if (head.sizeBytes !== size || head.contentType !== file.mimeType) fail("Размер или тип файла не совпадает с подготовленной загрузкой.", 409);
  if (file.status === "READY" && file.verifiedEtag !== head.etag) fail("Опубликованный файл изменился в хранилище.", 409);
  const end = Math.min(31, size - 1);
  const url = await createPrivateDownloadUrl({ key: file.storageKey, expiresInSeconds: 60 });
  const response = await fetch(generatedStorageUrl(url, file.storageKey, "get"), { method: "GET",
    headers: { Range: `bytes=0-${end}`, "If-Match": head.etag }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (response.status !== 206 || response.headers.get("Content-Range") !== `bytes 0-${end}/${size}`) {
    await response.body?.cancel(); fail("Хранилище не подтвердило проверяемый фрагмент файла.", 409);
  }
  const prefix = await readBounded(response, end + 1);
  if (prefix.length !== end + 1) fail("Фрагмент файла получен не полностью.", 409);
  validateManualFilePrefix(prefix, file.mimeType);
  return prisma.$transaction(async (tx) => {
    const [current, actor, pending] = await Promise.all([
      tx.manualCase.findUnique({ where: { id: file.caseId } }),
      tx.user.findFirst({ where: { id: input.actorId, isActive: true }, select: { role: true } }),
      tx.manualDeliverable.findFirst({ where: { id: file.id, caseId: file.caseId } })
    ]);
    if (!actor || !["ADMIN", "DOCTOR"].includes(actor.role)) fail("Доступ сотрудника отозван.", 403);
    if (!current || current.phase !== "ACTIVE") fail("Состояние обращения изменилось.", 409);
    if (!pending || pending.storageKey !== file.storageKey || pending.mimeType !== file.mimeType || pending.sizeBytes !== file.sizeBytes) {
      fail("Подготовленная загрузка изменилась.", 409);
    }
    if (pending.status === "READY") {
      if (pending.verifiedEtag !== head.etag) fail("Опубликованный файл изменился в хранилище.", 409);
      return { id: pending.id, title: pending.title };
    }
    if (pending.status !== "PENDING") fail("Загрузка не ожидает подтверждения.", 409);
    const claimed = await tx.manualCase.updateMany({ where: { id: current.id, version: current.version }, data: { version: { increment: 1 } } });
    if (claimed.count !== 1) fail("Состояние обращения изменилось.", 409);
    await tx.manualDeliverable.update({ where: { id: file.id }, data: { status: "READY", verifiedEtag: head.etag } });
    await tx.auditEvent.create({ data: { actorType: "USER", actorUserId: input.actorId,
      applicationId: current.applicationId, entityType: "APPLICATION", entityId: current.applicationId,
      action: "manual_v21_material_published", metadataJson: { caseId: current.id, deliverableId: file.id,
        mimeType: file.mimeType, sizeBytes: size, markedInFile: false } } });
    return { id: file.id, title: file.title };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function readBounded(response: Response, max: number) {
  if (!response.body) fail("Пустой ответ хранилища.", 409);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > max) { await reader.cancel(); fail("Размер ответа хранилища превышен.", 409); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, length);
}

export async function getManualDeliverableResponse(input: { caseId: string; id: string; range: string | null }) {
  const file = await prisma.manualDeliverable.findFirst({ where: { id: input.id, caseId: input.caseId, status: "READY" } });
  if (!file || !MANUAL_DELIVERY_TYPES.has(file.mimeType)) fail("Материал не найден.", 404);
  if (!file.verifiedEtag) fail("Материал ещё не прошёл проверку целостности.", 409);
  if (!file.storageKey.startsWith(`manual-deliverables/${input.caseId}/`)) fail("Материал не найден.", 404);
  const size = Number(file.sizeBytes);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MANUAL_DIRECT_DELIVERY_MAX_BYTES) fail("Недопустимый размер файла.", 409);
  const range = parseManualRange(input.range, size);
  const signedUrl = await createPrivateDownloadUrl({ key: file.storageKey, expiresInSeconds: 60 });
  const target = generatedStorageUrl(signedUrl, file.storageKey, "get");
  if (target.pathname !== `/${file.storageKey}`) fail("Недопустимый путь получения файла.", 409);
  const upstream = await fetch(target, { method: "GET", headers: { "If-Match": file.verifiedEtag,
    ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}) },
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(120_000) });
  if (upstream.status === 412) {
    await upstream.body?.cancel(); fail("Файл изменился в хранилище и не может быть выдан.", 409);
  }
  if (upstream.status !== 200 && upstream.status !== 206) fail("Материал сейчас недоступен.", 404);
  let outputRange: string | null = null;
  let expected = size;
  if (upstream.status === 206) {
    const actual = upstream.headers.get("Content-Range");
    if (!range || actual !== `bytes ${range.start}-${range.end}/${size}`) fail("Неверный диапазон хранилища.", 409);
    outputRange = actual; expected = range.end - range.start + 1;
  }
  if (!upstream.body) fail("Пустой ответ хранилища.", 409);
  const reader = upstream.body.getReader();
  let transferred = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (transferred !== expected) { controller.error(new Error("Incomplete private file.")); return; }
          controller.close(); return;
        }
        transferred += value.length;
        if (transferred > expected) { await reader.cancel(); controller.error(new Error("Private file exceeds expected size.")); return; }
        controller.enqueue(value);
      } catch { controller.error(new Error("Private file stream interrupted.")); }
    },
    async cancel() { await reader.cancel(); }
  });
  const headers = new Headers({ "Content-Type": file.mimeType, "Content-Length": String(expected),
    "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline", "Accept-Ranges": "bytes",
    "Content-Security-Policy": "sandbox; default-src 'none'; frame-ancestors 'self'" });
  if (outputRange) headers.set("Content-Range", outputRange);
  return new Response(body, { status: outputRange ? 206 : 200, headers });
}
