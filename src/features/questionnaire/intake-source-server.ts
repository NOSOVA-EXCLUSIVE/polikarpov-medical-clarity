import "server-only";

import { assertPreviewIsolation } from "@/lib/preview/guard";
import {
  INTAKE_CAMPAIGN_HEADER,
  INTAKE_CHANNEL_HEADER,
  INTAKE_LANDING_PAGE_HEADER,
  INTAKE_LINK_TAG_HEADER,
  INTAKE_REFERRER_URL_HEADER,
  parseIntakeCampaign,
  parseIntakeChannel,
  parseIntakeCurrentCampaign,
  parseIntakeCurrentChannel,
  parseIntakeLandingPage,
  parseIntakeLinkTag,
  parseIntakeReferrerUrl,
  type IntakeSource
} from "@/features/questionnaire/intake-source";

export type ApplicationIntakeSource = IntakeSource & {
  networkCountry: string | null;
  networkRegion: string | null;
  networkCity: string | null;
};

export const APPLICATION_INTAKE_SOURCE_ACTION = "application_intake_source_recorded";

const countryNames = new Intl.DisplayNames("ru", { type: "region", fallback: "none" });
const maxCityLength = 120;

function parseCountryCode(value: unknown) {
  if (typeof value !== "string" || !/^[A-Z]{2}$/.test(value) || value === "ZZ") return null;
  return countryNames.of(value) ? value : null;
}

function parseRegionCode(value: unknown) {
  return typeof value === "string" && /^[A-Z0-9]{1,3}$/.test(value) ? value : null;
}

function parseCityName(value: unknown) {
  if (typeof value !== "string" || value.length > maxCityLength || !/^[\p{L}\p{M}\p{N} .’'()\p{Pd}]+$/u.test(value)) {
    return null;
  }
  const name = value.normalize("NFC").trim().replace(/ +/g, " ");
  return /\p{L}/u.test(name) ? name : null;
}

function decodeCityHeader(value: string | null) {
  if (!value || value.length > 12 * maxCityLength) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function intakeNetworkCountryLabel(code: string | null) {
  if (!code) return "Нет данных";
  const name = countryNames.of(code);
  return name ? `${name} (${code})` : code;
}

export function readApplicationIntakeSource(headers: Headers): ApplicationIntakeSource {
  const platformGeolocation = process.env.VERCEL === "1" && (
    process.env.VERCEL_ENV === "production" ||
    (process.env.VERCEL_ENV === "preview" && assertPreviewIsolation() !== null)
  );
  return parseApplicationIntakeSource({
    channel: parseIntakeCurrentChannel(headers.get(INTAKE_CHANNEL_HEADER)),
    campaign: parseIntakeCurrentCampaign(headers.get(INTAKE_CAMPAIGN_HEADER)),
    landingPage: headers.get(INTAKE_LANDING_PAGE_HEADER),
    linkTag: headers.get(INTAKE_LINK_TAG_HEADER),
    referrerUrl: headers.get(INTAKE_REFERRER_URL_HEADER),
    networkCountry: platformGeolocation ? headers.get("x-vercel-ip-country") : null,
    networkRegion: platformGeolocation ? headers.get("x-vercel-ip-country-region") : null,
    networkCity: platformGeolocation ? decodeCityHeader(headers.get("x-vercel-ip-city")) : null
  });
}

export function parseApplicationIntakeSource(value: unknown): ApplicationIntakeSource {
  const fields = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const channel = parseIntakeChannel(fields.channel);
  const networkCountry = parseCountryCode(fields.networkCountry);
  return {
    channel,
    campaign: channel && channel !== "referral" ? parseIntakeCampaign(fields.campaign) : null,
    landingPage: parseIntakeLandingPage(fields.landingPage),
    linkTag: parseIntakeLinkTag(fields.linkTag),
    referrerUrl: parseIntakeReferrerUrl(fields.referrerUrl),
    networkCountry,
    networkRegion: networkCountry ? parseRegionCode(fields.networkRegion) : null,
    networkCity: parseCityName(fields.networkCity)
  };
}

export function applicationIntakeSourceEvents(applicationId: string, source?: ApplicationIntakeSource) {
  if (!source || !Object.values(source).some(Boolean)) return [];
  return [{
    actorType: "SYSTEM" as const,
    entityType: "APPLICATION" as const,
    entityId: applicationId,
    applicationId,
    action: APPLICATION_INTAKE_SOURCE_ACTION,
    metadataJson: source
  }];
}
