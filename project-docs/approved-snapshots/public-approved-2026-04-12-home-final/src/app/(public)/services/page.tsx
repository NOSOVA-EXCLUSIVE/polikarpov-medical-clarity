import Link from "next/link";

import { Section } from "../../../components/public/shell";

const serviceFormats = [
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

export default function ServicesPage() {
  return (
    <main>
      <Section title="Форматы помощи">
        <div className="home-formats-shell stack">
          <p className="home-formats-shell__lead">
            Выберите формат, если хотите не просто мнение, а чёткое понимание ситуации и правильный следующий шаг
          </p>

          <div className="home-formats-grid">
            {serviceFormats.map((format) => (
              <Link key={format.href} className="home-format-card" href={format.href}>
                <h3 className="home-format-card__title">{format.title}</h3>
                <div className="home-format-card__copy">
                  {format.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <p className="home-format-card__accent">{format.accent}</p>
              </Link>
            ))}
          </div>

          <p className="home-formats-shell__note">Формат помощи определяется после первичного разбора</p>
        </div>
      </Section>
    </main>
  );
}
