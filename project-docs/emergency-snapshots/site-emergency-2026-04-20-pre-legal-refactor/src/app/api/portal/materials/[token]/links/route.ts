import { NextResponse } from "next/server";

import { externalImagingLinkSchema } from "@/features/questionnaire/schemas";
import { addMaterialsExternalLink } from "@/features/portal/materials-service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;

  try {
    const json = await request.json();
    const input = externalImagingLinkSchema.parse(json);
    const result = await addMaterialsExternalLink(params.token, input);

    return NextResponse.json({
      ok: true,
      data: {
        link: result
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MATERIALS_LINK_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось сохранить внешнюю ссылку."
        }
      },
      { status: 400 }
    );
  }
}
