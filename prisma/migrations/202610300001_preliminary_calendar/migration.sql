-- Additive calendar only. Existing offers, payments, appointments and slots are retained.
BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(1296251221, 20261030);

CREATE TYPE "PreliminarySlotStatus" AS ENUM ('AVAILABLE', 'PENDING', 'CONFIRMED', 'BLOCKED');

CREATE TABLE "PreliminarySlot" (
  "id" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "status" "PreliminarySlotStatus" NOT NULL DEFAULT 'AVAILABLE',
  "caseId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreliminarySlot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PreliminarySlot_interval_check" CHECK ("startsAt" < "endsAt"),
  CONSTRAINT "PreliminarySlot_owner_check" CHECK (
    ("status" IN ('PENDING', 'CONFIRMED') AND "caseId" IS NOT NULL) OR
    ("status" IN ('AVAILABLE', 'BLOCKED') AND "caseId" IS NULL)
  ),
  CONSTRAINT "PreliminarySlot_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ManualCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PreliminarySlot_no_overlap" EXCLUDE USING gist (tsrange("startsAt", "endsAt", '[)') WITH &&)
);

CREATE UNIQUE INDEX "PreliminarySlot_caseId_key" ON "PreliminarySlot"("caseId");
CREATE INDEX "PreliminarySlot_status_startsAt_idx" ON "PreliminarySlot"("status", "startsAt");

COMMIT;
