import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { presignUploadSchema } from "@/features/questionnaire/schemas";
import { intakeConsentErrorResponse, requireIntakeConsent } from "@/features/questionnaire/intake-consent";
import { validatePresignUpload } from "@/features/questionnaire/upload-validation";
import { createPrivateUploadUrl } from "@/lib/storage/s3";

export async function POST(request: Request) {
  try {
    const consent = await requireIntakeConsent(request);
    const json = await request.json();
    const input = presignUploadSchema.parse(json);
    const { extension } = validatePresignUpload(input);
    const storageKey = `intake/incoming/${consent.receiptId}/${input.category.toLowerCase()}/${Date.now()}-${randomUUID()}.${extension.toLowerCase()}`;

    const uploadUrl = await createPrivateUploadUrl({
      key: storageKey,
      contentType: input.mimeType,
      maximumSizeInBytes: input.sizeBytes
    });

    return NextResponse.json({
      ok: true,
      data: {
        storageKey,
        uploadUrl,
        contentType: input.mimeType,
        expiresInSeconds: 900
      }
    });
  } catch (error) {
    const consentError = intakeConsentErrorResponse(error);
    if (consentError) return consentError;
    const message =
      error instanceof Error ? error.message : "Не удалось подготовить загрузку файла.";

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UPLOAD_PRESIGN_FAILED",
          message
        }
      },
      {
        status: 400
      }
    );
  }
}
