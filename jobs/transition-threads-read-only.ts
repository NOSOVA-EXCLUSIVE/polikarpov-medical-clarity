import previewSafety from "../preview-safety/core.cjs";

previewSafety.assertPreviewAllowedOperation("jobs:transition-threads-read-only");

export async function runTransitionThreadsReadOnlyJob() {
  previewSafety.assertPreviewAllowedOperation("jobs:transition-threads-read-only");
  // Implemented in Sprint 5.
}

void runTransitionThreadsReadOnlyJob();
