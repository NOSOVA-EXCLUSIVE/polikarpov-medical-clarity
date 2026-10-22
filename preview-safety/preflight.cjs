"use strict";

// Read-only preflight; no SDK, child processes, configuration loading, or network.
const { assertPreviewIsolation, assertPreviewAllowedOperation } = require("./core.cjs");

const operation = process.argv[2] || "build";
const context = assertPreviewIsolation();
assertPreviewAllowedOperation(operation);
console.log(context ? "Preview safety preflight passed (pinned test resources)." : "Production path unchanged; Preview opt-in absent.");
