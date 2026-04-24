import type {
  ApplicationStatus,
  ExternalLinkKind,
  ImagingSourceType
} from "@prisma/client";

type UploadLike = {
  extension?: string | null;
  accessPassword?: string | null;
  accessInstructions?: string | null;
};

type ExternalLinkLike = {
  kind?: ExternalLinkKind | null;
  accessPassword?: string | null;
  accessInstructions?: string | null;
};

type RedFlagLike = {
  hasFever?: boolean | null;
  hasAcuteSwelling?: boolean | null;
  unableToBearWeight?: boolean | null;
  hasNumbness?: boolean | null;
  hasWeakness?: boolean | null;
  hasBladderOrBowelSymptoms?: boolean | null;
  hasChestPain?: boolean | null;
  hasShortnessOfBreath?: boolean | null;
  hasConfusion?: boolean | null;
};

export function hasBlockingRedFlags(redFlags: RedFlagLike) {
  return Boolean(
    redFlags.hasFever ||
      redFlags.hasAcuteSwelling ||
      redFlags.unableToBearWeight ||
      redFlags.hasNumbness ||
      redFlags.hasWeakness ||
      redFlags.hasBladderOrBowelSymptoms ||
      redFlags.hasChestPain ||
      redFlags.hasShortnessOfBreath ||
      redFlags.hasConfusion
  );
}

export function classifyImagingSourceType(input: {
  uploads: UploadLike[];
  externalLinks: ExternalLinkLike[];
}): ImagingSourceType | null {
  const hasUploads = input.uploads.length > 0;
  const hasExternalLinks = input.externalLinks.length > 0;

  if (hasUploads && hasExternalLinks) {
    return "MIXED";
  }

  if (hasUploads) {
    return "UPLOADED";
  }

  if (hasExternalLinks) {
    return "EXTERNAL_LINK_ONLY";
  }

  return null;
}

function hasAccessDetails(item: {
  accessPassword?: string | null;
  accessInstructions?: string | null;
}) {
  return Boolean(item.accessPassword?.trim() || item.accessInstructions?.trim());
}

export function requiresImagingAccess(input: {
  uploads: UploadLike[];
  externalLinks: ExternalLinkLike[];
}) {
  const hasProtectedArchiveWithoutAccess = input.uploads.some((upload) => {
    if ((upload.extension ?? "").toLowerCase() !== "zip") {
      return false;
    }

    return !hasAccessDetails(upload);
  });

  const hasExternalImagingWithoutAccess = input.externalLinks.some((link) => {
    if (link.kind !== "IMAGING") {
      return false;
    }

    return !hasAccessDetails(link);
  });

  return hasProtectedArchiveWithoutAccess || hasExternalImagingWithoutAccess;
}

export function deriveInitialApplicationStatus(input: {
  uploads: UploadLike[];
  externalLinks: ExternalLinkLike[];
}): ApplicationStatus {
  const hasMaterials = input.uploads.length > 0 || input.externalLinks.length > 0;

  if (!hasMaterials) {
    return "NEEDS_UPLOAD";
  }

  if (requiresImagingAccess(input)) {
    return "NEEDS_IMAGING_ACCESS";
  }

  return "UNDER_REVIEW";
}
