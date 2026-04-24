import { NextResponse } from "next/server";

import { revealSensitiveAccessSchema } from "@/features/admin/schemas";
import { revealSensitiveAccess } from "@/features/admin/service";
import { getStaffSession } from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getStaffSession();

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Нужна staff-сессия."
        }
      },
      { status: 401 }
    );
  }

  const params = await context.params;
  const json = await request.json();
  const parsed = revealSensitiveAccessSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "Некорректный запрос к чувствительным данным."
        }
      },
      { status: 400 }
    );
  }

  try {
    const { action, targetId, targetType } = parsed.data;
    const result = await revealSensitiveAccess({
      actor: session,
      applicationId: params.id,
      action,
      targetId,
      targetType
    });

    return NextResponse.json({
      ok: true,
      data: result
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SENSITIVE_ACCESS_FAILED",
          message:
            error instanceof Error ? error.message : "Не удалось получить чувствительные данные."
        }
      },
      { status: 400 }
    );
  }
}
