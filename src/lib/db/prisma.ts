import "server-only";

import type { PrismaClient } from "@prisma/client";
import { assertPreviewIsolation, assertPreviewDatabaseUrl } from "@/lib/preview/guard";

const previewContext = assertPreviewIsolation();
const previewDatabaseUrl = previewContext ? process.env.DATABASE_URL! : null;
if (previewDatabaseUrl) assertPreviewDatabaseUrl(previewDatabaseUrl);
const { PrismaClient: PrismaClientConstructor } = require("@prisma/client") as typeof import("@prisma/client");

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  (!previewContext ? globalThis.__prisma__ : undefined) ??
  new PrismaClientConstructor({
    ...(previewDatabaseUrl ? { datasources: { db: { url: previewDatabaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}
