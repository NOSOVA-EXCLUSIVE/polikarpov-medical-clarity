import type { Metadata } from "next";

import { DocumentDetailPage } from "@/components/public/document-detail-page";
import { buildDocumentMetadata } from "@/lib/seo";

export const metadata: Metadata = buildDocumentMetadata(
  "informed-consent",
  "/legal/consent",
  "/documents/informed-consent"
);

export default function ConsentPage() {
  return <DocumentDetailPage slug="informed-consent" />;
}
