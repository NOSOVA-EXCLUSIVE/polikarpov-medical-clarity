import { z } from "zod";

import { VIDEO_UPLOAD_POLICY } from "@/features/uploads/policies";

const trimToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, schema.optional());

export const preferredContactValues = [
  "EMAIL",
  "PHONE",
  "WHATSAPP",
  "TELEGRAM"
] as const;

export const requestedProductValues = [
  "SECOND_OPINION",
  "MEDICAL_ROUTE",
  "RECOVERY_4_WEEKS",
  "PERSONAL_SUPPORT",
  "NOT_SURE"
] as const;

export const uploadCategoryValues = ["DOCUMENT", "IMAGE", "VIDEO"] as const;

export const externalLinkKindValues = ["IMAGING", "VIDEO", "CLOUD"] as const;

export const legalAcceptanceInputSchema = z.object({
  acceptedOffer: z.literal(true),
  acceptedPrivacy: z.literal(true),
  acceptedMedicalData: z.literal(true),
  acceptedConsent: z.literal(true),
  confirmedInformationAccuracy: z.literal(true)
});

export const redFlagInputSchema = z.object({
  hasFever: z.boolean().default(false),
  hasAcuteSwelling: z.boolean().default(false),
  unableToBearWeight: z.boolean().default(false),
  hasNumbness: z.boolean().default(false),
  hasWeakness: z.boolean().default(false),
  hasBladderOrBowelSymptoms: z.boolean().default(false),
  hasChestPain: z.boolean().default(false),
  hasShortnessOfBreath: z.boolean().default(false),
  hasConfusion: z.boolean().default(false)
});

export const uploadDescriptorSchema = z.object({
  category: z.enum(uploadCategoryValues),
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  extension: z.string().trim().min(1).max(16),
  sizeBytes: z.number().int().positive(),
  durationSeconds: z.number().positive().max(VIDEO_UPLOAD_POLICY.maxDurationSeconds).optional(),
  storageKey: z.string().trim().min(1).max(512),
  accessPassword: trimToUndefined(z.string().max(512)),
  accessInstructions: trimToUndefined(z.string().max(2000))
});

export const externalImagingLinkSchema = z.object({
  kind: z.enum(externalLinkKindValues).default("IMAGING"),
  url: z.string().trim().url(),
  label: trimToUndefined(z.string().max(120)),
  note: trimToUndefined(z.string().max(2000)),
  accessPassword: trimToUndefined(z.string().max(512)),
  accessInstructions: trimToUndefined(z.string().max(2000))
});

export const questionnaireSubmitSchema = z.object({
  isAdult: z.literal(true),
  confirmsNonEmergency: z.literal(true),
  requestedProductCode: z.enum(requestedProductValues),
  patient: z.object({
    fullName: z.string().trim().min(2).max(160),
    age: trimToUndefined(z.string().max(16)),
    email: z.string().trim().email(),
    phone: z.string().trim().min(5).max(40),
    preferredContact: z.enum(preferredContactValues),
    country: z.string().trim().min(2).max(80),
    city: z.string().trim().min(1).max(120),
    timezone: z.string().trim().min(2).max(80)
  }),
  caseDetails: z.object({
    chiefComplaint: z.string().trim().min(1).max(4000),
    bodyArea: trimToUndefined(z.string().max(120)),
    symptomTimeline: trimToUndefined(z.string().max(4000)),
    traumaHistory: trimToUndefined(z.string().max(4000)),
    surgeryHistory: trimToUndefined(z.string().max(4000)),
    priorDiagnoses: trimToUndefined(z.string().max(4000)),
    priorSpecialists: trimToUndefined(z.string().max(4000)),
    currentTreatment: trimToUndefined(z.string().max(4000)),
    goalOfConsultation: trimToUndefined(z.string().max(4000)),
    reviewNoteForDoctor: trimToUndefined(z.string().max(4000))
  }),
  redFlags: redFlagInputSchema,
  uploads: z.array(uploadDescriptorSchema).max(20).default([]),
  externalLinks: z.array(externalImagingLinkSchema).max(20).default([]),
  legal: legalAcceptanceInputSchema
});

export const presignUploadSchema = z.object({
  category: z.enum(uploadCategoryValues),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  durationSeconds: z.number().positive().optional()
});

export const completeUploadSchema = z.object({
  category: z.enum(uploadCategoryValues),
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  extension: z.string().trim().min(1).max(16),
  sizeBytes: z.number().int().positive(),
  durationSeconds: z.number().positive().optional(),
  storageKey: z.string().trim().min(1).max(512),
  accessPassword: trimToUndefined(z.string().max(512)),
  accessInstructions: trimToUndefined(z.string().max(2000))
});

export type QuestionnaireSubmitInput = z.infer<typeof questionnaireSubmitSchema>;
export type UploadDescriptorInput = z.infer<typeof uploadDescriptorSchema>;
export type ExternalImagingLinkInput = z.infer<typeof externalImagingLinkSchema>;
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
