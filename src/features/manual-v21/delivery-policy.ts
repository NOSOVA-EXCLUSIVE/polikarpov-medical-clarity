export const MANUAL_DELIVERY_MAX_BYTES = 3 * 1024 * 1024;
export const MANUAL_DIRECT_DELIVERY_MAX_BYTES = 250 * 1024 * 1024;
export const MANUAL_DELIVERY_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "video/mp4"]);

function fail(message: string, status = 400): never { throw Object.assign(new Error(message), { status }); }

export function validateManualFile(bytes: Uint8Array, mimeType: string) {
  if (!bytes.length || bytes.length > MANUAL_DELIVERY_MAX_BYTES) fail("Размер файла: от 1 байта до 3 МиБ.", 413);
  validateManualFilePrefix(bytes, mimeType);
}

export function validateManualFileMetadata(sizeBytes: number, mimeType: string) {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MANUAL_DIRECT_DELIVERY_MAX_BYTES) {
    fail("Размер файла: от 1 байта до 250 МиБ.", 413);
  }
  if (!MANUAL_DELIVERY_TYPES.has(mimeType)) fail("Допустимы PDF, PNG, JPEG и MP4.", 415);
}

export function validateManualFilePrefix(bytes: Uint8Array, mimeType: string) {
  if (!MANUAL_DELIVERY_TYPES.has(mimeType)) fail("Допустимы PDF, PNG, JPEG и MP4.", 415);
  const ascii = (start: number, end: number) => Buffer.from(bytes.subarray(start, end)).toString("ascii");
  const valid = mimeType === "application/pdf" ? ascii(0, 5) === "%PDF-" :
    mimeType === "image/png" ? Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    mimeType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
    bytes.length >= 12 && ascii(4, 8) === "ftyp";
  if (!valid) fail("Тип и содержимое файла не совпадают.", 415);
}

export function parseManualRange(value: string | null, size: number): { start: number; end: number } | null {
  if (!value) return null;
  const match = /^bytes=(\d{1,12})-(\d{0,12})$/.exec(value);
  if (!match) fail("Недопустимый диапазон файла.", 416);
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || start < 0 || start >= size || end < start) fail("Диапазон за пределами файла.", 416);
  return { start, end };
}
