import type { Metadata } from "next";

import { ServiceDetailPage } from "@/components/public/service-detail-page";
import { serviceDetailContentMap } from "@/features/products/service-detail-content";
import { buildServiceMetadata } from "@/lib/seo";

const service = serviceDetailContentMap["second-opinion"];

export const metadata: Metadata = buildServiceMetadata("second-opinion");

export default function SecondOpinionPage() {
  return <ServiceDetailPage service={service} />;
}
