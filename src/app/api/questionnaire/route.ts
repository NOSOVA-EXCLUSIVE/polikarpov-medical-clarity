import { NextResponse } from "next/server";
import { z } from "zod";

import {
  assertIntakeUploadOwnership,
  INTAKE_CONSENT_COOKIE_NAME,
  IntakeConsentRequiredError,
  requireIntakeConsent
} from "@/features/questionnaire/intake-consent";

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
    const intakeConsent = await requireIntakeConsent(request);
    const input = await parseQuestionnaireRequest(request);
    for (const upload of input.uploads) {
      assertIntakeUploadOwnership(upload.storageKey, intakeConsent.receiptId);
    }

    if (hasBlockingRedFlags(input.redFlags)) {
      return NextResponse.json(
        {
          success: false,
          error: "Эту ситуацию лучше не продолжать в дистанционном формате.",
          redirectTo: "/not-suitable"
        },
        { status: 409 }
      );
    }

    const { submitQuestionnaire } = await import("@/features/questionnaire/service");
    const result = await submitQuestionnaire(input, {
      ip: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      intakeConsent
    });

    const response = NextResponse.json({
      success: true,
      submissionId: result.submissionId,
      displayNumber: result.displayNumber,
      status: result.status
    });
    response.cookies.delete(INTAKE_CONSENT_COOKIE_NAME);
    return response;
  } catch (error) {
    if (error instanceof IntakeConsentRequiredError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 403 });
    const invalidInput = error instanceof z.ZodError || error instanceof SyntaxError;
    return NextResponse.json(
      {
        success: false,
        code: invalidInput ? "QUESTIONNAIRE_INPUT_INVALID" : "QUESTIONNAIRE_SAVE_UNAVAILABLE",
        error: invalidInput
          ? "Проверьте обязательные поля и выбранный формат анкеты."
          : "Не удалось сохранить анкету. Повторите попытку позже: подтверждение сохранения не получено."
      },
      {
        status: invalidInput ? 400 : 503
      }
    );
  }
}
