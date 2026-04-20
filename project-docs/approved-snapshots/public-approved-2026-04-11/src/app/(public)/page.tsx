import Link from "next/link";

import { PageHero, Section } from "../../components/public/shell";

const assistanceFormats = [
  {
    href: "/services/second-opinion",
    title: "Экспертное второе мнение",
    lines: [
      "Разбор ситуации и обследований",
      "с объяснением, что происходит на самом деле,",
      "и понятным планом дальнейших действий"
    ],
    accent: "👉 когда важно принять решение, а не собирать ещё мнения"
  },
  {
    href: "/services/medical-route",
    title: "Клинический разбор ситуации",
    lines: [
      "Системный анализ всех данных",
      "и определение оптимальной тактики лечения"
    ],
    accent: "👉 когда нужно выбрать правильный путь, а не сомневаться"
  },
  {
    href: "/services/recovery-4-weeks",
    title: "Контроль восстановления",
    lines: [
      "Сопровождение на этапе лечения и реабилитации",
      "под наблюдением врача — 4 недели"
    ],
    accent: "👉 когда важно пройти восстановление без ошибок"
  },
  {
    href: "/services/personal-support",
    title: "Индивидуальное сопровождение",
    lines: [
      "Поддержка сложных или пожилых пациентов",
      "с контролем состояния — 4 недели"
    ],
    accent: "👉 для ситуаций, где требуется особое внимание и стабильный контроль"
  }
];

const clinicalExperience = [
  ["Группа компаний «Мать и дитя» — федеральная многопрофильная медицинская сеть России"],
  ["Научно-исследовательский институт скорой помощи", "имени Н. В. Склифосовского, Москва"],
  ["Медицинский центр Управления делами Мэра", "и Правительства Москвы"],
  ["Группа компаний МЕДСИ, Москва"],
  ["Клинико-диагностический центр,", "отделение травматологии и ортопедии, Москва"],
  ["Медицинский центр «Сфера»"]
];

const workSteps = [
  {
    number: "Этап I",
    title: "Разбор ситуации",
    lines: ["Вы отправляете жалобы и обследования", "(МРТ, рентген и другие материалы)"],
    accent: "👉 чтобы не упустить важное и не ошибиться в решении"
  },
  {
    number: "Этап II",
    title: "Клинический анализ",
    lines: ["Проводится системный разбор данных", "с оценкой диагноза и текущей ситуации"],
    accent: "👉 чтобы понять, что действительно происходит"
  },
  {
    number: "Этап III",
    title: "Заключение врача",
    lines: ["Вы получаете понятное объяснение", "и обоснованный план лечения"],
    accent: "👉 и понимание, какой шаг действительно нужен дальше"
  },
  {
    number: "Этап IV",
    title: "При необходимости — сопровождение",
    lines: [
      "Можно продолжить работу в формате наблюдения",
      "и контроля восстановления"
    ],
    accent: "👉 если важно пройти восстановление без ошибок"
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
              <span className="home-hero__title-line">Профессиональный разбор</span>
              <span className="home-hero__title-line">сложной ситуации</span>
              <span className="home-hero__title-line">в травматологии и ортопедии</span>
            </span>
            <span className="home-hero__title-main">
              <span className="home-hero__title-line">
                Когда важно не просто мнение, а понять,
              </span>
              <span className="home-hero__title-line">что происходит на самом деле</span>
              <span className="home-hero__title-line">и получить чёткий план лечения</span>
            </span>
          </>
        }
        description={
          <div className="home-hero__description-copy">
            Системный клинический разбор ситуации
            <br />
            с объединением всех данных в единую медицинскую логику
            <br />
            и формированием точного, обоснованного плана лечения
          </div>
        }
        supportingContent={
          <div className="home-hero__points">
            <p className="home-hero__points-title">Здесь:</p>
            <div className="home-hero__points-list">
              <p>— разбирают конкретный случай, а не «общие рекомендации»</p>
              <p>— устраняют противоречия в диагнозах</p>
              <p>— объясняют, что действительно происходит</p>
              <p>— дают точный и обоснованный план действий</p>
            </div>
          </div>
        }
        actions={
          <>
            <Link className="button" href="/questionnaire">
              Разобрать мою ситуацию
            </Link>
            <Link className="button button--secondary" href="/#how-it-works">
              Как проходит консультация
            </Link>
          </>
        }
        afterActions={<p className="home-hero__micro-note">Онлайн-консультация. Конфиденциально. По делу.</p>}
        aside={
          <div className="home-hero__portrait-wrap">
            <div className="home-hero__portrait-square">
              <img
                alt="Евгений Сергеевич Поликарпов"
                className="home-hero__portrait-image"
                src="/images/doctor/hero-portrait-transparent-20260410.png"
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
                <p>Специалист по ударно-волновой терапии (УВТ)</p>
              </div>
              <div className="home-summary-copy">
                <p>
                  Специализируется на разборе сложных клинических ситуаций,
                  <br />
                  когда диагнозы и мнения уже есть,
                  <br />
                  но нет понимания, что делать дальше.
                </p>
                <p>
                  Работает с обследованиями (МРТ, рентген),
                  <br />
                  сопоставляя данные с клинической картиной
                  <br />
                  и выстраивая обоснованный план лечения.
                </p>
                <p>
                  Это не поток консультаций,
                  <br />
                  а спокойный индивидуальный разбор ситуации,
                  <br />
                  в котором важно точно понять происходящее
                  <br />
                  и принять правильное решение.
                </p>
                <p className="home-summary-copy__emphasis">В ситуациях, где важно не ошибиться.</p>
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
                Клиническая практика в травматологии, ортопедии и МРТ-диагностике
              </p>
            </div>
          </article>
        </div>
      </section>

      <Section title="Форматы помощи">
        <div className="home-formats-shell stack">
          <p className="home-formats-shell__lead">
            Выберите формат, если хотите не просто мнение, а чёткое понимание ситуации и правильный следующий шаг
          </p>
          <div className="home-formats-grid">
            {assistanceFormats.map((item) => (
              <Link key={item.href} className="home-format-card" href={item.href}>
                <h3 className="home-format-card__title">{item.title}</h3>
                <div className="home-format-card__copy">
                  {item.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <p className="home-format-card__accent">{item.accent}</p>
              </Link>
            ))}
          </div>
          <p className="home-formats-shell__note">Формат помощи определяется после первичного разбора</p>
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
              <h2>Если вы дочитали до этого места, значит ситуация действительно требует ясности</h2>
              <div className="home-final-cta__copy">
                <p>
                  <span className="home-final-cta__line">
                    Вы можете продолжать собирать мнения или спокойно разобраться и понять, что происходит на самом деле
                  </span>
                  <span className="home-final-cta__line">
                    Начать можно с первичного разбора ситуации — это точка, где появляется понимание и становится ясно, какой шаг действительно нужен
                  </span>
                </p>
              </div>
            </div>

            <div className="stack-sm home-final-cta__actions">
              <div className="hero-actions">
                <Link className="button" href="/questionnaire">
                  Разобрать мою ситуацию
                </Link>
              </div>
              <p className="home-hero__micro-note">Онлайн-консультация. Конфиденциально. Профессионально.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
