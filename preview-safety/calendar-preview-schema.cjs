"use strict";

// Executed only by the pinned synthetic Vercel Preview build, never locally or in production.
// Apply the normal Prisma migration chain only after verifying its existing history and schema.
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
  const checksums = new Map(names.map(name => [name, createHash("sha256")
    .update(fs.readFileSync(path.join(root, "prisma/migrations", name, "migration.sql"), "utf8").replace(/\r\n/g, "\n")).digest("hex")]));
  const client = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } }, log: [] });
  const stop = () => { throw new Error("CALENDAR_PREVIEW_SCHEMA_CHECK_FAILED"); };

  async function state() {
    const history = await client.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name`;
    const physical = await client.$queryRaw`SELECT count(*)::int AS total, count(*) FILTER (WHERE table_name LIKE 'Manual%')::int AS manual, count(*) FILTER (WHERE table_name = 'PreliminarySlot')::int AS preliminary FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
    const knownHistory = history.every(row => names.includes(row.migration_name) && row.finished_at && !row.rolled_back_at && row.checksum === checksums.get(row.migration_name))
      && new Set(history.map(row => row.migration_name)).size === history.length;
    const applied = new Set(history.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name));
    return { history, physical: physical[0], knownHistory, applied };
  }
  async function preservationCounts() {
    const rows = await client.$queryRaw`SELECT (SELECT count(*)::text FROM "Application") AS applications, (SELECT count(*)::text FROM "Patient") AS patients, (SELECT count(*)::text FROM "ApplicationUpload") AS uploads, (SELECT count(*)::text FROM "CalendarSlot") AS legacy_slots, (SELECT count(*)::text FROM "Appointment") AS appointments, (SELECT count(*)::text FROM "Offer") AS offers, (SELECT count(*)::text FROM "Payment") AS payments, (SELECT count(*)::text FROM "ManualCase") AS manual_cases, (SELECT count(*)::text FROM "ManualAgreement") AS agreements, (SELECT count(*)::text FROM "ManualGrant") AS grants`;
    return JSON.stringify(rows[0]);
  }
  async function main() {
    if (require("prisma/package.json").version !== "6.19.3") stop();
    const directories = fs.readdirSync(path.join(root, "prisma/migrations"), { withFileTypes: true })
      .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    if (JSON.stringify(directories) !== JSON.stringify([...names].sort())) stop();
    const before = await state();
    console.log("CALENDAR_PREVIEW_SCHEMA_STATE " + JSON.stringify({
      knownHistory: before.knownHistory, completedMigrations: before.applied.size,
      initialApplied: before.applied.has(names[0]), manualApplied: before.applied.has(names[1]),
      calendarApplied: before.applied.has(names[2]), publicTables: before.physical.total,
      manualTables: before.physical.manual, preliminaryTables: before.physical.preliminary
    }));
    const alreadyApplied = before.applied.has(names[2]);
    if (!before.knownHistory || !before.applied.has(names[0]) || !before.applied.has(names[1])
      || before.applied.size !== (alreadyApplied ? 3 : 2) || before.physical.manual !== 7
      || before.physical.total !== (alreadyApplied ? 27 : 26) || before.physical.preliminary !== (alreadyApplied ? 1 : 0)) stop();
    const preserved = await preservationCounts();
    if (!alreadyApplied) {
      await client.$disconnect();
      const minimalEnv = { DATABASE_URL: process.env.DIRECT_URL, DIRECT_URL: process.env.DIRECT_URL,
        PRISMA_HIDE_UPDATE_MESSAGE: "1", CHECKPOINT_DISABLE: "1" };
      for (const key of ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "SSL_CERT_FILE", "SSL_CERT_DIR"]) {
        if (process.env[key]) minimalEnv[key] = process.env[key];
      }
      const migration = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
        cwd: root, env: minimalEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        timeout: 120000, shell: false, maxBuffer: 1024 * 1024
      });
      // Never export raw CLI output: it may include database connection context.
      if (migration.error || migration.signal || migration.status !== 0) {
        console.error("CALENDAR_PREVIEW_MIGRATION_NOT_CONFIRMED"); stop();
      }
    }
    const after = await state();
    if (!after.knownHistory || after.applied.size !== 3 || !after.applied.has(names[2])
      || after.physical.total !== 27 || after.physical.manual !== 7 || after.physical.preliminary !== 1
      || preserved !== await preservationCounts()) stop();
    console.log("CALENDAR_PREVIEW_SCHEMA_VERIFIED " + JSON.stringify({ migrationApplied: true, existingRecordCountsUnchanged: true, productionTouched: false }));
  }
  main().catch(() => { console.error("CALENDAR_PREVIEW_SCHEMA_CHECK_FAILED; publication stopped; no automatic retry or ledger repair."); process.exitCode = 1; })
    .finally(() => client.$disconnect());
}
