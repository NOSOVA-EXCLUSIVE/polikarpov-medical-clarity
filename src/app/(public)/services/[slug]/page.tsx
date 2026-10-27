import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceDetailPage } from "@/components/public/service-detail-page";
import { getServiceV21, paidServicesV21 } from "@/features/products/services-v21";
import { buildPageMetadata } from "@/lib/seo";

const originalSlugs = new Set(["second-opinion", "clinical-review", "recovery-control", "personal-support"]);
export function generateStaticParams() {
  return paidServicesV21.filter((service) => !originalSlugs.has(service.slug)).map((service) => ({ slug: service.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceV21(slug);
  if (!service || service.kind !== "paid_service") return {};
  return buildPageMetadata({ title: service.title, description: service.shortDescription, path: `/services/${service.slug}` });
}
export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getServiceV21(slug);
  if (!service || service.kind !== "paid_service") notFound();
  return <ServiceDetailPage service={service} />;
}
