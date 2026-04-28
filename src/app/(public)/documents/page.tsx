import Link from "next/link";

import { BulletList, PageHero, Section } from "@/components/public/shell";
import { beforePaymentDocuments, practiceDocuments, practiceDocumentsMap } from "@/features/documents/content";
import type { Route } from "next";

function renderDocumentCardTitle(slug: string, title: string) {
  if (slug === "data-policy") {
    return (
      <>
        Политика обработки персональных данных и
        <br />
        медицинской информации
      </>
    );
  }

  return title;
}

export default function DocumentsPage() {
  return (
    <main className="documents-page">
      <PageHero
        className="documents-hero"
        eyebrow="Документы"
        title="Документы и условия работы"
        description={
          <p className="lead">
            Мы заранее и спокойно объясняем правила взаимодействия, формат работы, оплату,
            обработку данных и границы дистанционного формата взаимодействия.
          </p>
        }
      />

      <Section className="documents-overview">
        <div className="documents-grid">
          {practiceDocuments.map((document) => (
            <article key={document.slug} className={`documents-card documents-card--${document.slug}`}>
              <div className="documents-card__copy stack-sm">
                <h2>{renderDocumentCardTitle(document.slug, document.title)}</h2>
                <p>{document.cardDescription}</p>
              </div>
              <Link
                className="button button--secondary documents-card__button"
                href={`/documents/${document.slug}` as Route}
              >
                Открыть
              </Link>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Перед оплатой" className="documents-prepayment">
        <div className="card documents-prepayment__card stack">
          <div className="stack-sm">
            <p className="lead">
              Перед оплатой услуги, пожалуйста, ознакомьтесь с основными условиями работы.
            </p>
            <p>
              Формат взаимодействия определяется врачом после анализа анкеты и предоставленных материалов.
            </p>
            <p>
              Отправка анкеты и предварительный анализ материалов не являются началом оказания платной услуги.
            </p>
            <p>
              Оплачивая выбранный формат, вы подтверждаете, что:
            </p>
          </div>

          <BulletList
            items={[
              "ознакомлены с публичной офертой",
              "понимаете правила дистанционного формата",
              "даёте согласие на обработку данных",
              "понимаете ограничения дистанционного формата взаимодействия"
            ]}
            className="documents-prepayment__list"
          />

          <div className="documents-prepayment__actions">
            {beforePaymentDocuments.map((slug) => {
              const document = practiceDocumentsMap[slug];

              return (
                <Link
                  key={slug}
                  className="button button--secondary documents-prepayment__link"
                  href={`/documents/${slug}` as Route}
                >
                  {slug === "data-policy" ? "Политика обработки данных" : document.title}
                </Link>
              );
            })}
          </div>
        </div>
      </Section>

      <Section id="legal-info" className="documents-legal-info">
        <div className="documents-legal-info__content stack-sm">
          <h2>Юридическая информация и формат работы</h2>
          <p>
            Данный сайт и представленные на нём материалы носят информационно-консультационный
            характер и предназначены для профессионального разбора ситуации пациента, анализа
            предоставленных материалов и формирования профессиональных обоснованных рекомендаций.
          </p>
          <p>
            Дистанционный формат взаимодействия не является экстренной медицинской помощью и не
            заменяет очный приём врача в случаях, когда он необходим.
          </p>
          <p>
            Рекомендации носят профессиональный характер и основаны на предоставленных пациентом
            данных. Окончательные решения о лечении принимаются пациентом совместно с лечащим
            врачом.
          </p>
          <p>
            Качество и точность рекомендаций напрямую зависят от полноты и достоверности
            предоставленной информации. При ухудшении состояния или появлении острых симптомов
            необходимо незамедлительно обратиться за очной медицинской помощью.
          </p>
          <p>
            Формат и возможность дистанционного взаимодействия определяются врачом после анализа
            анкеты и материалов пациента.
          </p>
          <p>
            Информация, которую пациент предоставляет через анкету и материалы, используется
            только для профессионального разбора ситуации, подготовки индивидуальных
            рекомендаций и связи по его запросу. Эти данные не используются в маркетинговых
            целях, а пациент вправе запросить уточнение или удаление данных в пределах и
            порядке, предусмотренных политикой обработки данных и действующим законодательством.
          </p>
          <p>
            Отправка анкеты и предварительный анализ материалов не являются началом оказания
            платной услуги.
          </p>
          <p>
            Оказание платной услуги считается начатым с момента фактического начала выполнения
            Исполнителем профессионального разбора или иного взаимодействия в рамках подтверждённого
            и согласованного формата.
          </p>
          <p>
            Оплата производится только после подтверждения формата работы и относится к выбранному
            формату взаимодействия, а не к гарантированному результату лечения.
          </p>
          <p>
            Все процессы взаимодействия выстроены таким образом, чтобы обеспечить спокойное,
            понятное и конфиденциальное взаимодействие между пациентом и врачом.
          </p>
        </div>
      </Section>
    </main>
  );
}
