import "server-only";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env/server";
import { hashStaffPassword, verifyStaffPassword } from "@/lib/auth/password";

export async function authenticateStaffUser(email: string, password: string) {
  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (
    !user &&
    env.ADMIN_SEED_EMAIL &&
    env.ADMIN_SEED_PASSWORD &&
    email === env.ADMIN_SEED_EMAIL &&
    password === env.ADMIN_SEED_PASSWORD
  ) {
    user = await prisma.user.create({
      data: {
        email,
        name: env.ADMIN_SEED_NAME,
        role: "ADMIN",
        passwordHash: hashStaffPassword(password),
        isActive: true
      }
    });
  }

  if (!user || !user.isActive) {
    return null;
  }

  if (!verifyStaffPassword(password, user.passwordHash)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}
