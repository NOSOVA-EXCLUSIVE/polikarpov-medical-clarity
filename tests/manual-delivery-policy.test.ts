import assert from "node:assert/strict";
import { MANUAL_DELIVERY_MAX_BYTES, MANUAL_DIRECT_DELIVERY_MAX_BYTES, parseManualRange, validateManualFile,
  validateManualFileMetadata, validateManualFilePrefix } from "../src/features/manual-v21/delivery-policy";

validateManualFile(Buffer.from("%PDF-1.7\nsynthetic\n"), "application/pdf");
validateManualFile(Buffer.from([137,80,78,71,13,10,26,10,0]), "image/png");
validateManualFile(Buffer.from([255,216,255,0]), "image/jpeg");
validateManualFile(Buffer.from([0,0,0,20,102,116,121,112,105,115,111,109]), "video/mp4");
for (const mime of ["text/html", "image/svg+xml", "application/javascript", "application/zip"]) {
  assert.throws(() => validateManualFile(Buffer.from("synthetic"), mime));
}
assert.throws(() => validateManualFile(Buffer.from("<html>"), "application/pdf"));
assert.throws(() => validateManualFile(new Uint8Array(), "image/png"));
assert.throws(() => validateManualFile(new Uint8Array(MANUAL_DELIVERY_MAX_BYTES + 1), "image/png"));
validateManualFileMetadata(MANUAL_DIRECT_DELIVERY_MAX_BYTES, "video/mp4");
assert.throws(() => validateManualFileMetadata(MANUAL_DIRECT_DELIVERY_MAX_BYTES + 1, "video/mp4"));
assert.throws(() => validateManualFileMetadata(0, "video/mp4"));
assert.throws(() => validateManualFileMetadata(1.5, "image/png"));
assert.throws(() => validateManualFileMetadata(100, "image/svg+xml"));
validateManualFilePrefix(Buffer.from([0,0,0,20,102,116,121,112,105,115,111,109]), "video/mp4");
assert.throws(() => validateManualFilePrefix(Buffer.from("<script>"), "video/mp4"));
assert.deepEqual(parseManualRange("bytes=0-3", 10), { start: 0, end: 3 });
assert.deepEqual(parseManualRange("bytes=7-", 10), { start: 7, end: 9 });
assert.deepEqual(parseManualRange("bytes=7-100", 10), { start: 7, end: 9 });
assert.equal(parseManualRange(null, 10), null);
for (const range of ["bytes=10-", "bytes=5-2", "bytes=-1", "bytes=0-1,3-4", "items=0-1", "bytes=9999999999999-"]) {
  assert.throws(() => parseManualRange(range, 10));
}
console.log("manual delivery policy: PASS (signature/type/size/active-content and byte-range cases)");
