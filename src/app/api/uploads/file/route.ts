import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getStaffSession } from "@/lib/auth/session";
import {
  buildPrivateStorageKey,
  buildPrivateStoragePath,
  createPrivateDownloadUrl,
  isValidLocalUploadSignature,
  shouldUseLocalUploadFallback
} from "@/lib/storage/s3";

function encodeFileName(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export async function GET(request: Request) {
  const session = await getStaffSession();

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }

  const url = new URL(request.url);
  const rawKey = url.searchParams.get("key");
  const signature = url.searchParams.get("signature");

  if (!rawKey) {
    return NextResponse.json({ error: "Missing storage key." }, { status: 400 });
  }

  const normalizedKey = buildPrivateStorageKey(rawKey.split("/"));

  if (normalizedKey !== rawKey || !isValidLocalUploadSignature(normalizedKey, signature)) {
    return NextResponse.json({ error: "Invalid file access signature." }, { status: 403 });
  }

  const upload = await prisma.applicationUpload.findFirst({
    where: { storageKey: normalizedKey },
    select: {
      originalName: true,
      mimeType: true
    }
  });

  if (!upload) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  if (!shouldUseLocalUploadFallback()) {
    const redirectUrl = await createPrivateDownloadUrl({ key: normalizedKey });
    return NextResponse.redirect(redirectUrl, 302);
  }

  const stream = createReadStream(buildPrivateStoragePath(normalizedKey));

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": upload.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeFileName(upload.originalName)}`,
      "Cache-Control": "private, no-store"
    }
  });
}
