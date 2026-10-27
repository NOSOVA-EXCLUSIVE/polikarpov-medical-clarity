import "server-only";

import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { del as deleteBlob, head as headBlob, issueSignedToken, presignUrl } from "@vercel/blob";

import { env } from "@/lib/env/server";
import {
  assertPreviewAllowedOperation,
  assertPreviewBlobToken,
  assertPreviewBlobSignedUrl,
  assertPreviewBlobUrl,
  assertPreviewStorageKey,
  isPreviewIsolationRequired
} from "@/lib/preview/guard";
import { hashOpaqueToken } from "@/lib/security/tokens";

const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "storage", "private-uploads");
const PRODUCTION_STORAGE_ERROR = "Production file storage is not configured";

type PrivateStorageProvider = "blob" | "s3" | "local" | "unconfigured";

let s3ClientInstance: S3Client | null = null;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getS3EndpointHostname() {
  if (!env.S3_ENDPOINT) {
    return "";
  }

  try {
    return new URL(env.S3_ENDPOINT).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hasPlaceholderStorageConfig() {
  const endpointHostname = getS3EndpointHostname();
  const accessKeyId = env.S3_ACCESS_KEY_ID.trim().toLowerCase();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY.trim().toLowerCase();

  return (
    endpointHostname.endsWith("example.com") ||
    accessKeyId === "local-dev-access-key" ||
    secretAccessKey === "local-dev-secret-key"
  );
}

function hasBlobStorageConfig() {
  return Boolean(env.BLOB_READ_WRITE_TOKEN.trim());
}

function getBlobReadWriteToken() {
  assertPreviewAllowedOperation("storage:blob");
  const token = env.BLOB_READ_WRITE_TOKEN;
  assertPreviewBlobToken(token);
  return token;
}

function hasConfiguredS3Storage() {
  return (
    Boolean(env.S3_REGION.trim()) &&
    Boolean(env.S3_BUCKET.trim()) &&
    Boolean(env.S3_ENDPOINT.trim()) &&
    Boolean(env.S3_ACCESS_KEY_ID.trim()) &&
    Boolean(env.S3_SECRET_ACCESS_KEY.trim()) &&
    !hasPlaceholderStorageConfig()
  );
}

function getPrivateStorageProvider(): PrivateStorageProvider {
  if (isPreviewIsolationRequired()) {
    getBlobReadWriteToken();
    return "blob";
  }

  if (hasBlobStorageConfig()) {
    return "blob";
  }

  if (hasConfiguredS3Storage()) {
    return "s3";
  }

  if (env.NODE_ENV !== "production") {
    return "local";
  }

  return "unconfigured";
}

function getS3Client() {
  assertPreviewAllowedOperation("storage:s3");

  if (!s3ClientInstance) {
    if (!hasConfiguredS3Storage()) {
      throw new Error(PRODUCTION_STORAGE_ERROR);
    }

    s3ClientInstance = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE
    });
  }

  return s3ClientInstance;
}

async function createPrivateBlobUrl(input: {
  key: string;
  operation: "get" | "put";
  contentType?: string;
  expiresInSeconds?: number;
  maximumSizeInBytes?: number;
}) {
  assertPreviewStorageKey(input.key);
  const token = getBlobReadWriteToken();
  const validUntil = Date.now() + (input.expiresInSeconds ?? 900) * 1000;

  const signedToken = await issueSignedToken({
    pathname: input.key,
    operations: [input.operation],
    validUntil,
    allowedContentTypes: input.contentType ? [input.contentType] : undefined,
    maximumSizeInBytes: input.maximumSizeInBytes,
    token
  });

  const { presignedUrl } =
    input.operation === "put"
      ? await presignUrl(signedToken, {
          access: "private",
          operation: "put",
          pathname: input.key,
          validUntil,
          allowedContentTypes: input.contentType ? [input.contentType] : undefined,
          maximumSizeInBytes: input.maximumSizeInBytes,
          addRandomSuffix: false
        })
      : await presignUrl(signedToken, {
          access: "private",
          operation: "get",
          pathname: input.key,
          validUntil
        });

  assertPreviewBlobSignedUrl(presignedUrl, {
    key: input.key,
    operation: input.operation,
    signedToken,
    validUntil,
    contentType: input.contentType,
    maximumSizeInBytes: input.maximumSizeInBytes
  });
  return presignedUrl;
}

export function isProductionFileStorageConfigured() {
  const provider = getPrivateStorageProvider();
  return provider === "blob" || provider === "s3";
}

export function shouldUseLocalUploadFallback() {
  return getPrivateStorageProvider() === "local";
}

export function assertPrivateObjectStorageIsConfigured() {
  if (getPrivateStorageProvider() === "unconfigured") {
    throw new Error(PRODUCTION_STORAGE_ERROR);
  }
}

function createLocalUploadSignature(key: string) {
  assertPreviewAllowedOperation("storage:local");
  return hashOpaqueToken(key);
}

