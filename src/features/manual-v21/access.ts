import "server-only";

import { getManualSession } from "@/lib/auth/manual-session";
import { getStaffSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertManualGrant } from "@/features/manual-v21/service";

export function assertManualSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw Object.assign(new Error("Недопустимый источник запроса."), { status: 403 });
  }
}

export async function requireManualPatient() {
  const session = await getManualSession();
  if (!session) throw Object.assign(new Error("Войдите по персональной ссылке."), { status: 401 });
  // The cookie is identity only. Revocation and case access deadlines are re-read for every request.
  await assertManualGrant({ caseId: session.caseId, grantId: session.grantId });
  return session;
}

export async function requireManualStaff() {
  const session = await getStaffSession();
  if (!session) throw Object.assign(new Error("Требуется вход врача."), { status: 401 });
  const user = await prisma.user.findFirst({ where: { id: session.id, isActive: true },
    select: { id: true, role: true, name: true, email: true } });
  if (!user || (user.role !== "DOCTOR" && user.role !== "ADMIN")) {
    throw Object.assign(new Error("Доступ сотрудника недоступен."), { status: 403 });
  }
  return user;
}

export function manualErrorStatus(error: unknown) {
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 400;
  return [400, 401, 403, 404, 409, 413, 415].includes(status) ? status : 400;
}
