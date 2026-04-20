import Link from "next/link";

import { Section } from "../../../components/public/shell";

const primaryFormats = [
  {
    title: "Экспертное второе мнение",
    href: "/questionnaire?product=second-opinion",
    situation: "Уже были у врачей, но ясности нет",
    action:
      "Разбор ситуации и обследований с объяснением, что происходит на самом деле и понятным планом действий",
    accent: "👉 когда важно принять решение, а не собирать ещё мнения",
    standardPrice: "5 900 ₽",
    currentPrice: "3 900 ₽",
    euroPrice: "≈ 40 €"
  },
  {
    title: "Клинический разбор ситуации",
    href: "/questionnaire?product=medical-route",
    situation: "Ситуация требует глубокого анализа",
    action:
      "Системный разбор всех данных с оценкой диагноза и выстраиванием тактики лечения",
    accent: "👉 когда нужно не мнение, а профессиональное решение",
    standardPrice: "9 000 ₽",
    currentPrice: "5 900 ₽",
    euroPrice: "≈ 60 €"
  }
] as const;

const premiumFormats = [
  {
    title: "Контроль восстановления",
    href: "/questionnaire?product=recovery-4-weeks",
    situation: "Лечение уже идёт, но есть сомнения",
    action:
      "Сопровождение на этапе восстановления под наблюдением врача — 4 недели",
    accent: "👉 когда важно пройти восстановление без ошибок",
    standardPrice: "45 000 ₽",
    currentPrice: "от 29 000 ₽",
    euroPrice: "≈ 300 €",
    extraPriceNote:
      "Точная стоимость определяется после первичного разбора и зависит от сложности ситуации",
    premiumNote:
      "Формат подходит для пациентов, готовых следовать рекомендациям врача и участвовать в процессе восстановления. В отдельных случаях формат может быть не рекомендован."
  },
  {
    title: "Индивидуальное сопровождение",
    href: "/questionnaire?product=personal-support",
    situation: "Сложный или чувствительный случай",
    action:
      "Поддержка и контроль состояния пациента в формате наблюдения — 4 недели",
    accent: "👉 когда требуется внимание и стабильный контроль",
    standardPrice: "75 000 ₽",
    currentPrice: "от 50 000 ₽",
    euroPrice: "≈ 520 €",
    extraPriceNote: "Стоимость определяется индивидуально после оценки состояния пациента",
    premiumNote:
      "Формат подходит для пациентов, готовых следовать рекомендациям врача и участвовать в процессе восстановления. В отдельных случаях формат может быть не рекомендован."
  }
] as const;

export default function ServicesPage() {
  return (
    <main className="services-page">
      <section className="section services-page__simple-intro">
        <div className="container stack">
          <div className="section-heading stack-sm">
            <h1 className="services-page__title">Форматы помощи</h1>
            <p className="lead">
              Выберите формат в зависимости от вашей ситуации.
              <br />
              Каждый из них решает конкретную задачу.
            </p>
          </div>

          <div className="services-groups stack">
            <section className="services-group services-group--primary" aria-label="Базовые форматы помощи">
              <div className="services-formats-grid">
                {primaryFormats.map((format) => (
                  <article key={format.title} className="services-format-card">
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
                    </div>

                    <div className="services-format-card__footer">
                      <div className="services-format-card__price-block">
                        <p className="services-format-card__price-copy">
                          Стандартная стоимость:{" "}
                          <span className="services-format-card__price-old">{format.standardPrice}</span>
                        </p>
                        <p className="services-format-card__price-copy">
                          Стоимость: <span className="services-format-card__price-new">{format.currentPrice}</span>
                        </p>
                        <p className="services-format-card__price-rubles">{format.euroPrice}</p>
                      </div>

                      <Link className="button services-format-card__cta" href={format.href}>
                        Заполнить анкету
                      </Link>
                      <p className="services-format-card__note">
                        Анкета необходима для анализа ситуации и подбора оптимального формата помощи
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="services-group services-group--premium" aria-label="Расширенные форматы помощи">
              <div className="services-formats-grid">
                {premiumFormats.map((format) => (
                  <article key={format.title} className="services-format-card">
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
                        <p className="services-format-card__text">{format.extraPriceNote}</p>
                        <p className="services-format-card__text">{format.premiumNote}</p>
                      </div>
                    </div>

                    <div className="services-format-card__footer">
                      <div className="services-format-card__price-block">
                        <p className="services-format-card__price-copy">
                          Стандартная стоимость:{" "}
                          <span className="services-format-card__price-old">{format.standardPrice}</span>
                        </p>
                        <p className="services-format-card__price-copy">
                          Стоимость: <span className="services-format-card__price-new">{format.currentPrice}</span>
                        </p>
                        <p className="services-format-card__price-rubles">{format.euroPrice}</p>
                      </div>

                      <Link className="button services-format-card__cta" href={format.href}>
                        Заполнить анкету
                      </Link>
                      <p className="services-format-card__note">
                        Анкета необходима для анализа ситуации и подбора оптимального формата помощи
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="section services-final-cta">
        <div className="container">
          <div className="services-final-cta__card stack">
            <div className="services-final-cta__copy stack-sm">
              <h2>
                <span className="services-final-cta__line">Если важно не просто получить мнение,</span>
                <span className="services-final-cta__line">
                  а выбрать действительно уместный формат помощи
                </span>
              </h2>
            </div>

            <div className="services-final-cta__actions stack-sm">
              <div className="hero-actions">
                <Link className="button" href="/questionnaire">
                  Перейти к анкете пациента
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
