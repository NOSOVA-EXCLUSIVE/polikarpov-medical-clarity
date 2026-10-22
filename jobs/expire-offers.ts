import previewSafety from "../preview-safety/core.cjs";

previewSafety.assertPreviewAllowedOperation("jobs:expire-offers");

export async function runExpireOffersJob() {
  previewSafety.assertPreviewAllowedOperation("jobs:expire-offers");
  // Implemented in Sprint 4.
}

void runExpireOffersJob();
