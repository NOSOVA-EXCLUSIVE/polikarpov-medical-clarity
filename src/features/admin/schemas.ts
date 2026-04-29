import { z } from "zod";

export const staffLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8)
});

export const requestRequirementSchema = z.object({
  note: z.string().trim().min(10).max(4000)
});

export const rejectApplicationSchema = z.object({
  note: z.string().trim().min(10).max(4000)
});

export const createOfferSchema = z.object({
  productCode: z.enum([
    "SECOND_OPINION",
    "MEDICAL_ROUTE",
    "RECOVERY_4_WEEKS",
    "PERSONAL_SUPPORT"
  ]),
  chargeModel: z.enum(["ONE_TIME", "PACKAGE", "RECURRING_READY"]),
  amountMajor: z.coerce.number().positive().max(10_000_000),
  currency: z.string().trim().min(3).max(8).default("RUB"),
  durationMinutes: z.coerce.number().int().positive().max(24 * 60)
});

export const revealSensitiveAccessSchema = z.object({
  targetType: z.enum(["upload", "externalLink"]),
  targetId: z.string().trim().min(1),
  action: z.enum(["reveal", "copy"])
});

export const staffReplySchema = z.object({
  body: z.string().trim().min(1).max(4000)
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;
export type RequestRequirementInput = z.infer<typeof requestRequirementSchema>;
export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type RevealSensitiveAccessInput = z.infer<typeof revealSensitiveAccessSchema>;
export type StaffReplyInput = z.infer<typeof staffReplySchema>;
