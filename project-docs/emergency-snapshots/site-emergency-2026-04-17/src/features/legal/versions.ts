export const LEGAL_DOCUMENT_VERSIONS = {
  offer: process.env.LEGAL_OFFER_VERSION?.trim() || "2026-04-09",
  privacy: process.env.LEGAL_PRIVACY_VERSION?.trim() || "2026-04-09",
  consent: process.env.LEGAL_CONSENT_VERSION?.trim() || "2026-04-09"
} as const;
