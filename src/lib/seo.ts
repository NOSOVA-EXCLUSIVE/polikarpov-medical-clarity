import type { Metadata } from "next";

export const SITE_NAME = "Polikarpov Medical Clarity";
export const DEFAULT_SITE_URL = "http://localhost:3000";
export const DEFAULT_OG_IMAGE_PATH = "/opengraph-image.jpg";

type IndexingMode = {
  index: boolean;
  follow: boolean;
};

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  canonicalPath?: string;
  indexing?: IndexingMode;
};

const serviceSeoBySlug = {
  "second-opinion": {
    title: "Экспертное второе мнение",
    description:
      "Экспертное второе мнение по травматологии и ортопедии: разбор диагнозов, обследований, МРТ и клинической ситуации с понятным профессиональным ориентиром."
  },
  "clinical-review": {
    title: "Клинический разбор ситуации",
    description:
      "Дистанционный клинический разбор сложной ортопедической или травматологической ситуации: сопоставление жалоб, обследований и снимков для более ясного медицинского маршрута."
  },
  "recovery-control": {
    title: "Контроль восстановления",
    description:
      "Профессиональный контроль восстановления после травмы, операции или лечения в дистанционном формате с последовательной оценкой динамики и дальнейших шагов."
  },
  "personal-support": {
    title: "Индивидуальное сопровождение",
    description:
      "Индивидуальное дистанционное сопровождение в сложных ортопедических и травматологических ситуациях с последовательным клиническим разбором и спокойной коммуникацией."
  }
} as const;

const documentSeoBySlug = {
  offer: {
    title: "Публичная оферта",
    description:
      "Публичная оферта Polikarpov Medical Clarity: условия дистанционной работы, оплаты, начала взаимодействия и общие правила оказания услуги."
  },
  "online-consultation": {
    title: "Правила дистанционного формата",
    description:
      "Документ о правилах дистанционного формата, его границах и ситуациях, в которых требуется очный формат медицинской помощи."
  },
  "informed-consent": {
    title: "Информированное согласие",
    description:
      "Информированное согласие на дистанционный формат взаимодействия: ограничения формата, требования к достоверности информации и безопасные действия при ухудшении состояния."
  },
  "data-policy": {
    title: "Политика обработки персональных данных",
    description:
      "Политика обработки персональных данных и медицинской информации: какие сведения используются, для чего они нужны и как защищаются в рамках Polikarpov Medical Clarity."
  },
  refunds: {
    title: "Возвраты и переносы",
    description:
      "Правила переносов, отмен и возвратов в Polikarpov Medical Clarity с учётом фактически выполненной профессиональной работы."
  },
  "support-regulations": {
    title: "Регламент дистанционного сопровождения",
    description:
      "Регламент дистанционного сопровождения: формат взаимодействия, допустимые вопросы, сроки ответа и рабочие границы сопровождения."
  }
} as const;

export type ServiceSeoSlug = keyof typeof serviceSeoBySlug;
export type DocumentSeoSlug = keyof typeof documentSeoBySlug;

export function getSiteUrl() {
  const configuredUrl =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_SITE_URL;

  return configuredUrl.endsWith("/") ? configuredUrl.slice(0, -1) : configuredUrl;
}

export function buildAbsoluteUrl(path: string) {
  return new URL(path, getSiteUrl()).toString();
}

export function buildPageMetadata({
  title,
  description,
  path,
  canonicalPath,
  indexing = { index: true, follow: true }
}: PageMetadataInput): Metadata {
  const canonical = canonicalPath ?? path;
  const socialTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const ogImageUrl = buildAbsoluteUrl(DEFAULT_OG_IMAGE_PATH);

  return {
    title,
    description,
    alternates: {
      canonical
    },
    robots: indexing,
    openGraph: {
      title: socialTitle,
      description,
      url: buildAbsoluteUrl(canonical),
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: SITE_NAME
        }
      ],
      siteName: SITE_NAME,
      locale: "ru_RU",
      type: "website"
    },
    twitter: {
      card: "summary",
      title: socialTitle,
      description,
      images: [ogImageUrl]
    }
  };
}

export function buildServiceMetadata(slug: ServiceSeoSlug) {
  const seo = serviceSeoBySlug[slug];

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path: `/services/${slug}`
  });
}

export function buildDocumentMetadata(
  slug: DocumentSeoSlug,
  path: string,
  canonicalPath?: string
) {
  const seo = documentSeoBySlug[slug];

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    path,
    canonicalPath
  });
}
