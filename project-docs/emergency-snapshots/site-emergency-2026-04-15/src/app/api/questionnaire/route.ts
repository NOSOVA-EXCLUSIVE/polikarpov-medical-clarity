import { NextResponse } from "next/server";

import { questionnaireSubmitSchema } from "@/features/questionnaire/schemas";
import { hasBlockingRedFlags } from "@/features/questionnaire/status";

async function parseQuestionnaireRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return questionnaireSubmitSchema.parse(await request.json());
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload = formData.get("payload");

    if (typeof payload !== "string") {
      throw new Error(
        "Файлы должны быть предварительно загружены. Для отправки анкеты требуется JSON payload."
      );
    }

    return questionnaireSubmitSchema.parse(JSON.parse(payload));
  }

  throw new Error("Неподдерживаемый формат запроса. Анкета должна отправляться в JSON.");
}

export async function POST(request: Request) {
  try {
    const input = await parseQuestionnaireRequest(request);

    if (hasBlockingRedFlags(input.redFlags)) {
      return NextResponse.json(
        {
          success: false,
          error: "Эту ситуацию лучше не продолжать через онлайн-анкету.",
          redirectTo: "/not-suitable"
        },
        { status: 409 }
      );
    }

    const { submitQuestionnaire } = await import("@/features/questionnaire/service");
    const result = await submitQuestionnaire(input, {
      ip: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent")
    });

    return NextResponse.json({
      success: true,
      submissionId: result.submissionId,
      status: result.status
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось отправить анкету.";

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      {
        status: 400
      }
    );
  }
}
