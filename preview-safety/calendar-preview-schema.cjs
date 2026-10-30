"use strict";

// Executed only by the pinned synthetic Vercel Preview build, never locally or in production.
// Unmanaged synthetic fixtures require a separate explicit owner decision; never repair their ledger.
// Owner explicitly approved this exact synthetic-only DDL path on 30 October 2026.
const ALLOW_UNMANAGED_SYNTHETIC_CALENDAR = true;
if (process.env.VERCEL_ENV === "preview") {
  const { assertPreviewIsolation } = require("./core.cjs");
  assertPreviewIsolation();
  const fs = require("node:fs");
  const path = require("node:path");
  const { createHash } = require("node:crypto");
  const { spawnSync } = require("node:child_process");
  const { PrismaClient } = require("@prisma/client");
  const root = path.resolve(__dirname, "..");
  const names = ["202604090001_initial", "202610270001_manual_v21_additive", "202610300001_preliminary_calendar"];
  const reviewedChecksums = ["359ca56de004c6722ef23740654bac2483325b30a0987aadeca144ef16b32489",
    "38588ed2aed9cacd7918ef950d672aa6bda0a086f5e06e62c0d049700704e125",
    "8e8eddbd2a08ce9410a0f37cf91a17f460208a8d8e11aeabdfa4f1aeab848b41"];
  const checksums = new Map(names.map(name => [name, createHash("sha256")
    .update(fs.readFileSync(path.join(root, "prisma/migrations", name, "migration.sql"), "utf8").replace(/\r\n/g, "\n")).digest("hex")]));
  const baselineTables = names.slice(0, 2).flatMap(name => [...fs.readFileSync(path.join(root, "prisma/migrations", name, "migration.sql"), "utf8")
    .matchAll(/CREATE TABLE "([^"]+)"/g)].map(match => match[1])).sort();
  const client = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } }, log: [] });
  let phase = "source-check";
  const stop = () => { throw new Error("CALENDAR_PREVIEW_SCHEMA_CHECK_FAILED"); };

  async function state() {
    phase = "read-catalog";
    const tables = await client.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`;
    const tableNames = tables.map(row => row.table_name).sort();
    const physical = { total: tableNames.length, manual: tableNames.filter(name => name.startsWith("Manual")).length,
      preliminary: tableNames.includes("PreliminarySlot") ? 1 : 0 };
    const ledger = await client.$queryRaw`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`;
    const enumState = await client.$queryRaw`SELECT count(*)::int AS total FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='PreliminarySlotStatus'`;
    console.log("CALENDAR_PREVIEW_CATALOG " + JSON.stringify({ publicTables: physical.total,
      manualTables: physical.manual, preliminaryTables: physical.preliminary, migrationLedgerPresent: ledger[0].present }));
    if ((physical.preliminary === 0 && enumState[0].total !== 0) || (physical.preliminary === 1 && enumState[0].total !== 1)) stop();
    if (!ledger[0].present) return { history: [], physical, tableNames, ledgerPresent: false, knownHistory: false, applied: new Set() };
    phase = "read-history";
    const history = await client.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name`;
    const knownHistory = history.every(row => names.includes(row.migration_name) && row.finished_at && !row.rolled_back_at && row.checksum === checksums.get(row.migration_name))
      && new Set(history.map(row => row.migration_name)).size === history.length;
    const applied = new Set(history.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name));
    return { history, physical, tableNames, ledgerPresent: true, knownHistory, applied };
  }
  async function preservationCounts() {
    const rows = await client.$queryRaw`SELECT (SELECT count(*)::text FROM "Application") AS applications, (SELECT count(*)::text FROM "Patient") AS patients, (SELECT count(*)::text FROM "ApplicationUpload") AS uploads, (SELECT count(*)::text FROM "CalendarSlot") AS legacy_slots, (SELECT count(*)::text FROM "Appointment") AS appointments, (SELECT count(*)::text FROM "Offer") AS offers, (SELECT count(*)::text FROM "Payment") AS payments, (SELECT count(*)::text FROM "ManualCase") AS manual_cases, (SELECT count(*)::text FROM "ManualAgreement") AS agreements, (SELECT count(*)::text FROM "ManualGrant") AS grants`;
    return JSON.stringify(rows[0]);
  }
  async function validateCalendarShape() {
    phase = "validate-calendar-definition";
    const columns = await client.$queryRaw`SELECT column_name, udt_name, is_nullable, datetime_precision, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='PreliminarySlot' ORDER BY column_name`;
    const expectedColumns = [["id","text","NO"],["startsAt","timestamp","NO"],["endsAt","timestamp","NO"],["timezone","text","NO"],
      ["status","PreliminarySlotStatus","NO"],["caseId","text","YES"],["createdAt","timestamp","NO"],["updatedAt","timestamp","NO"]].sort((a,b) => a[0].localeCompare(b[0]));
    const actualColumns = columns.map(row => [row.column_name, row.udt_name, row.is_nullable]).sort((a,b) => a[0].localeCompare(b[0]));
    if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) stop();
    const labels = await client.$queryRaw`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='PreliminarySlotStatus' ORDER BY e.enumsortorder`;
    if (JSON.stringify(labels.map(row => row.enumlabel)) !== JSON.stringify(["AVAILABLE","PENDING","CONFIRMED","BLOCKED"])) stop();
    const constraints = await client.$queryRaw`SELECT conname, contype, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public."PreliminarySlot"'::regclass ORDER BY conname`;
    const normalize = value => {
      const literals = [];
      return value.replace(/'(?:''|[^'])*'/g, literal => { literals.push(literal); return `__literal_${literals.length - 1}__`; })
        .replace(/::(?:public\.)?"?PreliminarySlotStatus"?/g, "").replace(/::text/g, "").replace(/\bpublic\./g, "")
        .replace(/[\s"()\[\]]/g, "").toLowerCase()
        .replace(/__literal_(\d+)__/g, (_, index) => literals[Number(index)].toLowerCase());
    };
    const expectedDefaults = { id: null, startsAt: null, endsAt: null, timezone: null, status: "'AVAILABLE'::\"PreliminarySlotStatus\"",
      caseId: null, createdAt: "CURRENT_TIMESTAMP", updatedAt: null };
    if (columns.some(row => (row.udt_name === "timestamp" && row.datetime_precision !== 3)
      || (row.column_default === null ? null : normalize(row.column_default)) !==
        (expectedDefaults[row.column_name] === null ? null : normalize(expectedDefaults[row.column_name])))) stop();
    const definitions = new Map(constraints.map(row => [row.conname, normalize(row.definition)]));
    const expectedDefinitions = new Map([
      ["PreliminarySlot_pkey", normalize('PRIMARY KEY ("id")')],
      ["PreliminarySlot_interval_check", normalize('CHECK ("startsAt" < "endsAt")')],
      ["PreliminarySlot_owner_check", normalize("CHECK (((status = ANY (ARRAY['PENDING', 'CONFIRMED'])) AND (\"caseId\" IS NOT NULL)) OR ((status = ANY (ARRAY['AVAILABLE', 'BLOCKED'])) AND (\"caseId\" IS NULL)))")],
      ["PreliminarySlot_caseId_fkey", normalize('FOREIGN KEY ("caseId") REFERENCES "ManualCase"(id) ON UPDATE CASCADE ON DELETE RESTRICT')],
      ["PreliminarySlot_no_overlap", normalize("EXCLUDE USING gist (tsrange(\"startsAt\", \"endsAt\", '[)'::text) WITH &&)")]
    ]);
    if (definitions.size !== expectedDefinitions.size || [...expectedDefinitions].some(([name, definition]) => definitions.get(name) !== definition)) stop();
    const indexes = await client.$queryRaw`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='PreliminarySlot' ORDER BY indexname`;
    if (indexes.length !== 4 || !indexes.some(row => row.indexname === "PreliminarySlot_caseId_key"
      && normalize(row.indexdef) === normalize('CREATE UNIQUE INDEX "PreliminarySlot_caseId_key" ON public."PreliminarySlot" USING btree ("caseId")'))
      || !indexes.some(row => row.indexname === "PreliminarySlot_status_startsAt_idx"
      && normalize(row.indexdef) === normalize('CREATE INDEX "PreliminarySlot_status_startsAt_idx" ON public."PreliminarySlot" USING btree (status, "startsAt")'))) stop();
  }
  async function main() {
    if (require("prisma/package.json").version !== "6.19.3") stop();
    const directories = fs.readdirSync(path.join(root, "prisma/migrations"), { withFileTypes: true })
      .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    if (JSON.stringify(directories) !== JSON.stringify([...names].sort())) stop();
    if (names.some((name, index) => checksums.get(name) !== reviewedChecksums[index])) stop();
    if (baselineTables.length !== 25 || new Set(baselineTables).size !== 25) stop();
    const before = await state();
    console.log("CALENDAR_PREVIEW_SCHEMA_STATE " + JSON.stringify({
      knownHistory: before.knownHistory, completedMigrations: before.applied.size,
      initialApplied: before.applied.has(names[0]), manualApplied: before.applied.has(names[1]),
      calendarApplied: before.applied.has(names[2]), publicTables: before.physical.total,
      manualTables: before.physical.manual, preliminaryTables: before.physical.preliminary
    }));
    const unmanaged = !before.ledgerPresent;
    const alreadyApplied = unmanaged ? before.physical.preliminary === 1 : before.applied.has(names[2]);
    const expectedBeforeTables = [...baselineTables, ...(unmanaged ? [] : ["_prisma_migrations"]), ...(alreadyApplied ? ["PreliminarySlot"] : [])].sort();
    if (JSON.stringify(before.tableNames) !== JSON.stringify(expectedBeforeTables) || before.physical.manual !== 7) stop();
    if (unmanaged) {
      if (!ALLOW_UNMANAGED_SYNTHETIC_CALENDAR) { console.error("CALENDAR_PREVIEW_UNMANAGED_APPROVAL_REQUIRED"); stop(); }
    } else if (!before.knownHistory || !before.applied.has(names[0]) || !before.applied.has(names[1])
      || before.applied.size !== (alreadyApplied ? 3 : 2) || before.physical.preliminary !== (alreadyApplied ? 1 : 0)) stop();
    if (alreadyApplied) await validateCalendarShape();
    const preserved = await preservationCounts();
    if (!alreadyApplied) {
      phase = "apply-calendar";
      await client.$disconnect();
      const minimalEnv = { DATABASE_URL: process.env.DIRECT_URL, DIRECT_URL: process.env.DIRECT_URL,
        PRISMA_HIDE_UPDATE_MESSAGE: "1", CHECKPOINT_DISABLE: "1" };
      for (const key of ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "SSL_CERT_FILE", "SSL_CERT_DIR"]) {
        if (process.env[key]) minimalEnv[key] = process.env[key];
      }
      const command = unmanaged
        ? ["db", "execute", "--file", path.join(root, "prisma/migrations", names[2], "migration.sql"), "--schema", path.join(root, "prisma/schema.prisma")]
        : ["migrate", "deploy"];
      const migration = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), ...command], {
        cwd: root, env: minimalEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        timeout: 120000, shell: false, maxBuffer: 1024 * 1024
      });
      // Never export raw CLI output: it may include database connection context.
      if (migration.error || migration.signal || migration.status !== 0) {
        console.error("CALENDAR_PREVIEW_MIGRATION_NOT_CONFIRMED"); stop();
      }
    }
    const after = await state();
    const expectedAfterTables = [...baselineTables, ...(unmanaged ? [] : ["_prisma_migrations"]), "PreliminarySlot"].sort();
    if (JSON.stringify(after.tableNames) !== JSON.stringify(expectedAfterTables) || after.ledgerPresent !== before.ledgerPresent
      || (!unmanaged && (!after.knownHistory || after.applied.size !== 3 || !after.applied.has(names[2])))
      || after.physical.manual !== 7 || after.physical.preliminary !== 1 || preserved !== await preservationCounts()) stop();
    await validateCalendarShape();
    console.log("CALENDAR_PREVIEW_SCHEMA_VERIFIED " + JSON.stringify({ calendarTableReady: true, mode: unmanaged ? "approved-synthetic-ddl-without-ledger" : "prisma-migrate-deploy", existingRecordCountsUnchanged: true, productionTouched: false }));
  }
  main().catch(error => {
    const code = typeof error?.code === "string" && /^(P\d{4}|ENOENT)$/.test(error.code) ? error.code : "CHECK_STOP";
    const sqlState = typeof error?.meta?.code === "string" && /^[0-9A-Z]{5}$/.test(error.meta.code) ? error.meta.code : undefined;
    console.error("CALENDAR_PREVIEW_SCHEMA_DIAGNOSTIC " + JSON.stringify({ phase, code, ...(sqlState ? { sqlState } : {}) }));
    console.error("CALENDAR_PREVIEW_SCHEMA_CHECK_FAILED; publication stopped; no automatic retry or ledger repair."); process.exitCode = 1;
  })
    .finally(() => client.$disconnect());
}
