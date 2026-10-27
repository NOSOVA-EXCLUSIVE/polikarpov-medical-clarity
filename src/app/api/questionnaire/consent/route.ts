import { NextResponse } from "next/server";

import { INTAKE_DATA_CONSENT_VERSION } from "@/features/questionnaire/intake-consent-content";
import {
  INTAKE_CONSENT_COOKIE_NAME,
  INTAKE_CONSENT_TTL_SECONDS,
  recordIntakeConsent
} from "@/features/questionnaire/intake-consent";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false, error: { code: "CONSENT_ORIGIN_INVALID" } }, { status: 403 });
  }
  try {
    if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
      return NextResponse.json({ ok: false, error: { code: "CONSENT_INPUT_INVALID" } }, { status: 400 });
    }
    const input = await request.json();
    if (input.accepted !== true || input.textVersion !== INTAKE_DATA_CONSENT_VERSION) {
      return NextResponse.json({
        ok: false,
        error: { code: "INTAKE_CONSENT_REQUIRED", message: "Подтвердите согласие на первом шаге анкеты." }
      }, { status: 403 });
    }
    const { receipt, cookie } = await recordIntakeConsent();
    const response = NextResponse.json({ ok: true, data: receipt });
    response.cookies.set(INTAKE_CONSENT_COOKIE_NAME, cookie, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: INTAKE_CONSENT_TTL_SECONDS
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    // Do not expose connection details when persistence is unavailable.
    return NextResponse.json({
      ok: false,
      error: {
        code: "INTAKE_CONSENT_SAVE_FAILED",
        message: "Не удалось сохранить согласие. Попробуйте ещё раз: данные и файлы пока не отправлены."
      }
    }, { status: 503 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(INTAKE_CONSENT_COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
