import Link from "next/link";
import type { Metadata, Route } from "next";

import { Section } from "../../../components/public/shell";
import { ManualWorkflow } from "@/components/public/manual-workflow";
import { ServiceOverview } from "@/components/public/service-overview";
import {
  formatServicePrice,
  getServiceV21,
  organizationalSelection,
  primaryAssessmentDiscountV21,
  serviceQuestionnaireHref
} from "@/features/products/services-v21";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Форматы помощи и стоимость",
  description:
    "Десять форматов Polikarpov Medical Clarity: первичная оценка, разъяснение протокола, второе мнение, разбор истории и письменное сопровождение. Стоимость в евро и бесплатный организационный подбор.",
  path: "/services"
});

const entryScenarios = [
  {
    id: "initial-assessment",
    situation: "Обследований ещё нет",
    description: "Начните с первичной оценки обращения и следующего обоснованного шага."
  },
  {
    id: "second-opinion",
    situation: "Исследование уже выполнено",
    description: "Независимый взгляд на один исходный комплект изображений, описание и жалобы."
  },
  {
    id: "complex-review",
    situation: "Сложная история или операция",
    description: "Хронология одной связанной проблемы и сравнение до двух исследований разных дат."
  }
] as const;

export default function ServicesPage() {
  return (
    <main className="services-page">
      <section className="section services-page__simple-intro">
        <div className="container stack">
          <div className="section-heading stack-sm">
            <h1 className="services-page__title">Форматы помощи и стоимость</h1>
            <p className="lead">
              От первого вопроса до сложной истории: выберите задачу, которую хотите
              разобрать. Все цены указаны в евро.
            </p>
          </div>

          <ServiceOverview idPrefix="services" />
          <p className="services-orientation-note">
            Состав, возможность работы и стоимость согласуются до оплаты.
          </p>
          <article className="home-hero-panel stack-sm" id="format-selection">
            <p className="home-hero-panel__label">Бесплатный организационный подбор</p>
            <h2>Не уверены, какой формат выбрать?</h2>
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
      </section>

      <Section id="how-it-works" title="Как проходит работа">
        <ManualWorkflow variant="general" />
      </Section>

      <Section title="Вопросы о выборе и условиях">
        <div className="service-faq-list">
          <details className="service-faq">
            <summary>С чего начать?</summary>
            <div className="service-faq__content">
              <div className="stack-sm">
                <div className="services-orientation-grid services-orientation-grid--three">
                  {entryScenarios.map((scenario) => {
                    const service = getServiceV21(scenario.id);
                    if (!service) return null;
                    return (
                      <article key={service.id} className="services-orientation-card stack-sm">
                        <h3>{scenario.situation}</h3>
                        <p>{scenario.description}</p>
                        <p><strong>{formatServicePrice(service)} · {service.title}</strong></p>
                        <Link className="inline-link" href={`/services/${service.slug}` as Route}>
                          Посмотреть состав формата →
                        </Link>
                      </article>
                    );
                  })}
                </div>
                <p className="services-orientation-note">
                  Первичная оценка за €20 — самостоятельная услуга. Если подходящие
                  исследования уже готовы, можно сразу заказать экспертный разбор.
                  Объём материалов, стоимость и срок подтверждаем до оплаты.
                </p>
              </div>
            </div>
          </details>
          <details className="service-faq">
            <summary>Чем отличаются три основных разбора</summary>
            <div className="service-faq__content">
              <div className="services-orientation-grid services-orientation-grid--three">
                <article className="services-orientation-card stack-sm">
                  <h3>€80 · Экспертное второе мнение</h3>
                  <p>Самостоятельно изучить одно исследование и сопоставить его с жалобами и описанием.</p>
                </article>
                <article className="services-orientation-card stack-sm">
                  <h3>€100 · Расширенный клинический разбор</h3>
                  <p>Дополнительно рассмотреть историю лечения, сохраняющиеся ограничения и возможные объяснения симптомов по одной взаимосвязанной проблеме.</p>
                </article>
                <article className="services-orientation-card stack-sm">
                  <h3>€160 · Комплексный разбор</h3>
                  <p>Собрать сложную историю в хронологию и сопоставить до двух исследований разных дат.</p>
                </article>
              </div>
              <p className="muted">
                Число страниц помогает определить формат до оплаты и не служит основанием
                пропускать клинически важные сведения.
              </p>
            </div>
          </details>
          <details className="service-faq">
            <summary>Два этапа — когда они нужны</summary>
            <div className="service-faq__content">
              <div className="home-hero-panel stack">
                <p>
                  {primaryAssessmentDiscountV21.description}
                </p>
                <div className="services-orientation-grid services-orientation-grid--three">
                  <article className="services-orientation-card stack-sm">
                    <h3>€20 + €70 = €90</h3>
                    <p>Первичная оценка и экспертное второе мнение.</p>
                  </article>
                  <article className="services-orientation-card stack-sm">
                    <h3>€20 + €90 = €110</h3>
                    <p>Первичная оценка и расширенный клинический разбор.</p>
                  </article>
                  <article className="services-orientation-card stack-sm">
                    <h3>€20 + €150 = €170</h3>
                    <p>Первичная оценка и комплексный разбор.</p>
                  </article>
                </div>
                <p>
                  Снижение €10 применяется к экспертным разборам стоимостью от €80,
                  включая согласованный особо сложный случай. Оно не распространяется
                  на разъяснение протокола за €40, краткий повторный разбор за €50,
                  сопровождение и видео.
                </p>
                <p className="muted">
                  Исследования в сторонних организациях оплачиваются отдельно.
                  Автоматических списаний и подписки нет.
                </p>
              </div>
            </div>
          </details>
          <details className="service-faq">
            <summary>Сроки и порядок работы</summary>
            <div className="service-faq__content">
              <div className="stack">
                <p>
                  Первый организационный ответ — до трёх рабочих дней. Это
                  подтверждение обращения и следующего шага; готовый врачебный разбор
                  предоставляется в срок выбранной услуги.
                </p>
                <p>
                  Для всех форматов предусмотрен уточняющий созвон до окончательного
                  предложения и оплаты. Выбранное время подтверждает врач. При бесплатном
                  подборе созвон остаётся организационным: медицинская оценка и просмотр
                  снимков в него не входят.
                </p>
                <p>
                  После созвона согласуются формат, объём, стоимость и срок. Оплата
                  оформляется вручную вне сайта. Отсчёт срока начинается после отдельного
                  подтверждения врачом начала работы при достаточности материалов и
                  получении оплаты. Рабочие дни — с понедельника по пятницу;
                  дату начала и готовности подтверждаем с учётом графика врача и
                  нерабочих праздничных дней.
                </p>
                <p>
                  Персональные результаты доступны через собственный кабинет; номер обращения
                  отображается при просмотре материалов. После завершения работы доступ пациента к истории
                  сохраняется ещё 30 календарных дней; этот срок заранее указывается в
                  персональном предложении. Закрытие доступа не означает удаления истории
                  врача. Маркировка при просмотре не встроена в исходный файл и не исключает
                  копирования, в том числе записи экрана.
                </p>
                <p className="muted">
                  Дистанционная работа не заменяет очный осмотр, когда он необходим,
                  и не предназначена для экстренной помощи. Возможность оказания услуги
                  в конкретной стране и условия работы подтверждаются до начала.
                </p>
              </div>
            </div>
          </details>
        </div>
      </Section>

      <section className="section services-final-cta">
        <div className="container">
          <div className="services-final-cta__card stack">
            <div className="services-final-cta__copy stack-sm">
              <h2>Найдём подходящий первый шаг</h2>
              <p className="services-final-cta__lead">
                Если сомневаетесь в выборе, начните с бесплатного организационного
                подбора по краткому описанию задачи и перечню материалов.
              </p>
            </div>
            <div className="hero-actions">
              <Link className="button" href={serviceQuestionnaireHref("service-selection") as Route}>
                Подобрать услугу бесплатно
              </Link>
            </div>
            <p className="services-final-cta__micro-note">Конфиденциально. Спокойно. По существу.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
