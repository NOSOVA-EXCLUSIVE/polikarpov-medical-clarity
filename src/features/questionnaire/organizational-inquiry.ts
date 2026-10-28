import { z } from "zod";

import { preferredContactValues } from "./schemas";

function isOptionalTimezone(value: string) {
  if (!value) return true;
  if (/^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

const telegramUsernameSchema = z.string().trim().max(65)
  .regex(/^@?[A-Za-z0-9_]{1,64}$/, "Укажите имя пользователя Telegram без ссылки: @username.")
  .transform((value) => `@${value.replace(/^@/, "")}`);

export const organizationalInquirySchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).default("").refine(
    (value) => !value || (/^[+\d ().-]+$/.test(value) && value.replace(/\D/g, "").length >= 6),
    "Укажите телефон с кодом страны: не менее шести цифр."
  ),
  preferredContact: z.enum(preferredContactValues).default("EMAIL"),
  telegramUsername: z.string().trim().max(65).default(""),
  country: z.string().trim().min(2).max(80),
  timezone: z.string().trim().max(80).default("").refine(
    isOptionalTimezone,
    "Выберите часовой пояс из подсказок или укажите корректный пояс, например Europe/Moscow."
  ),
  task: z.string().trim().min(5).max(1000),
  materials: z.string().trim().max(1000).default(""),
  website: z.string().max(0).optional()
}).superRefine((input, context) => {
  if ((input.preferredContact === "PHONE" || input.preferredContact === "WHATSAPP") && !input.phone) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Для связи по телефону или WhatsApp укажите номер с кодом страны." });
  }
  if (input.preferredContact === "TELEGRAM" && !telegramUsernameSchema.safeParse(input.telegramUsername).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["telegramUsername"], message: "Для связи в Telegram укажите имя пользователя без ссылки: @username." });
  }
}).transform((input) => ({
  ...input,
  telegramUsername: input.preferredContact === "TELEGRAM"
    ? telegramUsernameSchema.parse(input.telegramUsername)
    : ""
}));

export type OrganizationalInquiryInput = z.infer<typeof organizationalInquirySchema>;

const contactMetadataSchema = z.object({
  version: z.literal(1),
  telegramUsername: telegramUsernameSchema
});

export type OrganizationalContactMetadata = z.infer<typeof contactMetadataSchema>;

export function createOrganizationalContactMetadata(input: OrganizationalInquiryInput): OrganizationalContactMetadata | null {
  return input.preferredContact === "TELEGRAM"
    ? { version: 1, telegramUsername: input.telegramUsername }
    : null;
}

/** Only the versioned contact of an organizational inquiry is exposed to the staff view. */
export function readOrganizationalContactMetadata(value: unknown): OrganizationalContactMetadata | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const metadata = value as Record<string, unknown>;
  if (metadata.kind !== "organizational_selection") return null;
  const contact = contactMetadataSchema.safeParse(metadata.contact);
  return contact.success ? contact.data : null;
}
