export const VIDEO_UPLOAD_POLICY = {
  allowedExtensions: ["mp4", "mov"] as const,
  maxVideosPerQuestionnaire: 3,
  maxDurationSeconds: 120,
  maxBytesPerVideo: 250 * 1024 * 1024,
  maxBytesTotal: 600 * 1024 * 1024
};
