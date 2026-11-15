import { paidServicesV21 } from "@/features/products/services-v21";
import type { IntakeSource } from "@/features/questionnaire/intake-source";
import {
  intakeNetworkCountryLabel,
  type ApplicationIntakeSource
} from "@/features/questionnaire/intake-source-server";
import { buildAbsoluteUrl } from "@/lib/seo";

const channelLabels: Partial<Record<NonNullable<IntakeSource["channel"]>, string>> = {
  google: "Google",
  bing: "Bing",
  yandex: "Яндекс",
  duckduckgo: "DuckDuckGo",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  email: "Email",
  link: "Ссылка",
  referral: "Другой сайт"
};

const campaignLabels: Partial<Record<NonNullable<IntakeSource["campaign"]>, string>> = {
  "professional-profile": "Профессиональный профиль",
  "website-launch": "Запуск сайта"
};

const linkTagLabels: Record<string, string> = {
  "telegram-post": "Публикация в Telegram",
  "telegram-profile": "Профиль в Telegram",
  "direct-message": "Личное сообщение",
  "email-signature": "Подпись в письме",
  "website-link": "Ссылка на другом сайте",
  "social-profile": "Профиль в соцсети",
  "social-post": "Публикация в соцсети"
};

const pageLabels: Record<string, string> = {
  "/": "Главная",
  "/doctor": "О враче",
  "/doctor/documents": "Документы врача",
  "/services": "Услуги и стоимость",
  "/documents": "Документы",
  "/questionnaire": "Анкета пациента"
};

function landingPageLabel(path: string) {
  return pageLabels[path] ??
    paidServicesV21.find(({ slug }) => path === `/services/${slug}`)?.title ??
    path;
}

function taggedLink(source: ApplicationIntakeSource) {
  const { landingPage, channel, linkTag } = source;
  const campaign = source.campaign === "qr-card" ? null : source.campaign;
  if (!landingPage || !channel || channel === "referral" || channel === "qr" || (!campaign && !linkTag)) {
    return null;
  }

  const url = new URL(buildAbsoluteUrl(landingPage));
  url.searchParams.set("utm_source", channel);
  if (campaign) url.searchParams.set("utm_campaign", campaign);
  if (linkTag) url.searchParams.set("utm_content", linkTag);
  return url.href;
}

type ApplicationIntakeSummaryProps = {
  patient: {
    fullName: string;
    country: string;
    city: string;
    timezone: string;
  };
  source: ApplicationIntakeSource;
};

export function ApplicationIntakeSummary({ patient, source }: ApplicationIntakeSummaryProps) {
  const declaredPlace = [patient.city, patient.country].filter(Boolean).join(", ");
  const region = source.networkRegion && source.networkCountry
    ? `${source.networkCountry}-${source.networkRegion}`
    : source.networkRegion;
  const networkPlace = [
    source.networkCountry ? intakeNetworkCountryLabel(source.networkCountry) : null,
    source.networkCity
  ].filter(Boolean).join(", ");
  const campaign = source.campaign ? campaignLabels[source.campaign] : null;
  const link = taggedLink(source);
  const firstPage = source.landingPage ? landingPageLabel(source.landingPage) : null;

  return (
    <dl className="application-intake-summary" aria-label="Сведения о заявке">
      <div>
        <dt>Из анкеты</dt>
        <dd>{patient.fullName}</dd>
        {declaredPlace ? <dd>{declaredPlace}</dd> : null}
        {patient.timezone ? <dd className="muted">{patient.timezone}</dd> : null}
      </div>
      <div>
        <dt>Подключение (примерно)</dt>
        <dd>{networkPlace || "Нет данных"}</dd>
        {region ? <dd className="muted">Код региона {region}</dd> : null}
      </div>
      <div>
        <dt>Источник перехода</dt>
        <dd>{(source.channel && channelLabels[source.channel]) || "Не определён"}</dd>
        {campaign ? <dd className="muted">{campaign}</dd> : null}
      </div>
      <div>
        <dt>Ссылка или сайт перехода</dt>
        <dd>{source.referrerUrl || "Нет данных"}</dd>
      </div>
      <div>
        <dt>Первая страница на сайте</dt>
        <dd>{firstPage || "Нет данных"}</dd>
        {source.landingPage && firstPage !== source.landingPage
          ? <dd className="muted">{source.landingPage}</dd>
          : null}
      </div>
      {link ? (
        <div>
          <dt>Помеченная ссылка</dt>
          {source.linkTag ? <dd>{linkTagLabels[source.linkTag] ?? source.linkTag}</dd> : null}
          <dd className={source.linkTag ? "muted" : undefined}>{link}</dd>
        </div>
      ) : null}
    </dl>
  );
}
