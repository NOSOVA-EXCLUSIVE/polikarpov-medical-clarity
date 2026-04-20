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
    euroPrice: "≈ 40 €",
    result: "Результат: вы поймёте, что происходит и что делать дальше"
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
    euroPrice: "≈ 60 €",
    result: "Результат: вы получите чёткую тактику лечения"
  }
] as const;

const premiumFormats = [
  {
    status: "Расширенный формат работы",
    title: "Контроль восстановления",
    href: "/questionnaire?product=recovery-4-weeks",
    situation: "Лечение уже идёт, но есть сомнения",
    action:
      "Сопровождение на этапе восстановления под наблюдением врача — 4 недели",
    accent: "👉 когда важно пройти восстановление без ошибок",
    standardPrice: "45 000 ₽",
    currentPrice: "от 29 000 ₽",
    euroPrice: "≈ 300 €",
    result: "Результат: вы пройдёте восстановление без ошибок",
    premiumDepth: "Формат предполагает более глубокую работу и регулярное взаимодействие с врачом",
    extraPriceNote:
      "Точная стоимость определяется после первичного разбора и зависит от сложности ситуации",
    premiumNote:
      "Формат предполагает активное участие пациента и соблюдение рекомендаций врача. Врач оставляет за собой право не рекомендовать данный формат в отдельных случаях."
  },
  {
    status: "Расширенный формат работы",
    title: "Индивидуальное сопровождение",
    href: "/questionnaire?product=personal-support",
    situation: "Сложный или чувствительный случай",
    action:
      "Поддержка и контроль состояния пациента в формате наблюдения — 4 недели",
    accent: "👉 когда требуется внимание и стабильный контроль",
    standardPrice: "75 000 ₽",
    currentPrice: "от 50 000 ₽",
    euroPrice: "≈ 520 €",
    result: "Результат: состояние пациента будет под системным контролем",
    premiumDepth: "Формат предполагает более глубокую работу и регулярное взаимодействие с врачом",
    extraPriceNote: "Стоимость определяется индивидуально после оценки состояния пациента",
    premiumNote:
      "Формат предполагает активное участие пациента и соблюдение рекомендаций врача. Врач оставляет за собой право не рекомендовать данный формат в отдельных случаях."
  }
] as const;

const orientationScenarios = [
  {
    title: "Если важно понять, что происходит",
    answer: "👉 Оптимально: клинический разбор"
  },
  {
    title: "Если нужен маршрут и система шагов",
    answer: "👉 Оптимально: сопровождение"
  },
  {
    title: "Если случай сложный и неочевидный",
    answer: "👉 Оптимально: сначала анкета и индивидуальный подбор"
  },
  {
    title: "Если не уверены",
    answer: "👉 Оптимально: начать с анкеты пациента"
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

          <div className="stack-sm">
            <p className="services-page__orientation-label">Как выбрать формат</p>
            <h2 className="services-page__orientation-title">Как выбрать формат и с чего начать</h2>
            <div className="services-orientation-grid">
              {orientationScenarios.map((item) => (
                <article key={item.title} className="services-orientation-card">
                  <h3>{item.title}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
            <p className="services-orientation-note">
              Анкета — обязательный этап, который позволяет точно понять вашу ситуацию и выбрать корректный формат помощи.
              <br />
              Без анкеты работа не начинается.
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
                      <div className="services-format-card__block">
                        <p className="services-format-card__result">{format.result}</p>
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
                        Анкета — обязательный этап перед началом работы
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
                        Анкета — обязательный этап перед началом работы
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
                <span className="services-final-cta__line">а выбрать действительно уместный формат помощи</span>
              </h2>
              <p className="services-final-cta__lead">Работа начинается с анкеты пациента</p>
              <p className="services-final-cta__lead">Вы получите понимание ситуации и дальнейших шагов после анализа анкеты</p>
            </div>

            <div className="services-final-cta__actions stack-sm">
              <p className="services-final-cta__subnote">Заполнение анкеты занимает 5–7 минут</p>
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
