import Link from "next/link";

import { PageHero, Section } from "../../components/public/shell";
import type { Route } from "next";

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { formatServicePrice, getServiceV21, organizationalSelection, serviceQuestionnaireHref } from "@/features/products/services-v21";

export const metadata: Metadata = buildPageMetadata({
  title: "Экспертное второе мнение и клинический разбор",
  description:
    "Polikarpov Medical Clarity — экспертное второе мнение, дистанционный клинический разбор и профессиональная интерпретация МРТ, КТ и медицинских материалов у травматолога-ортопеда.",
  path: "/"
});

const doctorDocumentsHref = "/doctor/documents" satisfies Route;

const entryScenarios = [
  {
    id: "initial-assessment",
    situation: "Болит сустав, обследований ещё нет",
    note: "Самостоятельный первый шаг; продолжение не обязательно."
  },
  {
    id: "second-opinion",
    situation: "Исследование уже есть, нужен независимый взгляд",
    note: "Можно обратиться сразу, без обязательной первичной оценки."
  },
  {
    id: "complex-review",
    situation: "После операции накопились выписки и исследования",
    note: "Для одной связанной истории и сопоставления данных разных дат."
  }
] as const;

const clinicalExperience = [
  ["Группа компаний «Мать и дитя»"],
  ["Научно-исследовательский институт скорой помощи", "им. Н. В. Склифосовского"],
  ["Медицинский центр Управления делами Мэра", "и Правительства Москвы"],
  ["Группа компаний «МЕДСИ»"],
  ["Клиника «Сфера»"]
];

const workSteps = [
  {
    number: "Этап I",
    title: "Опишите задачу",
    lines: ["Сообщите, что беспокоит, какие материалы уже есть и какой вопрос вы хотите обсудить."],
    accent: "Если формат пока неясен, организационный подбор бесплатен."
  },
  {
    number: "Этап II",
    title: "Согласуем формат",
    lines: ["Уточняем возможность работы, объём материалов, стоимость и срок до оплаты."],
    accent: "Первичная оценка за €20 не обязательна, если исследования уже готовы."
  },
  {
    number: "Этап III",
    title: "Передайте материалы",
    lines: ["После оформления необходимых документов сведения передаются по согласованному защищённому каналу."],
    accent: "Если комплект неполный, сообщим, чего не хватает."
  },
  {
    number: "Этап IV",
    title: "Получите результат",
    lines: ["Врач изучает материалы в согласованном объёме и готовит персональный письменный результат."],
    accent: "С перечнем изученных материалов и ограничениями оценки."
  }
];

