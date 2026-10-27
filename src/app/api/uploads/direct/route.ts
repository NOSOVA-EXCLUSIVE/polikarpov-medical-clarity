import { NextResponse } from "next/server";

import {
  assertIntakeUploadOwnership,
  intakeConsentErrorResponse,
  requireIntakeConsent
} from "@/features/questionnaire/intake-consent";
import {
  isValidLocalUploadSignature,
  shouldUseLocalUploadFallback,
  writePrivateObjectLocally
} from "@/lib/storage/s3";

export async function PUT(request: Request) {
  try {
    const consent = await requireIntakeConsent(request);
    if (!shouldUseLocalUploadFallback()) {
      return NextResponse.json({
        ok: false,
        error: { code: "DIRECT_UPLOAD_DISABLED", message: "Локальная загрузка в хранилище отключена." }
      }, { status: 404 });
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key")?.trim() ?? "";
    const signature = url.searchParams.get("signature");
    assertIntakeUploadOwnership(key, consent.receiptId);
    if (!key || !isValidLocalUploadSignature(key, signature)) {
      return NextResponse.json({
        ok: false,
        error: { code: "DIRECT_UPLOAD_INVALID_SIGNATURE", message: "Недействительная ссылка загрузки." }
      }, { status: 403 });
    }

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: "DIRECT_UPLOAD_EMPTY", message: "Пустой файл не может быть загружен." }
      }, { status: 400 });
    }

    await writePrivateObjectLocally(key, bytes);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const consentError = intakeConsentErrorResponse(error);
    if (consentError) return consentError;
    return NextResponse.json({
      ok: false,
      error: { code: "DIRECT_UPLOAD_FAILED", message: "Не удалось загрузить файл. Попробуйте ещё раз." }
    }, { status: 400 });
  }
}
