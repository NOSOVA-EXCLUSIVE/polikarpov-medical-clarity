import { NextResponse } from "next/server";

import { clearStaffSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  await clearStaffSessionCookie();
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
