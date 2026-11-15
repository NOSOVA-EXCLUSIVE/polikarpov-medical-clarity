"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  INTAKE_CAMPAIGN_HEADER,
  INTAKE_CHANNEL_HEADER,
  readIntakeReferrer,
  readTaggedIntakeSource,
  type IntakeSource
} from "@/features/questionnaire/intake-source";

// Keep only the classification in memory until the form is submitted.
let source: IntakeSource | null = null;

function captureSource() {
  const pageUrl = new URL(window.location.href);
  source = readTaggedIntakeSource(pageUrl) ?? source ?? readIntakeReferrer(document.referrer, pageUrl);
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
  return headers;
}
