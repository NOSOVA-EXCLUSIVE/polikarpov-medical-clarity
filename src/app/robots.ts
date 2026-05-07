import type { MetadataRoute } from "next";

import { buildAbsoluteUrl, getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/doctor", "/services", "/questionnaire", "/documents", "/legal"],
        disallow: ["/admin", "/portal", "/booking", "/payment", "/api"]
      }
    ],
    sitemap: buildAbsoluteUrl("/sitemap.xml"),
    host: getSiteUrl()
  };
}