export default function HomePage() {
  return (
    <main>
      <PageHero
        className="home-hero"
        eyebrow={
          <div className="hero-status-block" role="note" aria-label="Профессиональный статус">
            <p className="hero-status-block__item">
              Член «Ассоциации травматологов-ортопедов России»
            </p>
            <p className="hero-status-block__item">
              Член «Ассоциации врачей МРТ и КТ-диагностики»
            </p>
          </div>
        }
        title={
          <>
            <span className="home-hero__title-intro">
              <span className="home-hero__title-line">
                Профессиональный клинический разбор
              </span>
              <span className="home-hero__title-line">сложных ситуаций</span>
              <span className="home-hero__title-line">
                в травматологии и ортопедии
              </span>
            </span>
            <span className="home-hero__title-main">
              <span className="home-hero__title-line">
                Когда важно не просто услышать мнение,
              </span>
              <span className="home-hero__title-line">
                а понять, что происходит на самом деле
              </span>
              <span className="home-hero__title-line">
                и получить профессионально обоснованный
              </span>
              <span className="home-hero__title-line">
                ориентир по дальнейшим шагам
              </span>
            </span>
          </>
        }
        description={
          <div className="home-hero__description-copy">
            Системный профессиональный разбор ситуации
            <br />
            с объединением предоставленных данных в единую понятную логику ситуации{" "}
            и формированием обоснованных рекомендаций
            <br />
            в рамках дистанционного информационно-консультационного формата
          </div>
        }
        supportingContent={
          <div className="home-hero__points">
            <p className="home-hero__points-title">ЗДЕСЬ:</p>
            <div className="home-hero__points-list">
              <p>
                — разбирается конкретная клиническая ситуация, а не даются общие
                рекомендации
              </p>
              <p>
                — проводится анализ расхождений между различными мнениями и
                заключениями
              </p>
              <p>
                — объясняется, что именно происходит с медицинской точки зрения
              </p>
              <p>— формируется обоснованный ориентир по дальнейшим действиям</p>
            </div>
          </div>
        }
        actions={
          <>
            <Link className="button" href="/services">
              Выбрать формат
            </Link>
            <Link className="button button--secondary" href="/#how-it-works">
              Как проходит разбор ситуации
            </Link>
          </>
        }
        afterActions={
          <p className="home-hero__micro-note">
            Дистанционный формат. Не является экстренной медицинской помощью и не
            заменяет очный приём врача.
          </p>
        }
        aside={
          <div className="home-hero__portrait-wrap">
            <div className="home-hero__portrait-square">
              <img
                alt="Евгений Сергеевич Поликарпов"
                className="home-hero__portrait-image"
                src="/images/doctor/hero-portrait-no-badge-20261027.png"
              />
            </div>
          </div>
        }
      />

      <section className="home-hero-followup">
        <div className="container home-hero-followup__grid home-hero-followup__grid--two">
          <article className="home-hero-panel home-hero-panel--about stack-sm">
            <p className="home-hero-panel__label">О враче</p>
            <div className="home-hero-about home-hero-about--expanded">
              <h3 className="home-summary-about__name">Поликарпов Евгений Сергеевич</h3>
              <div className="home-hero-about__roles home-hero-about__roles--expanded">
                <p>Травматолог-ортопед</p>
                <p>Врач магнитно-резонансной томографии</p>
                <p>Специалист по ударно-волновой терапии</p>
              </div>
              <div className="home-summary-copy">
                <p>
                  Профессиональный профиль — разбор сложных ситуаций, когда важно не
                  просто получить ещё одно мнение, а спокойнее и точнее понять
                  логику происходящего.
                </p>
                <p>
                  Работает с обследованиями, жалобами и уже полученными
                  заключениями, помогая увидеть более цельную картину ситуации и
                  определить обоснованный дальнейший маршрут.
                </p>
                <p>
                  Это не потоковый формат.
                  <br />
                  В фокусе — внимательный профессиональный разбор и ясность там, где
                  важно не ошибиться.
                </p>
              </div>
            </div>
          </article>

          <article className="home-hero-panel home-hero-panel--experience stack-sm">
            <p className="home-hero-panel__label">Клинический опыт</p>
            <div className="home-summary-experience">
            <p className="home-summary-experience__intro">
                Практика в ведущих медицинских учреждениях:
              </p>
              <div className="home-hero-experience-list home-hero-experience-list--expanded">
                {clinicalExperience.map((item, index) => (
                  <article key={`${item[0]}-${index}`} className="home-hero-experience-row">
                    {item.map((line) => (
                      <p key={line} className="home-hero-experience-row__title">
                        {line}
                      </p>
                    ))}
                  </article>
                ))}
              </div>
              <p className="home-summary-experience__closing">
                Практика в травматологии, ортопедии и МРТ-диагностике более 20 лет
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="home-mobile-documents-cta" aria-label="Документы врача">
        <div className="container">
          <Link className="button button--secondary" href={doctorDocumentsHref}>
            Документы и квалификация
          </Link>
        </div>
      </section>

      <Section title="С чего начать?">
        <div className="home-formats-shell stack">
          <p className="home-formats-shell__lead">
            Выберите ближайшую к вашей ситуации задачу. Объём, стоимость и срок
            работы подтверждаются до оплаты.
          </p>
          <div className="home-formats-grid home-entry-grid">
            {entryScenarios.map((scenario) => {
              const service = getServiceV21(scenario.id);
              if (!service) return null;
              return (
                <article key={service.id} className="home-format-card">
                  <p className="home-format-card__label">{scenario.situation}</p>
                  <h3 className="home-format-card__title">{service.title}</h3>
                  <p className="services-format-card__price-new">{formatServicePrice(service)}</p>
                  <div className="home-format-card__body">
                    <p className="home-format-card__action">{service.shortDescription}</p>
                    <p className="home-format-card__accent">{scenario.note}</p>
                  </div>
                  <div className="hero-actions">
                    <Link className="button" href={serviceQuestionnaireHref(service.id) as Route}>
                      Выбрать формат
                    </Link>
                    <Link className="button button--secondary" href={`/services/${service.slug}` as Route}>
                      Подробнее
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="hero-actions">
            <Link className="button button--secondary" href="/services">
              Все 10 форматов и стоимость
            </Link>
          </div>
          <article className="home-hero-panel stack-sm" id="format-selection">
            <p className="home-hero-panel__label">Организационный подбор — бесплатно</p>
            <h3>Не знаете, какой формат подойдёт?</h3>
            <p>
              {organizationalSelection.shortDescription} {organizationalSelection.description}
              {" "}{organizationalSelection.turnaround}
            </p>
            <p className="muted">
              Медицинская оценка и просмотр снимков в бесплатный подбор не входят.
            </p>
            <div className="hero-actions">
              <Link className="button button--secondary" href={serviceQuestionnaireHref("service-selection") as Route}>
                Подобрать услугу бесплатно
              </Link>
            </div>
          </article>
        </div>
      </Section>
      <Section id="how-it-works" title="Как проходит работа">
        <div className="home-work-grid">
          {workSteps.map((step) => (
            <article key={step.number} className="home-work-card">
              <div className="home-work-card__header">
                <span className="home-work-card__number">{step.number}</span>
                <h3>{step.title}</h3>
              </div>
              <div className="home-work-card__copy">
                {step.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <p className="home-work-card__accent">{step.accent}</p>
            </article>
          ))}
        </div>
      </Section>

      <section className="home-final-cta">
        <div className="container">
          <div className="home-final-cta__card stack">
            <div className="stack-sm">
              <h2>
                Если для вас важно не просто получить мнение, а спокойнее разобраться
                в ситуации и понять, какой шаг действительно уместен
              </h2>
              <div className="home-final-cta__copy">
                <p>
                  Выберите подходящий формат или начните с бесплатного организационного
                  подбора. Первичная оценка за €20 — самостоятельная услуга; если
                  исследования уже готовы, можно сразу обратиться за экспертным разбором.
                </p>
              </div>
            </div>

            <div className="stack-sm home-final-cta__actions">
              <div className="hero-actions">
                <Link className="button" href="/services">
                  Выбрать формат
                </Link>
                <Link className="button button--secondary" href={serviceQuestionnaireHref("service-selection") as Route}>
                  Подобрать услугу бесплатно
                </Link>
              </div>
              <p className="home-hero__micro-note">Конфиденциально. Спокойно. По существу.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
