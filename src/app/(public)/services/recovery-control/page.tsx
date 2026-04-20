import { ServiceDetailPage } from "@/components/public/service-detail-page";
import { serviceDetailContentMap } from "@/features/products/service-detail-content";

const service = serviceDetailContentMap["recovery-control"];

export default function RecoveryControlPage() {
  return <ServiceDetailPage service={service} />;
}
