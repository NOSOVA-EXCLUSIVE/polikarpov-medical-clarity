"use strict";

// Only the already pinned Vercel Preview may run these synthetic regressions.
// Other environments retain the existing build path without spawning a process.
if (process.env.VERCEL_ENV === "preview") {
  const { assertPreviewIsolation } = require("./core.cjs");
  assertPreviewIsolation();

  const { spawnSync } = require("node:child_process");
  const path = require("node:path");
  const root = path.resolve(__dirname, "..");
  const testFiles = [
    "tests/questionnaire-patient-isolation.test.cjs",
    "tests/private-object-metadata.test.cjs",
    "tests/materials-upload-boundaries.test.cjs",
    "tests/intake-notifications.test.cjs",
    "tests/calendar-reservations.test.cjs"
  ];

  // No inherited credentials, database/storage configuration, NODE_OPTIONS,
  // cookies, email settings or application environment reach the test process.
  // These tests load source through explicit mocked boundaries only.
  const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...testFiles], {
    cwd: root,
    env: { NODE_ENV: "test", TZ: "UTC" },
    stdio: ["ignore", "inherit", "inherit"],
    shell: false,
    timeout: 60000,
    killSignal: "SIGKILL"
  });

  if (result.error || result.signal || result.status !== 0) {
    // Avoid printing process options or any enclosing build configuration.
    console.error("Preview release regressions failed or exceeded their 60-second limit.");
    process.exitCode = 1;
  } else {
    console.log(`Preview release regressions passed (${testFiles.length} explicit synthetic test files).`);
  }
}
