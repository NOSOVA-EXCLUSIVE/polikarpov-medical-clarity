import { DocumentDetailPage } from "@/components/public/document-detail-page";
import { practiceDocuments } from "@/features/documents/content";

type DocumentRoutePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return practiceDocuments.map((document) => ({ slug: document.slug }));
}

export default async function DocumentRoutePage({ params }: DocumentRoutePageProps) {
  const { slug } = await params;

  return <DocumentDetailPage slug={slug} />;
}
