import type { Metadata } from "next";

import { PageHero, Section } from "@/components/public/shell";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Документы и квалификация врача",
  description:
    "Профессиональная квалификация, образование, клинический опыт и действующая аккредитация Евгения Сергеевича Поликарпова.",
  path: "/doctor/documents"
});

const practiceDirections = [
  {
    title: "Травматология и ортопедия",
    description: "Разбор истории травмы или ортопедической проблемы: жалоб, обследований, этапов лечения и текущих ограничений. Помощь в определении обоснованного следующего шага."
  },
  {
    title: "МРТ-диагностика",
    description: "Работа с МРТ-материалами в контексте ортопедической задачи с учётом качества исследования и возможностей дистанционной оценки."
  },
  {
    title: "Анализ и интерпретация МРТ-исследований",
    description: "Сопоставление изображений и заключений с жалобами и медицинской историей. Понятное объяснение находок, расхождений и ограничений оценки."
  },
  {
    title: "Экспертное второе мнение",
    description: "Независимое изучение имеющихся материалов, разбор различий в заключениях и подготовка обоснованных вопросов для обсуждения с лечащим врачом."
  },
  {
    title: "Восстановительное сопровождение",
    description: "Обсуждение динамики восстановления по материалам пациента в рамках согласованных плановых контактов. Последовательное уточнение контрольных точек и вопросов к лечащему врачу."
  },
  {
    title: "Консервативная терапия",
    description: "Разбор уже полученных рекомендаций по консервативному лечению и восстановлению, их места в общей истории и вопросов для дальнейшего обсуждения с лечащим врачом."
  }
];

const institutions = [
  "Группа компаний «Мать и дитя» — федеральная сеть многопрофильных медицинских центров",
  "Научно-исследовательский институт скорой помощи имени Н. В. Склифосовского, Москва",
  "Медицинский центр Управления делами Мэра и Правительства Москвы",
  "Группа компаний «МЕДСИ», Москва",
  "Клинико-диагностический центр, отделение травматологии и ортопедии, Москва",
  "Центр магнитно-резонансной и компьютерной томографии «Сфера»"
];

const educationItems = [
  "2005 — Московский государственный медико-стоматологический университет, Москва. Диплом врача «Лечебное дело».",
  "2005–2006 — Московский государственный медико-стоматологический университет, кафедра травматологии и ортопедии. Интернатура.",
  "2006–2008 — Научно-исследовательский институт скорой помощи имени Н. В. Склифосовского. Ординатура: травматология и ортопедия.",
  "2013 — Российская медицинская академия последипломного образования Министерства здравоохранения Российской Федерации. Повышение квалификации: травматология и ортопедия.",
  "2018 — Российская медицинская академия непрерывного профессионального образования Министерства здравоохранения Российской Федерации. Повышение квалификации: травматология и ортопедия.",
  "2021 — Федеральный научно-клинический центр специализированных видов медицинской помощи и медицинских технологий Федерального медико-биологического агентства. Повышение квалификации: функциональное протезирование.",
  "2023 — Академия повышения квалификации и профессиональной переподготовки. Диплом о профессиональной переподготовке: Рентгенология.",
  "2023 — Академия повышения квалификации и профессиональной переподготовки. Удостоверение о повышении квалификации: магнитно-резонансная томография.",
  "2024 — Аккредитация: Рентгенология. Сведения в Единой государственной информационной системе в сфере здравоохранения Министерства здравоохранения Российской Федерации."
];

const pdfPath = "/documents/Polikarpov-Evgenij-Sergeevich.pdf";

