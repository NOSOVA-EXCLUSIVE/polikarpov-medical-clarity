import { NextResponse } from "next/server";

import { presignUploadSchema } from "@/features/questionnaire/schemas";
import {
  buildQuestionnaireUploadStorageKey
} from "@/features/questionnaire/service";
import { validatePresignUpload } from "@/features/questionnaire/upload-validation";
import { createPrivateUploadUrl } from "@/lib/storage/s3";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = presignUploadSchema.parse(json);
    const { extension } = validatePresignUpload(input);
    const storageKey = buildQuestionnaireUploadStorageKey({
      category: input.category,
      extension
    });

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
