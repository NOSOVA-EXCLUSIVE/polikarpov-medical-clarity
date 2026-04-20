import { ServiceDetailPage } from "@/components/public/service-detail-page";
import { serviceDetailContentMap } from "@/features/products/service-detail-content";

const service = serviceDetailContentMap["second-opinion"];

export default function SecondOpinionPage() {
  return <ServiceDetailPage service={service} />;
}
