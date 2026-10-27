-- Additive v2.1 tables only. No changes, copies or deletion of legacy rows.
CREATE TABLE "ManualCase" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "phase" TEXT NOT NULL DEFAULT 'REVIEW',
  "version" INTEGER NOT NULL DEFAULT 0,
  "currentAgreementId" TEXT,
  "callRequestedAt" TIMESTAMP(3),
  "callConfirmedAt" TIMESTAMP(3),
  "callCompletedAt" TIMESTAMP(3),
  "callStartsAt" TIMESTAMP(3),
  "callEndsAt" TIMESTAMP(3),
  "callTimezone" TEXT,
  "workStartedAt" TIMESTAMP(3),
  "workEndsAt" TIMESTAMP(3),
  "resultDeliveredAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "patientAccessEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualCase_phase_check" CHECK ("phase" IN ('REVIEW','CALL_REQUESTED','CALL_CONFIRMED','CALL_COMPLETED','OFFERED','ACCEPTED','PAID','ACTIVE','COMPLETED')),
  CONSTRAINT "ManualCase_call_interval_check" CHECK ("callEndsAt" IS NULL OR "callStartsAt" < "callEndsAt"),
  CONSTRAINT "ManualCase_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ManualCase_applicationId_key" ON "ManualCase"("applicationId");
CREATE UNIQUE INDEX "ManualCase_reference_key" ON "ManualCase"("reference");
CREATE UNIQUE INDEX "ManualCase_currentAgreementId_key" ON "ManualCase"("currentAgreementId");
CREATE INDEX "ManualCase_phase_createdAt_idx" ON "ManualCase"("phase","createdAt");

CREATE TABLE "ManualAgreement" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "serviceId" TEXT NOT NULL,
  "catalogVersion" TEXT NOT NULL DEFAULT '2.1',
  "title" TEXT NOT NULL,
  "scopeJson" JSONB NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "turnaround" TEXT NOT NULL,
  "policyJson" JSONB NOT NULL,
  "discountSourceCaseId" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualAgreement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualAgreement_amount_check" CHECK ("amountCents" > 0 AND "currency" = 'EUR'),
  CONSTRAINT "ManualAgreement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ManualCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualAgreement_discountSourceCaseId_fkey" FOREIGN KEY ("discountSourceCaseId") REFERENCES "ManualCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualAgreement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ManualAgreement_caseId_revision_key" ON "ManualAgreement"("caseId","revision");
CREATE INDEX "ManualAgreement_discountSourceCaseId_idx" ON "ManualAgreement"("discountSourceCaseId");
ALTER TABLE "ManualCase" ADD CONSTRAINT "ManualCase_currentAgreementId_fkey" FOREIGN KEY ("currentAgreementId") REFERENCES "ManualAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ManualReceipt" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "recordedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualReceipt_amount_check" CHECK ("amountCents" > 0 AND "currency" = 'EUR'),
  CONSTRAINT "ManualReceipt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ManualCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualReceipt_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "ManualAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualReceipt_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ManualReceipt_agreementId_key" ON "ManualReceipt"("agreementId");

CREATE TABLE "ManualContact" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ManualContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualContact_status_check" CHECK ("status" IN ('OPEN','ANSWERED')),
  CONSTRAINT "ManualContact_ordinal_check" CHECK ("ordinal" BETWEEN 1 AND 8),
  CONSTRAINT "ManualContact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ManualCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ManualContact_caseId_ordinal_key" ON "ManualContact"("caseId","ordinal");
-- Quota reservation is atomic even if two sessions submit the same block concurrently.
CREATE UNIQUE INDEX "ManualContact_one_open_per_case" ON "ManualContact"("caseId") WHERE "status" = 'OPEN';

CREATE TABLE "ManualMessage" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "contactId" TEXT,
  "authorRole" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'MESSAGE',
  "body" TEXT NOT NULL,
  "senderUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualMessage_role_check" CHECK ("authorRole" IN ('PATIENT','DOCTOR','ADMIN','SYSTEM')),
  CONSTRAINT "ManualMessage_kind_check" CHECK ("kind" IN ('MESSAGE','OPENING','REPLY','RESULT')),
  CONSTRAINT "ManualMessage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ManualCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ManualContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ManualMessage_caseId_createdAt_idx" ON "ManualMessage"("caseId","createdAt");

CREATE TABLE "ManualGrant" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualGrant_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ManualCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ManualGrant_tokenHash_key" ON "ManualGrant"("tokenHash");
CREATE INDEX "ManualGrant_caseId_expiresAt_idx" ON "ManualGrant"("caseId","expiresAt");

CREATE TABLE "ManualDeliverable" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "markedInFile" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "verifiedEtag" TEXT,
  CONSTRAINT "ManualDeliverable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManualDeliverable_size_check" CHECK ("sizeBytes" > 0),
  CONSTRAINT "ManualDeliverable_status_check" CHECK ("status" IN ('PENDING','READY')),
  CONSTRAINT "ManualDeliverable_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ManualCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ManualDeliverable_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ManualDeliverable_storageKey_key" ON "ManualDeliverable"("storageKey");
CREATE INDEX "ManualDeliverable_caseId_createdAt_idx" ON "ManualDeliverable"("caseId","createdAt");
CREATE INDEX "ManualDeliverable_caseId_status_idx" ON "ManualDeliverable"("caseId","status");
