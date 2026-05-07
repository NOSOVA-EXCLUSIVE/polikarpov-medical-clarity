import type { Metadata } from "next";

import { ServiceDetailPage } from "@/components/public/service-detail-page";
import { serviceDetailContentMap } from "@/features/products/service-detail-content";
import { buildServiceMetadata } from "@/lib/seo";

const service = serviceDetailContentMap["personal-support"];

export const metadata: Metadata = buildServiceMetadata("personal-support");

export default function PersonalSupportPage() {
  return <ServiceDetailPage service={service} />;
}
