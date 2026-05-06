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

  try {
    const user = await authenticateStaffUser(parsed.data.email, parsed.data.password);

    if (!user) {
      return NextResponse.redirect(new URL("/admin/login?error=auth", request.url), 303);
    }

    await setStaffSessionCookie({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
    return NextResponse.redirect(new URL("/admin/dashboard", request.url), 303);
  } catch (error) {
    console.error("Admin login failed", error);
    return NextResponse.redirect(new URL("/admin/login?error=system", request.url), 303);
  }
}
