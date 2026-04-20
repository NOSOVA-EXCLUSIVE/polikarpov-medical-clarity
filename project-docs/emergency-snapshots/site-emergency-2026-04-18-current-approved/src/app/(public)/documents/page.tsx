import Link from "next/link";

import { BulletList, PageHero, Section } from "@/components/public/shell";
import { beforePaymentDocuments, practiceDocuments, practiceDocumentsMap } from "@/features/documents/content";

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
            обработку данных и границы онлайн-консультации.
          </p>
        }
      />

      <Section className="documents-overview">
        <div className="documents-grid">
          {practiceDocuments.map((document) => (
            <article key={document.slug} className="documents-card">
              <div className="documents-card__copy stack-sm">
                <h2>{document.title}</h2>
                <p>{document.cardDescription}</p>
              </div>
              <Link className="button button--secondary documents-card__button" href={`/documents/${document.slug}`}>
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
              Формат работы определяется врачом после анализа анкеты и предоставленных материалов.
            </p>
            <p>
              Оплачивая консультацию, вы подтверждаете, что:
            </p>
          </div>

          <BulletList
            items={[
              "ознакомлены с публичной офертой",
              "понимаете правила онлайн-консультации",
              "даёте согласие на обработку данных",
              "понимаете ограничения дистанционного формата"
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
                  href={`/documents/${slug}`}
                >
                  {document.title}
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
            характер и направлены на профессиональный разбор клинической ситуации пациента, анализ
            предоставленных обследований и формирование обоснованных рекомендаций.
          </p>
          <p>
            Онлайн-консультация не является экстренной медицинской помощью и не заменяет очный приём
            врача в случаях, когда он необходим.
          </p>
          <p>
            Рекомендации, полученные в рамках консультации, носят профессиональный характер и
            основаны на предоставленных пациентом данных. Окончательные решения о лечении
            принимаются пациентом совместно с лечащим врачом.
          </p>
          <p>
            Качество и точность рекомендаций напрямую зависят от полноты и достоверности
            предоставленной информации. При ухудшении состояния или появлении острых симптомов
            необходимо незамедлительно обратиться за очной медицинской помощью.
          </p>
          <p>
            Формат и возможность онлайн-консультации определяются врачом после анализа анкеты и
            материалов пациента. Заполнение анкеты и первичный разбор не означают автоматического
            начала платной услуги.
          </p>
          <p>
            Оплата производится только после подтверждения формата работы и относится к выбранному
            формату консультации, а не к гарантированному результату лечения.
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
