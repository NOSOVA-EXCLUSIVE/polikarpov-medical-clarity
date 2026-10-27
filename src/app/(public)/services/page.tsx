import Link from "next/link";
import type { Metadata, Route } from "next";

import { Section } from "../../../components/public/shell";
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

const serviceGroups = [
  {
    id: "first-step",
    title: "Первый шаг и понятное объяснение",
    ids: ["initial-assessment", "report-explanation"]
  },
  {
    id: "expert-review",
    title: "Исследования и клиническая история",
    ids: ["second-opinion", "clinical-review", "complex-review", "complex-case"]
  },
  {
    id: "continued-support",
    title: "Повторная работа и сопровождение",
    ids: ["follow-up", "recovery-control", "personal-support", "personal-video"]
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

          <div className="stack-sm">
            <h2 className="services-page__orientation-title">С чего начать?</h2>
            <div className="services-orientation-grid services-orientation-grid--three">
              {entryScenarios.map((scenario) => {
                const service = getServiceV21(scenario.id);
                if (!service) return null;
                return (
                  <article key={service.id} className="services-orientation-card stack-sm">
                    <h3>{scenario.situation}</h3>
                    <p>{scenario.description}</p>
                    <p><strong>{formatServicePrice(service)} · {service.title}</strong></p>
                    <Link className="inline-link" href={`#${service.id}` as Route}>
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

          <div className="services-groups stack">
            {serviceGroups.map((group) => (
              <section key={group.id} id={group.id} className="services-group stack" aria-labelledby={`${group.id}-title`}>
                <h2 id={`${group.id}-title`}>{group.title}</h2>
                <div className="services-formats-grid">
                  {group.ids.map((id) => {
                    const service = getServiceV21(id);
                    if (!service) return null;
                    return (
                      <article key={service.id} id={service.id} className="services-format-card">
                        <h3 className="services-format-card__title">{service.title}</h3>
                        <p className="services-format-card__price-new">{formatServicePrice(service)}</p>
                        <div className="services-format-card__body">
                          <p className="services-format-card__situation">{service.shortDescription}</p>
                          <div className="services-format-card__block">
                            <p className="services-format-card__label">Объём работы</p>
                            <ul className="list">
                              {service.scope.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                          <div className="services-format-card__block">
                            <p className="services-format-card__label">Результат</p>
                            <p className="services-format-card__result">{service.result}</p>
                          </div>
                          <div className="services-format-card__block">
                            <p className="services-format-card__label">Срок и общение</p>
                            <p className="services-format-card__text">{service.turnaround}</p>
                            <p className="services-format-card__text">{service.clarifications}</p>
                          </div>
                        </div>
                        <div className="services-format-card__footer">
                          <div className="hero-actions services-format-card__actions">
                            <Link className="button services-format-card__cta" href={serviceQuestionnaireHref(service.id) as Route}>
                              Выбрать формат
                            </Link>
                            <Link className="button button--secondary services-format-card__secondary-cta" href={`/services/${service.slug}` as Route}>
                              Подробнее о формате
                            </Link>
                          </div>
                          <p className="services-format-card__note">
                            Состав, возможность работы и стоимость согласуются до оплаты.
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <Section title="Чем отличаются три основных разбора">
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
      </Section>

      <Section title="Два этапа — когда они нужны">
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
      </Section>

      <Section title="Сроки и порядок работы">
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
