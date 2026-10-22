import previewSafety from "../preview-safety/core.cjs";

previewSafety.assertPreviewAllowedOperation("jobs:cleanup-abandoned-uploads");

export async function runCleanupAbandonedUploadsJob() {
  previewSafety.assertPreviewAllowedOperation("jobs:cleanup-abandoned-uploads");
  // Implemented in Sprint 2.
}

void runCleanupAbandonedUploadsJob();
