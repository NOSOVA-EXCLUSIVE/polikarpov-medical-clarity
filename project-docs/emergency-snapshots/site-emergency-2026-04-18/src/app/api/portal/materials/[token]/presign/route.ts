import { NextResponse } from "next/server";

import { presignUploadSchema } from "@/features/questionnaire/schemas";
import { createMaterialsUploadUrl } from "@/features/portal/materials-service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;

  try {
    const json = await request.json();
    const input = presignUploadSchema.parse(json);
    const result = await createMaterialsUploadUrl(params.token, input);

    return NextResponse.json({
      ok: true,
      data: result
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MATERIALS_PRESIGN_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось подготовить загрузку для дозагрузки материалов."
        }
      },
      { status: 400 }
    );
  }
}
