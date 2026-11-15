"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  INTAKE_CAMPAIGN_HEADER,
  INTAKE_CHANNEL_HEADER,
  INTAKE_LANDING_PAGE_HEADER,
  INTAKE_LINK_TAG_HEADER,
  INTAKE_REFERRER_URL_HEADER,
  isIntakeSiteReferrer,
  parseIntakeCurrentCampaign,
  parseIntakeCurrentChannel,
  parseIntakeLandingPage,
  parseIntakeLinkTag,
  parseIntakeReferrerUrl,
  readIntakeReferrer,
  readTaggedIntakeSource,
  type IntakeSource
} from "@/features/questionnaire/intake-source";

// Store only sanitized attribution in this tab. No contact details or complete URLs.
const sourceStorageKey = "pmc-intake-source-v1";
let source: IntakeSource | null = null;

function readStoredSource(): IntakeSource | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(sourceStorageKey) ?? "null");
    if (!value || typeof value !== "object") return null;
    const landingPage = parseIntakeLandingPage(value.landingPage);
    if (!landingPage) return null;
    const channel = parseIntakeCurrentChannel(value.channel);
    return {
      channel,
      campaign: channel && channel !== "referral" ? parseIntakeCurrentCampaign(value.campaign) : null,
      landingPage,
      referrerUrl: parseIntakeReferrerUrl(value.referrerUrl),
      linkTag: channel && channel !== "referral" ? parseIntakeLinkTag(value.linkTag) : null
    };
  } catch {
    return null;
  }
}

function captureSource() {
  if (source) return;
  const pageUrl = new URL(window.location.href);
  const landingPage = parseIntakeLandingPage(pageUrl.pathname);
  if (!landingPage) return;

  const navigation = window.performance?.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  const tagged = readTaggedIntakeSource(pageUrl);
  if (navigation?.type === "reload" || navigation?.type === "back_forward" ||
      (!tagged && isIntakeSiteReferrer(document.referrer, pageUrl))) {
    source = readStoredSource();
    if (source) return;
  }

  const referrer = readIntakeReferrer(document.referrer, pageUrl);
  source = {
    channel: (tagged ?? referrer)?.channel ?? null,
    campaign: tagged?.campaign ?? null,
    landingPage,
    referrerUrl: referrer?.referrerUrl ?? null,
    linkTag: tagged?.linkTag ?? null
  };
  try {
    window.sessionStorage.setItem(sourceStorageKey, JSON.stringify(source));
  } catch {
    // The in-memory value remains available even when browser storage is disabled.
  }
}

export function IntakeSourceCapture() {
  const pathname = usePathname();
  useEffect(captureSource, [pathname]);
  return null;
}

export function getIntakeSourceHeaders() {
  captureSource();
  const headers: Record<string, string> = {};
  if (source?.channel) headers[INTAKE_CHANNEL_HEADER] = source.channel;
  if (source?.campaign) headers[INTAKE_CAMPAIGN_HEADER] = source.campaign;
  if (source?.landingPage) headers[INTAKE_LANDING_PAGE_HEADER] = source.landingPage;
  if (source?.referrerUrl) headers[INTAKE_REFERRER_URL_HEADER] = source.referrerUrl;
  if (source?.linkTag) headers[INTAKE_LINK_TAG_HEADER] = source.linkTag;
  return headers;
}