export default function DoctorDocumentsPage() {
  return (
    <main className="doctor-documents-page">
      <PageHero
        className="doctor-documents-hero"
        eyebrow="ПРОФЕССИОНАЛЬНАЯ КВАЛИФИКАЦИЯ"
        title={<span className="doctor-documents-hero__title">Документы и профессиональная квалификация</span>}
        description={
          <div className="doctor-documents-hero__body stack-sm">
            <p>
              На этой странице собрана основная информация о профессиональном образовании, клиническом опыте,
              действующей аккредитации и направлениях практики Евгения Сергеевича Поликарпова.
            </p>
            <p className="doctor-documents-hero__note">
              Полный PDF-пакет документов доступен для скачивания ниже. Часть персональных данных в документе может
              быть скрыта в целях конфиденциальности и информационной безопасности.
            </p>
          </div>
        }
        actions={
          <a className="button button--secondary doctor-documents-hero__button" href={pdfPath} target="_blank" rel="noreferrer">
            Скачать PDF
          </a>
        }
      />

      <Section title={<span className="doctor-documents-section-title">Профессиональные ассоциации</span>}>
        <div className="doctor-documents-card">
          <ul className="doctor-documents-associations">
            <li>Член «Ассоциации травматологов-ортопедов России».</li>
            <li>Член «Ассоциации врачей МРТ и КТ-диагностики».</li>
          </ul>
        </div>
      </Section>

      <Section title={<span className="doctor-documents-section-title">Образование и профессиональная подготовка</span>}>
        <div className="doctor-documents-card">
          <ul className="doctor-documents-list">
            {educationItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title={<span className="doctor-documents-section-title">Профессиональный клинический путь</span>}>
        <div className="doctor-documents-card stack">
          <p>
            Практика сформирована в ведущих медицинских учреждениях, где ключевое значение имеют точность диагностики
            и ответственность за клиническое решение.
          </p>
          <p className="doctor-documents-path-intro">Профессиональный путь включает работу в:</p>
          <ul className="doctor-documents-path-list">
            {institutions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title={<span className="doctor-documents-section-title">Профессиональный профиль</span>}>
        <div className="doctor-documents-card stack-sm">
          <p>Евгений Сергеевич Поликарпов — врач травматолог-ортопед и врач магнитно-резонансной томографии.</p>
          <p>Более 20 лет клинической практики в травматологии, ортопедии и МРТ-диагностике.</p>
          <p>
            Практика сформирована в ведущих медицинских учреждениях, где ключевое значение имеют точность диагностики
            и ответственность за клиническое решение.
          </p>
        </div>
      </Section>

      <Section title={<span className="doctor-documents-section-title">Основные направления практики</span>}>
        <div className="doctor-practice-grid">
            {practiceDirections.map((item) => (
              <article key={item.title} className="doctor-practice-card">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
        </div>
      </Section>

      <Section title={<span className="doctor-documents-section-title">Текущий профессиональный статус</span>}>
        <div className="doctor-documents-accreditation">
          <article className="doctor-documents-card doctor-documents-card--compact stack-sm">
            <h3>Травматология и ортопедия</h3>
            <p>Аккредитация № 7723 030707278</p>
            <p>Периодическая аккредитация, действительна до 31.01.2028.</p>
          </article>
          <article className="doctor-documents-card doctor-documents-card--compact stack-sm">
            <h3>Рентгенология</h3>
            <p>Аккредитация № 7524 032299059</p>
            <p>Первичная специализированная аккредитация, действительна до 27.09.2029.</p>
          </article>
        </div>
        <p className="doctor-documents-status-note">
          Действующая профессиональная аккредитация подтверждена в единой государственной информационной системе в
          сфере здравоохранения Российской Федерации.
        </p>
      </Section>

      <Section title={<span className="doctor-documents-section-title">PDF-пакет документов</span>}>
        <div className="doctor-documents-card doctor-documents-download stack-sm">
          <p>
            Для проверки профессиональной квалификации можно скачать PDF-пакет с документами и сведениями о
            профессиональном статусе.
          </p>
          <div className="hero-actions">
            <a className="button button--secondary doctor-documents-hero__button" href={pdfPath} target="_blank" rel="noreferrer">
              Скачать PDF
            </a>
          </div>
        </div>
      </Section>

      <section className="section doctor-documents-disclaimer">
        <div className="container">
          <p>
            Информация на странице носит справочный характер и подтверждает профессиональную квалификацию врача.
            Дистанционный формат работы не заменяет очный медицинский осмотр и экстренную медицинскую помощь.
          </p>
        </div>
      </section>
    </main>
  );
}
