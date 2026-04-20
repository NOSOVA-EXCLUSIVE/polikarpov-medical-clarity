-- CreateEnum
CREATE TYPE "ProductCode" AS ENUM (
  'SECOND_OPINION',
  'MEDICAL_ROUTE',
  'RECOVERY_4_WEEKS',
  'PERSONAL_SUPPORT'
);

CREATE TYPE "ApplicationStatus" AS ENUM (
  'NEW',
  'UNDER_REVIEW',
  'NEEDS_UPLOAD',
  'NEEDS_IMAGING_ACCESS',
  'REJECTED',
  'BOOKING_SENT',
  'PAID',
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED'
);

CREATE TYPE "PreferredContact" AS ENUM (
  'EMAIL',
  'PHONE',
  'WHATSAPP',
  'TELEGRAM'
);

CREATE TYPE "UserRole" AS ENUM (
  'DOCTOR',
  'ADMIN'
);

CREATE TYPE "UploadCategory" AS ENUM (
  'DOCUMENT',
  'IMAGE',
  'VIDEO'
);

CREATE TYPE "UploadStatus" AS ENUM (
  'PENDING',
  'ATTACHED',
  'DELETED'
);

CREATE TYPE "ExternalLinkKind" AS ENUM (
  'IMAGING',
  'VIDEO',
  'CLOUD'
);

CREATE TYPE "ImagingSourceType" AS ENUM (
  'UPLOADED',
  'EXTERNAL_LINK_ONLY',
  'MIXED'
);

CREATE TYPE "RequirementType" AS ENUM (
  'UPLOAD',
  'IMAGING_ACCESS'
);

CREATE TYPE "RequirementStatus" AS ENUM (
  'OPEN',
  'RESOLVED'
);

CREATE TYPE "ChargeModel" AS ENUM (
  'ONE_TIME',
  'PACKAGE',
  'RECURRING_READY'
);

CREATE TYPE "OfferStatus" AS ENUM (
  'OPEN',
  'HELD',
  'PAID',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE "SlotStatus" AS ENUM (
  'AVAILABLE',
  'HELD',
  'BOOKED',
  'BLOCKED'
);

CREATE TYPE "AppointmentStatus" AS ENUM (
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED'
);

CREATE TYPE "MessageMode" AS ENUM (
  'CLARIFICATION_WINDOW',
  'SUPPORT_PACKAGE'
);

CREATE TYPE "ThreadStatus" AS ENUM (
  'INACTIVE',
  'ACTIVE',
  'READ_ONLY',
  'CLOSED'
);

CREATE TYPE "ReadOnlyReason" AS ENUM (
  'WINDOW_EXPIRED',
  'MESSAGE_LIMIT_REACHED',
  'PACKAGE_ENDED',
  'MANUAL_LOCK',
  'CASE_STATUS_CHANGE'
);

CREATE TYPE "CloseReason" AS ENUM (
  'CASE_COMPLETED',
  'CASE_ARCHIVED',
  'MANUAL_CLOSE',
  'REJECTED'
);

CREATE TYPE "MessageAuthorRole" AS ENUM (
  'PATIENT',
  'DOCTOR',
  'ADMIN',
  'SYSTEM'
);

CREATE TYPE "TokenPurpose" AS ENUM (
  'BOOKING',
  'PORTAL_ACCESS',
  'MATERIALS'
);

CREATE TYPE "AuditActorType" AS ENUM (
  'SYSTEM',
  'USER',
  'PATIENT'
);

CREATE TYPE "AuditEntityType" AS ENUM (
  'APPLICATION',
  'REQUIREMENT',
  'OFFER',
  'SLOT',
  'PAYMENT',
  'THREAD',
  'MESSAGE',
  'TOKEN',
  'UPLOAD',
  'EXTERNAL_LINK',
  'SETTING'
);

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductConfig" (
  "id" TEXT NOT NULL,
  "productCode" "ProductCode" NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "shortLabel" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT true,
  "isActivelySold" BOOLEAN NOT NULL DEFAULT false,
  "chargeModelDefault" "ChargeModel" NOT NULL,
  "messageMode" "MessageMode" NOT NULL,
  "clarificationWindowHours" INTEGER,
  "patientMessageLimit" INTEGER,
  "defaultDurationMinutes" INTEGER,
  "defaultPriceCents" INTEGER,
  "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductConfig_patientMessageLimit_check" CHECK ("patientMessageLimit" IS NULL OR "patientMessageLimit" > 0),
  CONSTRAINT "ProductConfig_clarificationWindowHours_check" CHECK ("clarificationWindowHours" IS NULL OR "clarificationWindowHours" > 0),
  CONSTRAINT "ProductConfig_defaultDurationMinutes_check" CHECK ("defaultDurationMinutes" IS NULL OR "defaultDurationMinutes" > 0),
  CONSTRAINT "ProductConfig_defaultPriceCents_check" CHECK ("defaultPriceCents" IS NULL OR "defaultPriceCents" >= 0)
);

