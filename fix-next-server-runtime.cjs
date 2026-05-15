const fs = require("node:fs");
const path = require("node:path");

const runtimePath = path.join(process.cwd(), ".next", "server", "webpack-runtime.js");
const vendorChunksDir = path.join(process.cwd(), ".next", "server", "vendor-chunks");
const nextVendorChunkPath = path.join(vendorChunksDir, "next.js");
const openTelemetryVendorChunkPath = path.join(vendorChunksDir, "@opentelemetry.js");

function patchWebpackRuntime() {
  if (!fs.existsSync(runtimePath)) {
    return;
  }

  const source = fs.readFileSync(runtimePath, "utf8");
  const needle = 'installChunk(require("./" + __webpack_require__.u(chunkId)));';

  if (!source.includes(needle)) {
    return;
  }

  const replacement = [
    "var chunkFile=__webpack_require__.u(chunkId);",
    'var chunkRequest=("string"==typeof chunkId&&chunkId.includes("/")?"./":"./chunks/")+chunkFile;',
    "installChunk(require(chunkRequest));",
  ].join("");

  fs.writeFileSync(runtimePath, source.replace(needle, replacement), "utf8");
}

function ensureOpenTelemetryVendorChunk() {
  if (!fs.existsSync(nextVendorChunkPath) || fs.existsSync(openTelemetryVendorChunkPath)) {
    return;
  }

  const wrapperSource = [
    '"use strict";',
    'const nextChunk = require("./next.js");',
    "module.exports = {",
    "  ...nextChunk,",
    '  id: "vendor-chunks/@opentelemetry",',
    '  ids: ["vendor-chunks/@opentelemetry"],',
    "};",
    "",
  ].join("\n");

  fs.writeFileSync(openTelemetryVendorChunkPath, wrapperSource, "utf8");
}

patchWebpackRuntime();
ensureOpenTelemetryVendorChunk();
