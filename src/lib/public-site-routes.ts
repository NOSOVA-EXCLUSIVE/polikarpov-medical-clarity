import { paidServicesV21 } from "@/features/products/services-v21";

export const publicSiteRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/doctor", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/doctor/documents", priority: 0.75, changeFrequency: "monthly" as const },
  { path: "/services", priority: 0.9, changeFrequency: "weekly" as const },
  ...paidServicesV21.map((service) => ({ path: `/services/${service.slug}`, priority: 0.8, changeFrequency: "weekly" as const })),
  { path: "/documents", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/documents/offer", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/documents/online-consultation", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/documents/informed-consent", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/documents/data-policy", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/documents/refunds", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/documents/support-regulations", priority: 0.5, changeFrequency: "monthly" as const }
];