CREATE TABLE "Patient" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "preferredContact" "PreferredContact" NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Application" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "requestedProductCode" "ProductCode",
  "assignedProductCode" "ProductCode",
  "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
  "imagingSourceType" "ImagingSourceType",
  "chiefComplaint" TEXT NOT NULL,
  "bodyArea" TEXT,
  "symptomTimeline" TEXT,
  "traumaHistory" TEXT,
  "surgeryHistory" TEXT,
  "priorDiagnoses" TEXT,
  "priorSpecialists" TEXT,
  "currentTreatment" TEXT,
  "goalOfConsultation" TEXT,
  "reviewNoteForDoctor" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewStartedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "activeAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationRedFlag" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "hasFever" BOOLEAN NOT NULL DEFAULT false,
  "hasAcuteSwelling" BOOLEAN NOT NULL DEFAULT false,
  "unableToBearWeight" BOOLEAN NOT NULL DEFAULT false,
  "hasNumbness" BOOLEAN NOT NULL DEFAULT false,
  "hasWeakness" BOOLEAN NOT NULL DEFAULT false,
  "hasBladderOrBowelSymptoms" BOOLEAN NOT NULL DEFAULT false,
  "hasChestPain" BOOLEAN NOT NULL DEFAULT false,
  "hasShortnessOfBreath" BOOLEAN NOT NULL DEFAULT false,
  "hasConfusion" BOOLEAN NOT NULL DEFAULT false,
  "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  "blockReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationRedFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalAcceptance" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "offerVersion" TEXT NOT NULL,
  "privacyVersion" TEXT NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationUpload" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "category" "UploadCategory" NOT NULL,
  "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "durationSeconds" INTEGER,
  "storageKey" TEXT NOT NULL,
  "accessPasswordCiphertext" TEXT,
  "accessInstructionsCiphertext" TEXT,
  "uploadedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationUpload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationUpload_sizeBytes_check" CHECK ("sizeBytes" >= 0),
  CONSTRAINT "ApplicationUpload_durationSeconds_check" CHECK ("durationSeconds" IS NULL OR "durationSeconds" >= 0)
);

CREATE TABLE "ApplicationExternalLink" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "kind" "ExternalLinkKind" NOT NULL DEFAULT 'IMAGING',
  "url" TEXT NOT NULL,
  "label" TEXT,
  "note" TEXT,
  "accessPasswordCiphertext" TEXT,
  "accessInstructionsCiphertext" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationExternalLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationRequirement" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "type" "RequirementType" NOT NULL,
  "status" "RequirementStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "resolvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ApplicationRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Offer" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "productCode" "ProductCode" NOT NULL,
  "chargeModel" "ChargeModel" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "durationMinutes" INTEGER NOT NULL,
  "status" "OfferStatus" NOT NULL DEFAULT 'OPEN',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSentAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Offer_amountCents_check" CHECK ("amountCents" >= 0),
  CONSTRAINT "Offer_durationMinutes_check" CHECK ("durationMinutes" > 0)
);

