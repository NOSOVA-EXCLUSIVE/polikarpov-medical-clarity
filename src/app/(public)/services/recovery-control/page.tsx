import type { Metadata } from "next";

import { ServiceDetailPage } from "@/components/public/service-detail-page";
import { serviceDetailContentMap } from "@/features/products/service-detail-content";
import { buildServiceMetadata } from "@/lib/seo";

const service = serviceDetailContentMap["recovery-control"];

export const metadata: Metadata = buildServiceMetadata("recovery-control");

export default function RecoveryControlPage() {
  return <ServiceDetailPage service={service} />;
}
