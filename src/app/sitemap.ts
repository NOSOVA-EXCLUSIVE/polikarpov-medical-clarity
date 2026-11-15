import type { MetadataRoute } from "next";

import { publicSiteRoutes } from "@/lib/public-site-routes";
import { buildAbsoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicSiteRoutes.map((route) => ({
    url: buildAbsoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
