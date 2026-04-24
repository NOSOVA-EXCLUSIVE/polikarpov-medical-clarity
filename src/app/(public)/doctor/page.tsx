import Link from "next/link";

import { PageHero, Section } from "../../../components/public/shell";

const clinicalBenefits = [
  "не проходить лишние обследования",
  "избавиться от противоречивых диагнозов",
  "разобраться, что происходит на самом деле",
  "выбрать обоснованный следующий шаг"
];

const experienceItems: Array<{
  title: string;
  note?: string;
}> = [
  {
    title: "— Группа компаний «Мать и дитя» — федеральная сеть многопрофильных медицинских центров"
  },
  {
    title: "— НИИ скорой помощи им. Н. В. Склифосовского, Москва"
  },
  {
    title: "— Медицинский центр Управления делами Мэра и Правительства Москвы"
  },
  {
    title: "— Группа компаний «МЕДСИ», Москва"
  },
  {
    title: "— Клинико-диагностический центр, отделение травматологии и ортопедии"
  },
  {
    title: "— Центр магнитно-резонансной и компьютерной томографии «Сфера»"
  },
];

export default function DoctorPage() {
  return (
    <main className="doctor-page doctor-page--home-reference">
      <PageHero
        className="doctor-hero doctor-hero--home-reference"
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
          <span className="doctor-home-reference__title">
            <span className="doctor-home-reference__title-line">Поликарпов</span>
            <span className="doctor-home-reference__title-line">Евгений Сергеевич</span>
          </span>
        }
        description={
          <div className="doctor-home-reference__body stack-sm">
            <div className="doctor-home-reference__roles">
              <p>Травматолог-ортопед</p>
              <p>Врач магнитно-резонансной томографии</p>
              <p>Специалист по ударно-волновой терапии (УВТ)</p>
            </div>

            <p className="doctor-home-reference__statement">
              Профессиональный разбор сложных клинических ситуаций в травматологии
              и ортопедии
            </p>

            <div className="doctor-home-reference__lead">
              <p>
                <span className="doctor-home-reference__lead-line">
                  Когда уже есть диагнозы и обследования,
                </span>
                <span className="doctor-home-reference__lead-line">
                  но нет понимания, что делать дальше
                </span>
              </p>

              <p>
                <span className="doctor-home-reference__lead-line">
                  Задача — не просто дать мнение,
                </span>
                <span className="doctor-home-reference__lead-line">
                  а разобраться в ситуации и выстроить
                </span>
                <span className="doctor-home-reference__lead-line">
                  понятный профессиональный ориентир
                </span>
              </p>
            </div>
          </div>
        }
        actions={
          <>
            <Link className="button" href="/questionnaire">
              Разобрать мою ситуацию
            </Link>
            <Link className="button button--secondary" href="/services">
              Форматы помощи
            </Link>
          </>
        }
        aside={
          <div className="home-hero__portrait-wrap doctor-home-reference__portrait-wrap-home">
            <div className="home-hero__portrait-square doctor-home-reference__portrait-square-home">
              <img
                alt="Евгений Сергеевич Поликарпов"
                className="home-hero__portrait-image doctor-home-reference__portrait-image-home"
                src="/images/doctor/hero-portrait-transparent-20260410.png"
              />
            </div>
          </div>
        }
      />

      <section className="doctor-followup">
        <div className="container doctor-followup__grid">
          <article className="doctor-followup__card stack-sm">
            <p className="home-hero-panel__label">Почему обращаются</p>
            <h2 className="doctor-followup__title">Клиническая ясность в сложных случаях</h2>

            <div className="doctor-followup__copy">
              <p>
                Когда диагностическая картина становится неоднозначной, ключевым
                становится не дополнительное мнение, а точность интерпретации.
              </p>
              <p>
                Данный формат работы предполагает не расширение перечня
                рекомендаций, а глубокий аналитический разбор ситуации:
              </p>
            </div>

            <div className="doctor-followup__list">
              <p className="doctor-followup__list-item">
                — сопоставление данных МРТ, рентгенографии и общей картины ситуации
              </p>
              <p className="doctor-followup__list-item">
                — выявление несоответствий и диагностических ошибок
              </p>
              <p className="doctor-followup__list-item">
                — структурирование всей информации в единую логическую модель
              </p>
              <p className="doctor-followup__list-item">
                — формирование обоснованного следующего шага
              </p>
            </div>

            <div className="doctor-followup__copy">
              <p>
                Результат — это не набор рекомендаций, а ясное понимание
                происходящего и уверенность в дальнейшем решении.
              </p>
            </div>
          </article>

          <article className="doctor-followup__card doctor-followup__card--accent stack-sm">
            <p className="home-hero-panel__label">Клинический подход</p>
            <h2 className="doctor-followup__title">Клинический подход</h2>

            <div className="doctor-followup__copy">
              <p>
                Важно не просто увидеть изменения на снимках, а понять, как они
                связаны с Вашим состоянием.
              </p>
              <p>
                Поэтому обследования никогда не рассматриваются отдельно — они
                всегда сопоставляются с жалобами, симптомами и реальной
                картиной ситуации.
              </p>
            </div>

            <div className="doctor-followup__list">
              <p className="doctor-followup__list-item">Именно это даёт возможность:</p>
              {clinicalBenefits.map((item) => (
                <p key={item} className="doctor-followup__list-item">
                  — {item}
                </p>
              ))}
            </div>
          </article>
        </div>
      </section>

      <Section title="Профессиональный клинический путь">
        <div className="doctor-experience-shell stack">
          <p className="doctor-experience-shell__subtitle">
            Практика сформирована в ведущих медицинских учреждениях, где
            ключевое значение имеют точность диагностики и ответственность за
            клиническое решение.
          </p>

          <p className="doctor-experience-shell__intro">
            Профессиональный путь включает работу в:
          </p>

          <div className="doctor-experience-list">
            {experienceItems.map((item) => (
              <article key={item.title} className="doctor-experience-row stack-sm">
                <h3>{item.title}</h3>
                {item.note ? <p>{item.note}</p> : null}
              </article>
            ))}
          </div>

          <p className="doctor-experience-shell__closing">
            Более 20 лет практики в травматологии, ортопедии и МРТ-диагностике
          </p>

          <p className="doctor-experience-shell__accent">
            <strong>
              Опыт, на котором основаны клинические решения, а не предположения
            </strong>
          </p>
        </div>
      </Section>

      <Section title="Важно понимать">
        <div className="doctor-understand-card">
          <p>
            <strong>Это не стандартная консультация и не универсальные рекомендации.</strong>
          </p>
          <p>
            Каждый случай требует внимательного, индивидуального клинического
            разбора, где значение имеет не один симптом и не одно обследование, а
            вся картина целиком.
          </p>
          <p>
            В такой ситуации важно не просто получить ответ. Важно получить
            ясность, избежать неверных выводов и выбрать решение, основанное на
            медицинской логике, а не на предположениях.
          </p>
        </div>
      </Section>

      <section className="doctor-final-cta">
        <div className="container">
          <div className="doctor-final-cta__card doctor-final-cta__card--refined stack">
            <div className="stack-sm">
              <h2>
                <span className="doctor-final-cta__line">
                  Если для Вас важно не просто получить мнение, а разобраться в ситуации и
                </span>
                <span className="doctor-final-cta__line doctor-final-cta__line--nowrap">
                  понять, какой шаг действительно обоснован
                </span>
              </h2>
              <div className="doctor-final-cta__copy stack-sm">
                <p className="doctor-final-cta__line doctor-final-cta__line--nowrap">
                  Начать стоит с первичного профессионального разбора — именно на
                  этом этапе формируется ясность и определяется дальнейший маршрут.
                </p>
              </div>
            </div>

            <div className="stack-sm doctor-final-cta__actions">
              <div className="hero-actions">
                <Link className="button" href="/questionnaire">
                  Разобрать мою ситуацию
                </Link>
              </div>
              <p className="home-hero__micro-note doctor-final-cta__micro-note">
                Дистанционный формат взаимодействия. Конфиденциально. По делу.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
