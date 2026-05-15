import type { MetadataRoute } from "next";

import { buildAbsoluteUrl } from "@/lib/seo";

const publicRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/doctor", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/doctor/documents", priority: 0.75, changeFrequency: "monthly" as const },
  { path: "/services", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/services/second-opinion", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/services/clinical-review", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/services/recovery-control", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/services/personal-support", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/questionnaire", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/documents", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/documents/offer", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/documents/online-consultation", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/documents/informed-consent", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/documents/data-policy", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/documents/refunds", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/documents/support-regulations", priority: 0.5, changeFrequency: "monthly" as const }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: buildAbsoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
