import Link from "next/link";

import { PageHero, Section } from "../../components/public/shell";

const assistanceFormats = [
  {
    title: "Экспертное второе мнение",
    detailHref: "/services/second-opinion",
    situation: "Уже были у врачей, но ясности нет",
    action:
      "Разбор ситуации и обследований с объяснением, что происходит на самом деле и понятным планом действий",
    accent: "👉 когда важно принять решение, а не собирать ещё мнения"
  },
  {
    title: "Клинический разбор ситуации",
    detailHref: "/services/clinical-review",
    situation: "Ситуация требует глубокого анализа",
    action:
      "Системный разбор всех данных с сопоставлением уже имеющихся заключений и определением дальнейшего маршрута",
    accent: "👉 когда нужно не мнение, а профессиональное решение"
  },
  {
    title: "Контроль восстановления",
    detailHref: "/services/recovery-control",
    situation: "Лечение уже идёт, но есть сомнения",
    action:
      "Сопровождение на этапе восстановления под наблюдением врача — 4 недели",
    accent: "👉 когда важно пройти восстановление без ошибок"
  },
  {
    title: "Индивидуальное сопровождение",
    detailHref: "/services/personal-support",
    situation: "Сложный или чувствительный случай",
    action:
      "Поддержка и контроль состояния пациента в формате наблюдения — 4 недели",
    accent: "👉 когда требуется внимание и стабильный контроль"
  }
];
const clinicalExperience = [
  ["Группа компаний «Мать и дитя» — федеральная многопрофильная медицинская сеть России"],
  ["Научно-исследовательский институт скорой помощи", "имени Н. В. Склифосовского, Москва"],
  ["Медицинский центр Управления делами Мэра", "и Правительства Москвы"],
  ["Группа компаний МЕДСИ, Москва"],
  ["Клинико-диагностический центр,", "отделение травматологии и ортопедии, Москва"],
  ["Центр магнитно-резонансной и компьютерной томографии «Сфера»"]
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
    lines: ["Проводится системный разбор данных", "с анализом уже имеющихся данных и текущей ситуации"],
    accent: "👉 чтобы понять, что действительно происходит"
  },
  {
    number: "Этап III",
    title: "Заключение врача",
    lines: ["Вы получаете понятное объяснение", "и понятный следующий шаг"],
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
              <span className="home-hero__title-line">сложных ситуаций</span>
              <span className="home-hero__title-line">в травматологии и ортопедии</span>
            </span>
            <span className="home-hero__title-main">
              <span className="home-hero__title-line">
                Когда важно не просто мнение, а понять,
              </span>
              <span className="home-hero__title-line">что происходит на самом деле</span>
              <span className="home-hero__title-line">и получить понятный ориентир по</span>
              <span className="home-hero__title-line">дальнейшим шагам</span>
            </span>
          </>
        }
        description={
          <div className="home-hero__description-copy">
            Системный профессиональный разбор ситуации
            <br />
            с объединением всех данных в единую медицинскую логику
            <br />
            и формированием понятного, обоснованного следующего шага
          </div>
        }
        supportingContent={
          <div className="home-hero__points">
            <p className="home-hero__points-title">Здесь:</p>
            <div className="home-hero__points-list">
              <p>— разбирают конкретный случай, а не «общие рекомендации»</p>
              <p>— помогают разобраться в расхождениях между мнениями и заключениями</p>
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
              Как проходит разбор ситуации
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
                  и помогая определить обоснованный дальнейший маршрут.
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
            <span className="home-formats-shell__lead-line">
              Выберите формат в зависимости от вашей ситуации
            </span>
            <span className="home-formats-shell__lead-line">
              каждый из них решает конкретную задачу
            </span>
          </p>
          <div className="home-formats-grid">
            {assistanceFormats.map((item) => (
              <article key={item.title} className="home-format-card">
                <Link
                  aria-label={`Подробнее о формате: ${item.title}`}
                  className="home-format-card__overlay"
                  href={item.detailHref}
                >
                  Подробнее о формате: {item.title}
                </Link>
                <h3 className="home-format-card__title">{item.title}</h3>
                <div className="home-format-card__body">
                  <div className="home-format-card__block">
                    <p className="home-format-card__label">Ситуация</p>
                    <p className="home-format-card__situation">{item.situation}</p>
                  </div>
                  <div className="home-format-card__block">
                    <p className="home-format-card__label">Что делает врач</p>
                    <p className="home-format-card__action">{item.action}</p>
                  </div>
                  <div className="home-format-card__block">
                    <p className="home-format-card__label">Когда это нужно</p>
                    <p className="home-format-card__accent">{item.accent}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="home-formats-shell__note">
            Формат работы определяется после первичного разбора ситуации. Онлайн-разбор не
            заменяет очный приём врача при необходимости.
          </p>
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
              <p className="home-hero__micro-note">
                Формат и возможность онлайн-разбора уточняются после анализа анкеты и материалов.
              </p>
              <p className="home-hero__micro-note">
                Окончательные решения о лечении принимаются совместно с лечащим врачом.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

