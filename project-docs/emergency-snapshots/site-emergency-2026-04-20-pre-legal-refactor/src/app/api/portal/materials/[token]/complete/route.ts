import { NextResponse } from "next/server";

import { completeUploadSchema } from "@/features/questionnaire/schemas";
import { attachMaterialsUpload } from "@/features/portal/materials-service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;

  try {
    const json = await request.json();
    const input = completeUploadSchema.parse(json);
    const result = await attachMaterialsUpload(params.token, input);

    return NextResponse.json({
      ok: true,
      data: {
        upload: {
          ...result,
          sizeBytes: Number(result.sizeBytes)
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MATERIALS_COMPLETE_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось сохранить дозагруженный файл."
        }
      },
      { status: 400 }
    );
  }
}
