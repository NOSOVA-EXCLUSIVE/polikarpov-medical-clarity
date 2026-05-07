import type { Metadata } from "next";

import { ServiceDetailPage } from "@/components/public/service-detail-page";
import { serviceDetailContentMap } from "@/features/products/service-detail-content";
import { buildServiceMetadata } from "@/lib/seo";

const service = serviceDetailContentMap["clinical-review"];

export const metadata: Metadata = buildServiceMetadata("clinical-review");

export default function ClinicalReviewPage() {
  return <ServiceDetailPage service={service} />;
}
