import { ServiceDetailPage } from "@/components/public/service-detail-page";
import { serviceDetailContentMap } from "@/features/products/service-detail-content";

const service = serviceDetailContentMap["clinical-review"];

export default function ClinicalReviewPage() {
  return <ServiceDetailPage service={service} />;
}
