const channels = [
  "google", "bing", "yandex", "duckduckgo", "telegram", "whatsapp", "instagram",
  "facebook", "linkedin", "email", "qr", "referral"
] as const;

const campaigns = ["professional-profile", "website-launch", "qr-card"] as const;

type IntakeChannel = (typeof channels)[number];
type IntakeCampaign = (typeof campaigns)[number];

export type IntakeSource = {
  channel: IntakeChannel | null;
  campaign: IntakeCampaign | null;
};

export const INTAKE_CHANNEL_HEADER = "x-pmc-intake-channel";
export const INTAKE_CAMPAIGN_HEADER = "x-pmc-intake-campaign";

export function parseIntakeChannel(value: unknown): IntakeChannel | null {
  return channels.find((channel) => channel === value) ?? null;
}

export function parseIntakeCampaign(value: unknown): IntakeCampaign | null {
  return campaigns.find((campaign) => campaign === value) ?? null;
}

const referringSites: Array<[IntakeChannel, string[]]> = [
  ["google", ["google.com", "google.ru", "google.co.uk", "google.de", "google.es"]],
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
  return isDomain(hostname, "polikarpovclarity.com") || isDomain(hostname, "polikarpovclarity.ru");
}

export function readTaggedIntakeSource(url: URL): IntakeSource | null {
  const channel = parseIntakeChannel(url.searchParams.get("utm_source")?.toLowerCase());
  if (!channel || channel === "referral") return null;
  return { channel, campaign: parseIntakeCampaign(url.searchParams.get("utm_campaign")?.toLowerCase()) };
}

export function readIntakeReferrer(referrer: string, pageUrl: URL): IntakeSource | null {
  if (!referrer) return null;

  try {
    const url = new URL(referrer);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname === pageUrl.hostname || (isSiteDomain(url.hostname) && isSiteDomain(pageUrl.hostname))) {
      return null;
    }

    const match = referringSites.find(([, domains]) =>
      domains.some((domain) => isDomain(url.hostname, domain))
    );
    return { channel: match?.[0] ?? "referral", campaign: null };
  } catch {
    return null;
  }
}
