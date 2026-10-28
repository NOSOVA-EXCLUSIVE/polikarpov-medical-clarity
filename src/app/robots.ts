import type { MetadataRoute } from "next";

import { buildAbsoluteUrl, getSiteUrl } from "@/lib/seo";
import { getPreviewAppUrl } from "@/lib/preview/guard";

export default function robots(): MetadataRoute.Robots {
  if (getPreviewAppUrl()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
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
