import type { Metadata } from "next";

import { DocumentDetailPage } from "@/components/public/document-detail-page";
import { practiceDocuments } from "@/features/documents/content";
import { buildDocumentMetadata, type DocumentSeoSlug } from "@/lib/seo";

type DocumentRoutePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return practiceDocuments.map((document) => ({ slug: document.slug }));
}

export async function generateMetadata({ params }: DocumentRoutePageProps): Promise<Metadata> {
  const { slug } = await params;

  return buildDocumentMetadata(slug as DocumentSeoSlug, `/documents/${slug}`);
}

export default async function DocumentRoutePage({ params }: DocumentRoutePageProps) {
  const { slug } = await params;

  return <DocumentDetailPage slug={slug} />;
}
