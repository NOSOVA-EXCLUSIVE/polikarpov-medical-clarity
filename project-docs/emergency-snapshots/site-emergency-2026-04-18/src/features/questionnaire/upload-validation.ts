import { VIDEO_UPLOAD_POLICY } from "@/features/uploads/policies";
import type {
  CompleteUploadInput,
  PresignUploadInput,
  UploadDescriptorInput
} from "@/features/questionnaire/schemas";

const DOCUMENT_EXTENSIONS = ["pdf", "zip"] as const;
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "heic"] as const;

export function getNormalizedExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() ?? "" : "";
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertUploadType(input: {
  category: "DOCUMENT" | "IMAGE" | "VIDEO";
  extension: string;
}) {
  const extension = input.extension.toLowerCase();

  if (input.category === "DOCUMENT") {
    assert(
      DOCUMENT_EXTENSIONS.includes(extension as (typeof DOCUMENT_EXTENSIONS)[number]),
      "Документы можно загружать только в форматах PDF или ZIP."
    );
  }

  if (input.category === "IMAGE") {
    assert(
      IMAGE_EXTENSIONS.includes(extension as (typeof IMAGE_EXTENSIONS)[number]),
      "Изображения можно загружать только в форматах JPG, PNG или HEIC."
    );
  }

  if (input.category === "VIDEO") {
    assert(
      VIDEO_UPLOAD_POLICY.allowedExtensions.includes(
        extension as (typeof VIDEO_UPLOAD_POLICY.allowedExtensions)[number]
      ),
      "Видео можно загружать только в форматах MP4 или MOV."
    );
  }
}

export function validatePresignUpload(input: PresignUploadInput) {
  const extension = getNormalizedExtension(input.filename);

  assert(extension.length > 0, "Не удалось определить формат файла.");
  assertUploadType({
    category: input.category,
    extension
  });

  if (input.category === "VIDEO") {
    assert(
      input.sizeBytes <= VIDEO_UPLOAD_POLICY.maxBytesPerVideo,
      "Размер одного загружаемого видео не должен превышать 250 МБ."
    );
    assert(
      typeof input.durationSeconds === "number" &&
        input.durationSeconds <= VIDEO_UPLOAD_POLICY.maxDurationSeconds,
      "Длительность одного загружаемого видео не должна превышать 120 секунд."
    );
  }

  return {
    extension
  };
}

export function validateCompletedUpload(input: CompleteUploadInput) {
  assertUploadType({
    category: input.category,
    extension: input.extension
  });

  if (input.category === "VIDEO") {
    assert(
      input.sizeBytes <= VIDEO_UPLOAD_POLICY.maxBytesPerVideo,
      "Размер одного загружаемого видео не должен превышать 250 МБ."
    );
    assert(
      typeof input.durationSeconds === "number" &&
        input.durationSeconds <= VIDEO_UPLOAD_POLICY.maxDurationSeconds,
      "Длительность одного загружаемого видео не должна превышать 120 секунд."
    );
  }
}

export function validateQuestionnaireUploads(uploads: UploadDescriptorInput[]) {
  const videoUploads = uploads.filter((upload) => upload.category === "VIDEO");
  const totalVideoBytes = videoUploads.reduce(
    (sum, upload) => sum + upload.sizeBytes,
    0
  );

  assert(
    videoUploads.length <= VIDEO_UPLOAD_POLICY.maxVideosPerQuestionnaire,
    `В одной анкете можно загрузить не больше ${VIDEO_UPLOAD_POLICY.maxVideosPerQuestionnaire} видео.`
  );
  assert(
    totalVideoBytes <= VIDEO_UPLOAD_POLICY.maxBytesTotal,
    "Суммарный размер загруженных видео превышает допустимый лимит для анкеты."
  );

  uploads.forEach((upload) => validateCompletedUpload(upload));
}