function buildLocalUploadUrl(key: string) {
  const uploadUrl = new URL("/api/uploads/direct", env.APP_URL);
  uploadUrl.searchParams.set("key", key);
  uploadUrl.searchParams.set("signature", createLocalUploadSignature(key));
  return uploadUrl.toString();
}

function buildLocalFileUrl(key: string) {
  const fileUrl = new URLSearchParams();
  fileUrl.set("key", key);
  fileUrl.set("signature", createLocalUploadSignature(key));
  return `/api/uploads/file?${fileUrl.toString()}`;
}

export function buildPrivateStoragePath(key: string) {
  assertPreviewAllowedOperation("storage:local");
  const rootPath = path.resolve(LOCAL_UPLOAD_ROOT);
  const targetPath = path.resolve(rootPath, ...key.split("/"));

  if (!targetPath.startsWith(`${rootPath}${path.sep}`) && targetPath !== rootPath) {
    throw new Error("Invalid storage key.");
  }

  return targetPath;
}

export function isValidLocalUploadSignature(key: string, signature: string | null) {
  assertPreviewAllowedOperation("storage:local");
  return Boolean(signature) && signature === createLocalUploadSignature(key);
}

export async function writePrivateObjectLocally(key: string, bytes: Uint8Array) {
  const targetPath = buildPrivateStoragePath(key);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, bytes);
}

export async function localPrivateObjectExists(key: string) {
  const targetPath = buildPrivateStoragePath(key);

  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function privateObjectExists(key: string) {
  const provider = getPrivateStorageProvider();
  assertPreviewStorageKey(key);

  if (provider === "local") {
    return localPrivateObjectExists(key);
  }

  if (provider === "blob") {
    const token = getBlobReadWriteToken();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const blob = await headBlob(key, {
          token
        });
        return Boolean(blob);
      } catch {
        if (attempt === 5) {
          return false;
        }

        await wait(250 * attempt);
      }
    }
  }

  if (provider === "s3") {
    try {
      await getS3Client().send(
        new HeadObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

// Metadata for the manual deliverable flow. Accepts a server-generated key, never a client URL.
export async function getPrivateBlobMetadata(key: string) {
  assertPreviewStorageKey(key);
  if (getPrivateStorageProvider() !== "blob") throw new Error("Private Blob storage is required for this operation.");
  const blob = await headBlob(key, { token: getBlobReadWriteToken() });
  assertPreviewBlobUrl(blob.url, key);
  if (blob.pathname !== key || !Number.isSafeInteger(blob.size) || blob.size <= 0 ||
      typeof blob.etag !== "string" || !blob.etag || blob.etag.length > 200 || /[\r\n]/.test(blob.etag)) {
    throw new Error("Private object metadata does not match the requested key.");
  }
  return { sizeBytes: blob.size, contentType: blob.contentType, etag: blob.etag };
}

export async function createPrivateUploadUrl(input: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
  maximumSizeInBytes?: number;
}) {
  assertPrivateObjectStorageIsConfigured();
  assertPreviewStorageKey(input.key);

  const provider = getPrivateStorageProvider();

  if (provider === "local") {
    return buildLocalUploadUrl(input.key);
  }

  if (provider === "blob") {
    return createPrivateBlobUrl({
      key: input.key,
      operation: "put",
      contentType: input.contentType,
      expiresInSeconds: input.expiresInSeconds,
      maximumSizeInBytes: input.maximumSizeInBytes
    });
  }

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: input.key,
    ContentType: input.contentType
  });

  return getSignedUrl(getS3Client(), command, {
    expiresIn: input.expiresInSeconds ?? 900
  });
}

export async function createPrivateDownloadUrl(input: {
  key: string;
  expiresInSeconds?: number;
}) {
  assertPrivateObjectStorageIsConfigured();
  assertPreviewStorageKey(input.key);

  const provider = getPrivateStorageProvider();

  if (provider === "local") {
    return buildLocalFileUrl(input.key);
  }

  if (provider === "blob") {
    return createPrivateBlobUrl({
      key: input.key,
      operation: "get",
      expiresInSeconds: input.expiresInSeconds
    });
  }

  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: input.key
  });

  return getSignedUrl(getS3Client(), command, {
    expiresIn: input.expiresInSeconds ?? 900
  });
}

export async function deletePrivateObject(key: string) {
  assertPrivateObjectStorageIsConfigured();
  assertPreviewStorageKey(key);

  const provider = getPrivateStorageProvider();

  if (provider === "local") {
    const targetPath = buildPrivateStoragePath(key);
    await rm(targetPath, {
      force: true
    });
    return;
  }

  if (provider === "blob") {
    await deleteBlob(key, {
      token: getBlobReadWriteToken()
    });
    return;
  }

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key
    })
  );
}

export function buildPrivateStorageKey(parts: string[]) {
  const key = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");

  assertPreviewStorageKey(key);
  return key;
}
