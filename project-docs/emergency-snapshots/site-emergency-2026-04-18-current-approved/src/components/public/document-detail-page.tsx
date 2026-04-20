import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHero, Section } from "@/components/public/shell";
import {
  practiceDocuments,
  practiceDocumentsMap,
  type PracticeDocument
} from "@/features/documents/content";

type DocumentDetailPageProps = {
  slug: string;
};

function DocumentSectionBlock({ section }: { section: PracticeDocument["sections"][number] }) {
  return (
    <article className="card documents-detail__section stack-sm">
      <h2>{section.title}</h2>
      {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {section.bullets?.length ? (
        <ul className="list documents-detail__list">
          {section.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function DocumentDetailPage({ slug }: DocumentDetailPageProps) {
  const document = practiceDocumentsMap[slug];

  if (!document) {
    notFound();
  }

  const relatedDocuments = practiceDocuments.filter((item) => item.slug !== document.slug);

  return (
    <main className="documents-page documents-detail-page">
      <PageHero
        className="documents-hero documents-detail-hero"
        eyebrow={
          <Link className="documents-detail-page__back" href="/documents">
            ← Вернуться к документам
          </Link>
        }
        title={document.title}
        description={<p className="lead">{document.summary}</p>}
      />

      <Section className="documents-detail-page__content">
        <div className="documents-detail-page__stack">
          {document.sections.map((section) => (
            <DocumentSectionBlock key={section.title} section={section} />
          ))}
        </div>
      </Section>

      <Section title="Другие документы" className="documents-detail-page__related">
        <div className="documents-grid">
          {relatedDocuments.map((item) => (
            <article key={item.slug} className="documents-card documents-card--secondary">
              <div className="documents-card__copy stack-sm">
                <h3>{item.title}</h3>
                <p>{item.cardDescription}</p>
              </div>
              <Link className="button button--secondary documents-card__button" href={`/documents/${item.slug}`}>
                Открыть
              </Link>
            </article>
          ))}
        </div>
      </Section>
    </main>
  );
}
