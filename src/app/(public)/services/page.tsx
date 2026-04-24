import Link from "next/link";

import { Section } from "../../../components/public/shell";
import type { Route } from "next";

const primaryFormats = [
  {
    title: "Экспертное второе мнение",
    href: "/questionnaire?product=second-opinion",
    detailHref: "/services/second-opinion",
    situation: "Когда уже были у врачей, но нет ясности.",
    action:
      "Врач анализирует заключения, обследования и уже полученные мнения, сравнивает их между собой и помогает выстроить понятную логику дальнейших шагов.",
    accent: "👉 Когда есть несколько мнений, но нет уверенного решения",
    priceLead: "Оптимальный формат для решения задачи",
    standardPrice: "5 900 ₽",
    currentPrice: "3 900 ₽",
    euroPrice: "≈ 40 €",
    result: "Вы понимаете, что происходит и что делать дальше."
  },
  {
    title: "Клинический разбор ситуации",
    href: "/questionnaire?product=medical-route",
    detailHref: "/services/clinical-review",
    situation: "Когда важно понять, какой следующий шаг действительно уместен.",
    action:
      "Врач анализирует жалобы, симптомы и обследования, сопоставляет данные МРТ / КТ / рентгена с жалобами и текущей ситуацией и помогает выстроить понятную логику дальнейших шагов.",
    accent: "👉 Когда нужен не просто ответ, а профессионально выстроенный следующий шаг",
    priceLead: "Оптимальный формат для решения задачи",
    standardPrice: "9 000 ₽",
    currentPrice: "5 900 ₽",
    euroPrice: "≈ 60 €",
    result: "Вы получаете понятный ориентир по дальнейшим шагам."
  }
] as const;

const premiumFormats = [
  {
    status: "Расширенный формат работы",
    title: "Контроль восстановления",
    href: "/questionnaire?product=recovery-4-weeks",
    detailHref: "/services/recovery-control",
    situation: "Когда восстановление уже идёт и важно понимать динамику и дальнейшие шаги.",
    action:
      "Врач помогает интерпретировать динамику восстановления, сопоставляет жалобы, этап восстановления и текущие изменения и даёт рекомендации по дальнейшим шагам.",
    accent: "👉 Когда важно не упустить детали в процессе восстановления и реабилитации",
    priceLead: "Оптимальный формат для решения задачи",
    standardPrice: "45 000 ₽",
    currentPrice: "от 29 000 ₽",
    euroPrice: "≈ 300 €",
    result: "Восстановление становится более понятным и последовательным.",
    premiumDepth:
      "Формат предполагает более глубокую работу и регулярное взаимодействие с врачом",
    extraPriceNote:
      "Точная стоимость определяется после первичного разбора и зависит от сложности ситуации",
    premiumNote:
      "Формат предполагает активное участие пациента и соблюдение рекомендаций врача. Врач оставляет за собой право не рекомендовать данный формат в отдельных случаях."
  },
  {
    status: "Расширенный формат работы",
    title: "Индивидуальное сопровождение",
    href: "/questionnaire?product=personal-support",
    detailHref: "/services/personal-support",
    situation: "Когда случай требует более глубокого и длительного внимания.",
    action:
      "Врач помогает разбирать изменения в состоянии, анализирует динамику и даёт рекомендации по дальнейшим шагам в рамках согласованного формата.",
    accent:
      "👉 Когда нужна не разовая консультация, а более внимательное сопровождение в рамках согласованного формата",
    priceLead: "Оптимальный формат для решения задачи",
    standardPrice: "75 000 ₽",
    currentPrice: "от 50 000 ₽",
    euroPrice: "≈ 520 €",
    result:
      "Ситуация пациента находится в поле последовательного профессионального сопровождения.",
    premiumDepth:
      "Формат предполагает более глубокую работу и регулярное взаимодействие с врачом",
    extraPriceNote:
      "Стоимость определяется индивидуально после оценки состояния пациента",
    premiumNote:
      "Формат предполагает активное участие пациента и соблюдение рекомендаций врача. Врач оставляет за собой право не рекомендовать данный формат в отдельных случаях."
  }
] as const;

