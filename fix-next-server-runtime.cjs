const fs = require("node:fs");
const path = require("node:path");

const runtimePath = path.join(process.cwd(), ".next", "server", "webpack-runtime.js");

if (!fs.existsSync(runtimePath)) {
  process.exit(0);
}

const source = fs.readFileSync(runtimePath, "utf8");
const needle = 'installChunk(require("./" + __webpack_require__.u(chunkId)));';

if (!source.includes(needle)) {
  process.exit(0);
}

const replacement = [
  'var chunkFile=__webpack_require__.u(chunkId);',
  'var chunkRequest=("string"==typeof chunkId&&chunkId.includes("/")?"./":"./chunks/")+chunkFile;',
  "installChunk(require(chunkRequest));",
].join("");

fs.writeFileSync(runtimePath, source.replace(needle, replacement), "utf8");
