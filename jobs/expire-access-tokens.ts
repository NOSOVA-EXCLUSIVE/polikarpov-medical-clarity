import previewSafety from "../preview-safety/core.cjs";

previewSafety.assertPreviewAllowedOperation("jobs:expire-access-tokens");

export async function runExpireAccessTokensJob() {
  previewSafety.assertPreviewAllowedOperation("jobs:expire-access-tokens");
  // Implemented in Sprint 5.
}

void runExpireAccessTokensJob();