const orientationScenarios = [
  {
    title: "Если важно понять, что происходит",
    answer: "→ клинический разбор"
  },
  {
    title: "Если уже есть мнения, но нет ясности",
    answer: "→ второе мнение"
  },
  {
    title: "Если важно обсудить динамику восстановления",
    answer: "→ сопровождение"
  },
  {
    title: "Если не уверены",
    answer: "→ начните с анкеты"
  }
] as const;

export default function ServicesPage() {
  return (
    <main className="services-page">
      <section className="section services-page__simple-intro">
        <div className="container stack">
          <div className="section-heading stack-sm">
            <h1 className="services-page__title">Форматы помощи</h1>
          </div>

          <div className="stack-sm">
            <div className="services-page__intro-copy">
              <p>
                Вам не нужно угадывать, какой формат выбрать. Каждый из них решает
                конкретную задачу.
              </p>
            </div>
            <p className="services-page__orientation-label">Как выбрать формат</p>
            <h2 className="services-page__orientation-title">
              Как выбрать формат и с чего начать
            </h2>
            <div className="services-orientation-grid">
              {orientationScenarios.map((item) => (
                <article key={item.title} className="services-orientation-card">
                  <h3>{item.title}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
            <p className="services-orientation-note">
              Анкета — обязательный этап, который позволяет точно понять вашу ситуацию и
              выбрать корректный формат помощи.
              <br />
              Без анкеты работа не начинается.
            </p>
          </div>

          <div className="services-groups stack">
            <section
              className="services-group services-group--primary"
              aria-label="Базовые форматы помощи"
            >
              <div className="services-formats-grid">
                {primaryFormats.map((format) => (
                  <article key={format.title} className="services-format-card">
                    <Link
                      aria-label={`Подробнее о формате: ${format.title}`}
                      className="services-format-card__overlay"
                      href={format.detailHref as Route}
                    >
                      Подробнее о формате: {format.title}
                    </Link>
                    <h2 className="services-format-card__title">{format.title}</h2>

                    <div className="services-format-card__body">
                      <div className="services-format-card__block">
                        <p className="services-format-card__label">Ситуация пациента</p>
                        <p className="services-format-card__situation">{format.situation}</p>
                      </div>
                      <div className="services-format-card__block">
                        <p className="services-format-card__label">Что делает врач</p>
                        <p className="services-format-card__action">{format.action}</p>
                      </div>
                      <div className="services-format-card__block">
                        <p className="services-format-card__label">Когда это нужно</p>
                        <p className="services-format-card__accent">{format.accent}</p>
                      </div>
                      <div className="services-format-card__block">
                        <p className="services-format-card__result">{format.result}</p>
                      </div>
                    </div>

                    <div className="services-format-card__footer">
                      <div className="services-format-card__price-block">
                        <p className="services-format-card__price-lead">{format.priceLead}</p>
                        <p className="services-format-card__price-copy">
                          Стандартная стоимость:{" "}
                          <span className="services-format-card__price-old">
                            {format.standardPrice}
                          </span>
                        </p>
                        <p className="services-format-card__price-copy">
                          Стоимость:{" "}
                          <span className="services-format-card__price-new">
                            {format.currentPrice}
                          </span>
                        </p>
                        <p className="services-format-card__price-rubles">{format.euroPrice}</p>
                      </div>

                      <div className="hero-actions services-format-card__actions">
                        <Link className="button services-format-card__cta" href={format.href}>
                          Разобрать мою ситуацию
                        </Link>
                        <Link
                          className="button button--secondary services-format-card__secondary-cta"
                          href={format.detailHref as Route}
                        >
                          Подробнее о формате
                        </Link>
                      </div>
                      <p className="services-format-card__note">
                        Анкета — обязательный этап перед началом работы
                      </p>
                      <p className="services-format-card__hint">
                        Нажмите, чтобы подробнее понять формат
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section
              className="services-group services-group--premium"
              aria-label="Расширенные форматы помощи"
            >
              <div className="services-formats-grid">
                {premiumFormats.map((format) => (
                  <article key={format.title} className="services-format-card">
                    <Link
                      aria-label={`Подробнее о формате: ${format.title}`}
                      className="services-format-card__overlay"
                      href={format.detailHref as Route}
                    >
                      Подробнее о формате: {format.title}
                    </Link>
                    <p className="services-format-card__status">{format.status}</p>
                    <h2 className="services-format-card__title">{format.title}</h2>

                    <div className="services-format-card__body">
                      <div className="services-format-card__block">
                        <p className="services-format-card__label">Ситуация пациента</p>
                        <p className="services-format-card__situation">{format.situation}</p>
                      </div>
                      <div className="services-format-card__block">
                        <p className="services-format-card__label">Что делает врач</p>
                        <p className="services-format-card__action">{format.action}</p>
                      </div>
                      <div className="services-format-card__block">
                        <p className="services-format-card__label">Когда это нужно</p>
                        <p className="services-format-card__accent">{format.accent}</p>
                      </div>
                      <div className="services-format-card__block">
                        <p className="services-format-card__result">{format.result}</p>
                      </div>
                      <div className="services-format-card__block">
                        <p className="services-format-card__result-note">{format.premiumDepth}</p>
                      </div>
                      <div className="services-format-card__block">
                        <p className="services-format-card__text">{format.extraPriceNote}</p>
                        <p className="services-format-card__text">{format.premiumNote}</p>
                      </div>
                    </div>

                    <div className="services-format-card__footer">
                      <div className="services-format-card__price-block">
                        <p className="services-format-card__price-lead">{format.priceLead}</p>
                        <p className="services-format-card__price-copy">
                          Стандартная стоимость:{" "}
                          <span className="services-format-card__price-old">
                            {format.standardPrice}
                          </span>
                        </p>
                        <p className="services-format-card__price-copy">
                          Стоимость:{" "}
                          <span className="services-format-card__price-new">
                            {format.currentPrice}
                          </span>
                        </p>
                        <p className="services-format-card__price-rubles">{format.euroPrice}</p>
                      </div>

                      <div className="hero-actions services-format-card__actions">
                        <Link className="button services-format-card__cta" href={format.href}>
                          Разобрать мою ситуацию
                        </Link>
                        <Link
                          className="button button--secondary services-format-card__secondary-cta"
                          href={format.detailHref as Route}
                        >
                          Подробнее о формате
                        </Link>
                      </div>
                      <p className="services-format-card__note">
                        Анкета — обязательный этап перед началом работы
                      </p>
                      <p className="services-format-card__hint">
                        Нажмите, чтобы подробнее понять формат
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <p className="services-formats-shell__note">
            Формат работы определяется после первичного разбора ситуации. Дистанционный формат взаимодействия не
            заменяет очный приём врача при необходимости.
          </p>
        </div>
      </section>

      <section className="section services-final-cta">
        <div className="container">
          <div className="services-final-cta__card stack">
            <div className="services-final-cta__copy stack-sm">
              <h2>
                <span className="services-final-cta__line">
                  Если важно не просто получить мнение,
                </span>
                <span className="services-final-cta__line">
                  а выбрать действительно уместный формат помощи
                </span>
              </h2>
              <p className="services-final-cta__lead">Работа начинается с анкеты пациента</p>
              <p className="services-final-cta__lead">
                Вы получите понимание ситуации и дальнейших шагов после анализа анкеты
              </p>
            </div>

            <div className="services-final-cta__actions stack-sm">
              <p className="services-final-cta__subnote">
                Заполнение анкеты занимает 5–7 минут
              </p>
              <div className="hero-actions">
                <Link className="button" href="/questionnaire">
                  Разобрать мою ситуацию
                </Link>
              </div>
              <p className="services-final-cta__micro-note">
                Конфиденциально. Спокойно. По существу.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
