import type { Metadata } from "next";

import { DocumentDetailPage } from "@/components/public/document-detail-page";
import { buildDocumentMetadata } from "@/lib/seo";

export const metadata: Metadata = buildDocumentMetadata("offer", "/legal/offer", "/documents/offer");

export default function OfferPage() {
  return <DocumentDetailPage slug="offer" />;
}
