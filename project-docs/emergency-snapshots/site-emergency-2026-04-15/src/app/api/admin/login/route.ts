import { NextResponse } from "next/server";

import { authenticateStaffUser } from "@/features/admin/auth-service";
import { staffLoginSchema } from "@/features/admin/schemas";
import { setStaffSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parsed = staffLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", request.url), 303);
  }

  const user = await authenticateStaffUser(parsed.data.email, parsed.data.password);

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login?error=auth", request.url), 303);
  }

  await setStaffSessionCookie(user);
  return NextResponse.redirect(new URL("/admin/dashboard", request.url), 303);
}
