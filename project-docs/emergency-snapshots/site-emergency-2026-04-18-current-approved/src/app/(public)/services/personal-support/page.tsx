import { ServiceDetailPage } from "@/components/public/service-detail-page";
import { serviceDetailContentMap } from "@/features/products/service-detail-content";

const service = serviceDetailContentMap["personal-support"];

export default function PersonalSupportPage() {
  return <ServiceDetailPage service={service} />;
}
