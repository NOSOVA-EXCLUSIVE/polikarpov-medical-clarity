import "server-only";

import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env/server";
import { hashOpaqueToken } from "@/lib/security/tokens";

export const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY
  },
  forcePathStyle: env.S3_FORCE_PATH_STYLE
});

const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "storage", "private-uploads");

function getS3EndpointHostname() {
  try {
    return new URL(env.S3_ENDPOINT).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function shouldUseLocalUploadFallback() {
  return getS3EndpointHostname().endsWith("example.com");
}

function createLocalUploadSignature(key: string) {
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
  const rootPath = path.resolve(LOCAL_UPLOAD_ROOT);
  const targetPath = path.resolve(rootPath, ...key.split("/"));

  if (!targetPath.startsWith(`${rootPath}${path.sep}`) && targetPath !== rootPath) {
    throw new Error("Invalid storage key.");
  }

  return targetPath;
}

export function isValidLocalUploadSignature(key: string, signature: string | null) {
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

export async function createPrivateUploadUrl(input: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  if (shouldUseLocalUploadFallback()) {
    return buildLocalUploadUrl(input.key);
  }

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: input.key,
    ContentType: input.contentType
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: input.expiresInSeconds ?? 900
  });
}

export async function createPrivateDownloadUrl(input: {
  key: string;
  expiresInSeconds?: number;
}) {
  if (shouldUseLocalUploadFallback()) {
    return buildLocalFileUrl(input.key);
  }

  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: input.key
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: input.expiresInSeconds ?? 900
  });
}

export async function deletePrivateObject(key: string) {
  if (shouldUseLocalUploadFallback()) {
    const targetPath = buildPrivateStoragePath(key);
    await rm(targetPath, {
      force: true
    });
    return;
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key
    })
  );
}

export function buildPrivateStorageKey(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
}