CREATE TABLE "CalendarSlot" (
  "id" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
  "holdExpiresAt" TIMESTAMP(3),
  "heldOfferId" TEXT,
  "bookedAppointmentId" TEXT,
  "blockedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarSlot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarSlot_time_check" CHECK ("endsAt" > "startsAt")
);

CREATE TABLE "Appointment" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "meetingUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Appointment_time_check" CHECK ("endsAt" > "startsAt")
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "chargeModel" "ChargeModel" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "externalPaymentId" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amountCents_check" CHECK ("amountCents" >= 0)
);

CREATE TABLE "MessageThread" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "productCode" "ProductCode" NOT NULL,
  "mode" "MessageMode" NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "patientMessageLimit" INTEGER,
  "patientMessageCount" INTEGER NOT NULL DEFAULT 0,
  "status" "ThreadStatus" NOT NULL DEFAULT 'INACTIVE',
  "readOnlyReason" "ReadOnlyReason",
  "closeReason" "CloseReason",
  "readOnlyAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "rulesSnapshotJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageThread_patientMessageCount_check" CHECK ("patientMessageCount" >= 0),
  CONSTRAINT "MessageThread_patientMessageLimit_check" CHECK ("patientMessageLimit" IS NULL OR "patientMessageLimit" > 0)
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "authorRole" "MessageAuthorRole" NOT NULL,
  "senderUserId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readByPatientAt" TIMESTAMP(3),
  "readByStaffAt" TIMESTAMP(3),
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessToken" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "offerId" TEXT,
  "requirementId" TEXT,
  "purpose" "TokenPurpose" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "actorType" "AuditActorType" NOT NULL,
  "actorUserId" TEXT,
  "applicationId" TEXT,
  "entityType" "AuditEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppSetting" (
  "key" TEXT NOT NULL,
  "valueJson" JSONB NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "ProductConfig_productCode_key" ON "ProductConfig"("productCode");
CREATE UNIQUE INDEX "ProductConfig_slug_key" ON "ProductConfig"("slug");
CREATE INDEX "Patient_email_idx" ON "Patient"("email");
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");
CREATE INDEX "Application_status_submittedAt_idx" ON "Application"("status", "submittedAt");
CREATE INDEX "Application_patientId_submittedAt_idx" ON "Application"("patientId", "submittedAt");
CREATE INDEX "Application_requestedProductCode_status_idx" ON "Application"("requestedProductCode", "status");
CREATE INDEX "Application_assignedProductCode_status_idx" ON "Application"("assignedProductCode", "status");
CREATE UNIQUE INDEX "ApplicationRedFlag_applicationId_key" ON "ApplicationRedFlag"("applicationId");
CREATE UNIQUE INDEX "LegalAcceptance_applicationId_key" ON "LegalAcceptance"("applicationId");
CREATE UNIQUE INDEX "ApplicationUpload_storageKey_key" ON "ApplicationUpload"("storageKey");
CREATE INDEX "ApplicationUpload_applicationId_category_idx" ON "ApplicationUpload"("applicationId", "category");
CREATE INDEX "ApplicationUpload_applicationId_status_idx" ON "ApplicationUpload"("applicationId", "status");
CREATE INDEX "ApplicationExternalLink_applicationId_kind_idx" ON "ApplicationExternalLink"("applicationId", "kind");
CREATE INDEX "ApplicationRequirement_applicationId_status_idx" ON "ApplicationRequirement"("applicationId", "status");
CREATE INDEX "ApplicationRequirement_type_status_idx" ON "ApplicationRequirement"("type", "status");
CREATE INDEX "Offer_applicationId_status_idx" ON "Offer"("applicationId", "status");
CREATE INDEX "Offer_expiresAt_status_idx" ON "Offer"("expiresAt", "status");
CREATE UNIQUE INDEX "CalendarSlot_bookedAppointmentId_key" ON "CalendarSlot"("bookedAppointmentId");
CREATE INDEX "CalendarSlot_status_startsAt_idx" ON "CalendarSlot"("status", "startsAt");
CREATE INDEX "CalendarSlot_holdExpiresAt_idx" ON "CalendarSlot"("holdExpiresAt");
CREATE INDEX "CalendarSlot_heldOfferId_idx" ON "CalendarSlot"("heldOfferId");
CREATE UNIQUE INDEX "Appointment_offerId_key" ON "Appointment"("offerId");
CREATE INDEX "Appointment_applicationId_startsAt_idx" ON "Appointment"("applicationId", "startsAt");
CREATE INDEX "Appointment_status_startsAt_idx" ON "Appointment"("status", "startsAt");
CREATE UNIQUE INDEX "Payment_externalPaymentId_key" ON "Payment"("externalPaymentId");
CREATE INDEX "Payment_applicationId_status_idx" ON "Payment"("applicationId", "status");
CREATE INDEX "Payment_status_paidAt_idx" ON "Payment"("status", "paidAt");
CREATE INDEX "Payment_offerId_status_idx" ON "Payment"("offerId", "status");
CREATE UNIQUE INDEX "MessageThread_applicationId_key" ON "MessageThread"("applicationId");
CREATE INDEX "MessageThread_status_endsAt_idx" ON "MessageThread"("status", "endsAt");
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");
CREATE INDEX "Message_senderUserId_idx" ON "Message"("senderUserId");
CREATE UNIQUE INDEX "AccessToken_tokenHash_key" ON "AccessToken"("tokenHash");
CREATE INDEX "AccessToken_purpose_expiresAt_idx" ON "AccessToken"("purpose", "expiresAt");
CREATE INDEX "AccessToken_applicationId_purpose_idx" ON "AccessToken"("applicationId", "purpose");
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEvent_applicationId_createdAt_idx" ON "AuditEvent"("applicationId", "createdAt");
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Application"
ADD CONSTRAINT "Application_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApplicationRedFlag"
ADD CONSTRAINT "ApplicationRedFlag_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegalAcceptance"
ADD CONSTRAINT "LegalAcceptance_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationUpload"
ADD CONSTRAINT "ApplicationUpload_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationExternalLink"
ADD CONSTRAINT "ApplicationExternalLink_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationRequirement"
ADD CONSTRAINT "ApplicationRequirement_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationRequirement"
ADD CONSTRAINT "ApplicationRequirement_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApplicationRequirement"
ADD CONSTRAINT "ApplicationRequirement_resolvedByUserId_fkey"
FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Offer"
ADD CONSTRAINT "Offer_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Offer"
ADD CONSTRAINT "Offer_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CalendarSlot"
ADD CONSTRAINT "CalendarSlot_heldOfferId_fkey"
FOREIGN KEY ("heldOfferId") REFERENCES "Offer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "Offer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CalendarSlot"
ADD CONSTRAINT "CalendarSlot_bookedAppointmentId_fkey"
FOREIGN KEY ("bookedAppointmentId") REFERENCES "Appointment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "Offer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MessageThread"
ADD CONSTRAINT "MessageThread_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
ADD CONSTRAINT "Message_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
ADD CONSTRAINT "Message_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccessToken"
ADD CONSTRAINT "AccessToken_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessToken"
ADD CONSTRAINT "AccessToken_offerId_fkey"
FOREIGN KEY ("offerId") REFERENCES "Offer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessToken"
ADD CONSTRAINT "AccessToken_requirementId_fkey"
FOREIGN KEY ("requirementId") REFERENCES "ApplicationRequirement"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
ADD CONSTRAINT "AuditEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
ADD CONSTRAINT "AuditEvent_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AppSetting"
ADD CONSTRAINT "AppSetting_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
