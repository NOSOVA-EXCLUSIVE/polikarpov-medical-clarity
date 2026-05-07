import type { Metadata } from "next";

import { DocumentDetailPage } from "@/components/public/document-detail-page";
import { buildDocumentMetadata } from "@/lib/seo";

export const metadata: Metadata = buildDocumentMetadata(
  "data-policy",
  "/legal/privacy",
  "/documents/data-policy"
);

export default function PrivacyPage() {
  return <DocumentDetailPage slug="data-policy" />;
}
