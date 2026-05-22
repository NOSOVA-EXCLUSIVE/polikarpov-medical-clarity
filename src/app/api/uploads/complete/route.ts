import { NextResponse } from "next/server";

import { completeUploadSchema } from "@/features/questionnaire/schemas";
import { validateCompletedUpload } from "@/features/questionnaire/upload-validation";
import {
  assertPrivateObjectStorageIsConfigured,
  privateObjectExists
} from "@/lib/storage/s3";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = completeUploadSchema.parse(json);

    validateCompletedUpload(input);
    assertPrivateObjectStorageIsConfigured();

    const exists = await privateObjectExists(input.storageKey);

    if (!exists) {
      throw new Error(
        "Файл не найден во временном хранилище. Попробуйте загрузить его еще раз."
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        upload: {
          category: input.category,
          originalName: input.originalName,
          mimeType: input.mimeType,
          extension: input.extension.toLowerCase(),
          sizeBytes: input.sizeBytes,
          durationSeconds: input.durationSeconds ?? null,
          storageKey: input.storageKey,
          accessPassword: input.accessPassword ?? null,
          accessInstructions: input.accessInstructions ?? null
        }
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось завершить загрузку файла.";

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UPLOAD_COMPLETE_FAILED",
          message
        }
      },
      {
        status: 400
      }
    );
  }
}
