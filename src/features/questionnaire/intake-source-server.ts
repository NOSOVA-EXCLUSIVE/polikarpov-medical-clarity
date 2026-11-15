import "server-only";

import { assertPreviewIsolation } from "@/lib/preview/guard";
import {
  INTAKE_CAMPAIGN_HEADER,
  INTAKE_CHANNEL_HEADER,
  parseIntakeCampaign,
  parseIntakeChannel,
  type IntakeSource
} from "@/features/questionnaire/intake-source";

export type ApplicationIntakeSource = IntakeSource & { networkCountry: string | null };

export const APPLICATION_INTAKE_SOURCE_ACTION = "application_intake_source_recorded";

const countryNames = new Intl.DisplayNames("ru", { type: "region", fallback: "none" });

function parseCountryCode(value: unknown) {
  if (typeof value !== "string" || !/^[A-Z]{2}$/.test(value) || value === "ZZ") return null;
  return countryNames.of(value) ? value : null;
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
    channel: headers.get(INTAKE_CHANNEL_HEADER),
    campaign: headers.get(INTAKE_CAMPAIGN_HEADER),
    networkCountry: platformGeolocation ? headers.get("x-vercel-ip-country") : null
  });
}

export function parseApplicationIntakeSource(value: unknown): ApplicationIntakeSource {
  const fields = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const channel = parseIntakeChannel(fields.channel);
  return {
    channel,
    campaign: channel && channel !== "referral" ? parseIntakeCampaign(fields.campaign) : null,
    networkCountry: parseCountryCode(fields.networkCountry)
  };
}

export function applicationIntakeSourceEvents(applicationId: string, source?: ApplicationIntakeSource) {
  if (!source?.channel && !source?.networkCountry) return [];
  return [{
    actorType: "SYSTEM" as const,
    entityType: "APPLICATION" as const,
    entityId: applicationId,
    applicationId,
    action: APPLICATION_INTAKE_SOURCE_ACTION,
    metadataJson: source
  }];
}
