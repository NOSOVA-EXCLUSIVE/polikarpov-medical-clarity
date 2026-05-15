import Link from "next/link";

import { PageHero, Section } from "../../components/public/shell";
import type { Route } from "next";

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Экспертное второе мнение и клинический разбор",
  description:
    "Polikarpov Medical Clarity — экспертное второе мнение, дистанционный клинический разбор и профессиональная интерпретация МРТ, КТ и медицинских материалов у травматолога-ортопеда.",
  path: "/"
});

const doctorDocumentsHref = "/doctor/documents" satisfies Route;

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
    situation: "Восстановление уже идёт, но есть сомнения",
    action:
      "Последовательное профессиональное сопровождение на этапе восстановления — 4 недели",
    accent: "👉 когда важно пройти восстановление без ошибок"
  },
  {
    title: "Индивидуальное сопровождение",
    detailHref: "/services/personal-support",
    situation: "Сложный или чувствительный случай",
    action:
      "Последовательное профессиональное сопровождение — 4 недели",
    accent: "👉 когда требуется внимание и последовательное сопровождение"
  }
];
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
    title: "Разбор ситуации",
    lines: [
      "Вы отправляете анкету и материалы",
      "для предварительного анализа"
    ],
    accent: "👉 чтобы начать с понятной исходной картины"
  },
  {
    number: "Этап II",
    title: "Подтверждение формата",
    lines: [
      "После анализа врач уточняет,",
      "уместен ли дистанционный формат в вашем случае"
    ],
    accent: "👉 чтобы двигаться дальше только в подходящем формате"
  },
  {
    number: "Этап III",
    title: "Согласование работы",
    lines: [
      "Если формат подходит, согласуются условия",
      "и следующий этап взаимодействия"
    ],
    accent: "👉 чтобы дальше было спокойно и предсказуемо"
  },
  {
    number: "Этап IV",
    title: "Профессиональный ориентир",
    lines: [
      "По итогам вы получаете более ясное понимание",
      "ситуации и дальнейших шагов"
    ],
    accent: "👉 чтобы принять более спокойное и обоснованное решение"
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
            <Link className="button" href="/questionnaire">
              Разобрать мою ситуацию
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
                <p>Специалист по ударно-волновой терапии</p>
              </div>
              <div className="home-summary-copy">
                <p>
                  Профессиональный профиль — разбор сложных ситуаций, когда важно не
                  просто получить ещё одно мнение, а спокойнее и точнее понять
                    более ясную логику происходящего.
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

      <Section title="Форматы помощи">
        <div className="home-formats-shell stack">
          <p className="home-formats-shell__lead">
            <span className="home-formats-shell__lead-line">
              Выберите формат в зависимости от вашей ситуации:
            </span>
            <span className="home-formats-shell__lead-line">
              если уже есть врачебные мнения — можно начать со второго мнения;
            </span>
            <span className="home-formats-shell__lead-line">
              если важно глубже разобраться в ситуации — подойдёт клинический разбор;
            </span>
            <span className="home-formats-shell__lead-line">
              если восстановление уже идёт — формат контроля восстановления;
            </span>
            <span className="home-formats-shell__lead-line">
              если нужен более внимательный и длительный формат взаимодействия —
              индивидуальное сопровождение.
            </span>
          </p>
          <div className="home-formats-grid">
            {assistanceFormats.map((item) => (
              <article key={item.title} className="home-format-card">
                <Link
                  aria-label={`Подробнее о формате: ${item.title}`}
                  className="home-format-card__overlay"
                  href={item.detailHref as Route}
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
            Если вы не уверены, с чего начать, оптимальный формат уточняется после
            анализа анкеты и материалов.
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
              <h2>
                Если для вас важно не просто получить мнение, а спокойнее разобраться
                в ситуации и понять, какой шаг действительно уместен
              </h2>
              <div className="home-final-cta__copy">
                <p>
                  Начать можно с анкеты пациента — это первый шаг, после которого
                  становится понятнее, возможен ли дистанционный формат и каким может
                  быть дальнейший маршрут.
                </p>
              </div>
            </div>

            <div className="stack-sm home-final-cta__actions">
              <div className="hero-actions">
                <Link className="button" href="/questionnaire">
                  Разобрать мою ситуацию
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

