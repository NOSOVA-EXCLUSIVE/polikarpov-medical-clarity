import { NextResponse } from "next/server";

import { submitMaterialsRequirement } from "@/features/portal/materials-service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;

  try {
    await submitMaterialsRequirement(params.token);

    return NextResponse.json({
      ok: true,
      data: {
        submitted: true
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MATERIALS_SUBMIT_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось отправить материалы врачу."
        }
      },
      { status: 400 }
    );
  }
}
