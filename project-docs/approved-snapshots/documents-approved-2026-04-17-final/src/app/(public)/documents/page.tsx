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
            Мы работаем прозрачно и заранее объясняем все условия — чтобы вы понимали формат,
            границы и правила взаимодействия.
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
              Перед оплатой услуги, пожалуйста, ознакомьтесь с условиями работы.
            </p>
            <p>
              Оплачивая консультацию, вы подтверждаете, что:
            </p>
          </div>

          <BulletList
            items={[
              "ознакомлены с публичной офертой",
              "согласны с правилами консультации",
              "даёте согласие на обработку данных",
              "понимаете ограничения онлайн-формата"
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
    </main>
  );
}
