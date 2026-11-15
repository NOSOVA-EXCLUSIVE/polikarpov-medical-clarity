import { publicSiteRoutes } from "@/lib/public-site-routes";

const channels = [
  "google", "bing", "yandex", "duckduckgo", "telegram", "whatsapp", "instagram",
  "facebook", "linkedin", "email", "link", "referral", "qr"
] as const;

const campaigns = ["professional-profile", "website-launch", "qr-card"] as const;
const linkTags = new Set([
  "telegram-post", "telegram-profile", "direct-message", "email-signature",
  "website-link", "social-profile", "social-post"
]);

const publicLandingPaths = new Set([
  ...publicSiteRoutes.map(({ path }) => path),
  "/questionnaire", "/legal/consent", "/legal/offer", "/legal/privacy"
]);

type IntakeChannel = (typeof channels)[number];
type IntakeCampaign = (typeof campaigns)[number];

export type IntakeSource = {
  channel: IntakeChannel | null;
  campaign: IntakeCampaign | null;
  landingPage?: string | null;
  referrerUrl?: string | null;
  linkTag?: string | null;
};

export const INTAKE_CHANNEL_HEADER = "x-pmc-intake-channel";
export const INTAKE_CAMPAIGN_HEADER = "x-pmc-intake-campaign";
export const INTAKE_LANDING_PAGE_HEADER = "x-pmc-intake-landing-page";
export const INTAKE_REFERRER_URL_HEADER = "x-pmc-intake-referrer-url";
export const INTAKE_LINK_TAG_HEADER = "x-pmc-intake-link-tag";

export function parseIntakeChannel(value: unknown): IntakeChannel | null {
  return channels.find((channel) => channel === value) ?? null;
}

export function parseIntakeCampaign(value: unknown): IntakeCampaign | null {
  return campaigns.find((campaign) => campaign === value) ?? null;
}

export function parseIntakeCurrentChannel(value: unknown) {
  const channel = parseIntakeChannel(value);
  return channel === "qr" ? null : channel;
}

export function parseIntakeCurrentCampaign(value: unknown) {
  const campaign = parseIntakeCampaign(value);
  return campaign === "qr-card" ? null : campaign;
}

export function parseIntakeLinkTag(value: unknown) {
  return typeof value === "string" && (linkTags.has(value) || /^link-[1-9]\d{0,3}$/.test(value))
    ? value
    : null;
}

export function parseIntakeLandingPage(value: unknown) {
  if (typeof value !== "string") return null;
  if (publicLandingPaths.has(value)) return value;
  const normalized = value.replace(/\/$/, "");
  return normalized !== "/" && publicLandingPaths.has(normalized) ? normalized : null;
}

const referringSites: Array<[IntakeChannel, string[]]> = [
  ["google", [
    "google.com", "google.ru", "google.co.uk", "google.de", "google.es", "google.fr",
    "google.it", "google.com.tr", "google.ae", "google.kz", "google.by", "google.co.in",
    "google.com.ua", "google.ca", "google.com.au"
  ]],
  ["bing", ["bing.com"]],
  ["yandex", ["yandex.ru", "yandex.com", "ya.ru"]],
  ["duckduckgo", ["duckduckgo.com"]],
  ["telegram", ["t.me", "telegram.me", "telegram.org"]],
  ["whatsapp", ["whatsapp.com", "wa.me"]],
  ["instagram", ["instagram.com"]],
  ["facebook", ["facebook.com", "fb.com"]],
  ["linkedin", ["linkedin.com", "lnkd.in"]]
];

function isDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isSiteDomain(hostname: string) {
  return isDomain(hostname, "polikarpovclarity.com") ||
    isDomain(hostname, "polikarpovclarity.ru") ||
    /^polikarpov-medical-clarity(?:-[a-z0-9-]+)?\.vercel\.app$/.test(hostname);
}

function publicHttpUrl(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 4096) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password && !url.port ? url : null;
  } catch {
    return null;
  }
}

const reservedSuffixes = new Set(["localhost", "local", "internal", "lan", "home", "corp", "example", "invalid", "test", "onion", "i2p"]);
const knownMultiPartSuffixes = new Set([
  "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "org.au", "co.nz",
  "co.in", "com.br", "com.mx", "com.tr", "com.ua", "co.jp"
]);

function isPublicHostname(hostname: string) {
  const labels = hostname.split(".");
  const suffix = labels[labels.length - 1];
  return labels.length > 1 && hostname.length <= 253 && !reservedSuffixes.has(suffix) &&
    /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(suffix) &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function knownReferrer(hostname: string) {
  for (const [channel, domains] of referringSites) {
    const domain = domains.find((candidate) => isDomain(hostname, candidate));
    if (domain) return { channel, domain };
  }
  return null;
}

function publicReferrerOrigin(url: URL, knownDomain?: string) {
  if (knownDomain) {
    // Preserve the provider without potentially identifying subdomain labels.
    return url.hostname === `www.${knownDomain}` ? url.origin : `${url.protocol}//${knownDomain}`;
  }
  const labels = url.hostname.replace(/^www\./, "").split(".");
  return labels.length === 2 ||
    (labels.length === 3 && knownMultiPartSuffixes.has(labels.slice(-2).join(".")))
    ? url.origin
    : null;
}

export function parseIntakeReferrerUrl(value: unknown) {
  const url = publicHttpUrl(value);
  if (!url || isSiteDomain(url.hostname) || !isPublicHostname(url.hostname)) return null;

  const known = knownReferrer(url.hostname);
  const origin = publicReferrerOrigin(url, known?.domain);
  if (!origin) return null;

  const channel = known?.channel;
  const path = url.pathname.replace(/\/$/, "");
  if ((channel === "google" || channel === "bing" || channel === "yandex") && path === "/search") {
    return `${origin}/search`;
  }
  if ((url.hostname === "t.me" || url.hostname === "telegram.me") && path.toLowerCase() === "/evgeniypolikarpov") {
    return `${origin}/EvgeniyPolikarpov`;
  }
  return origin;
}

export function isIntakeSiteReferrer(referrer: string, pageUrl: URL) {
  const url = publicHttpUrl(referrer);
  if (!url) return false;
  return url.hostname === pageUrl.hostname ||
    (isSiteDomain(url.hostname) && isSiteDomain(pageUrl.hostname));
}

export function readTaggedIntakeSource(url: URL): IntakeSource | null {
  const channel = parseIntakeCurrentChannel(url.searchParams.get("utm_source")?.toLowerCase());
  if (!channel || channel === "referral") return null;
  const campaign = parseIntakeCurrentCampaign(url.searchParams.get("utm_campaign")?.toLowerCase());
  const linkTag = parseIntakeLinkTag(url.searchParams.get("utm_content")?.toLowerCase());
  return { channel, campaign, ...(linkTag ? { linkTag } : {}) };
}

export function readIntakeReferrer(referrer: string, pageUrl: URL): IntakeSource | null {
  const url = publicHttpUrl(referrer);
  if (!url || isIntakeSiteReferrer(referrer, pageUrl)) return null;
  const referrerUrl = parseIntakeReferrerUrl(referrer);
  return {
    channel: knownReferrer(url.hostname)?.channel ?? "referral",
    campaign: null,
    ...(referrerUrl ? { referrerUrl } : {})
  };
}
