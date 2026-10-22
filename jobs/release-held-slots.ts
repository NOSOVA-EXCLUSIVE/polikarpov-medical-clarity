import previewSafety from "../preview-safety/core.cjs";

previewSafety.assertPreviewAllowedOperation("jobs:release-held-slots");

export async function runReleaseHeldSlotsJob() {
  previewSafety.assertPreviewAllowedOperation("jobs:release-held-slots");
  // Implemented in Sprint 4.
}

void runReleaseHeldSlotsJob();
