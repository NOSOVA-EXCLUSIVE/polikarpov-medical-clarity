import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  ENCRYPTION_KEY_BASE64: z.string().min(1),
  TOKEN_HASH_SECRET: z.string().min(1),
  STAFF_SESSION_SECRET: z.string().min(1),
  ADMIN_SEED_EMAIL: z.string().email().optional(),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional(),
  ADMIN_SEED_NAME: z.string().min(1).default("Practice Admin"),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((value) => value === "true"),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  POSTMARK_SERVER_TOKEN: z.string().min(1),
  POSTMARK_FROM_EMAIL: z.string().email(),
  POSTMARK_REPLY_TO_EMAIL: z.string().email(),
  INNGEST_APP_ID: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().min(1),
  INNGEST_SIGNING_KEY: z.string().min(1),
  DEFAULT_CURRENCY: z.string().min(1).default("EUR"),
  DEFAULT_HELD_SLOT_TTL_MINUTES: z.coerce.number().int().positive().default(20),
  DEFAULT_OFFER_TTL_HOURS: z.coerce.number().int().positive().default(72),
  DEFAULT_PORTAL_ACCESS_TTL_HOURS: z.coerce.number().int().positive().default(24),
  DEFAULT_MATERIALS_TTL_HOURS: z.coerce.number().int().positive().default(168),
  LEGAL_OFFER_VERSION: z.string().min(1).default("2026-04-09"),
  LEGAL_PRIVACY_VERSION: z.string().min(1).default("2026-04-09"),
  LEGAL_CONSENT_VERSION: z.string().min(1).default("2026-04-09")
});

export const env = serverEnvSchema.parse(process.env);

export type ServerEnv = typeof env;
