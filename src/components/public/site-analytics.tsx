"use client";

import { Analytics } from "@vercel/analytics/react";
import { usePathname } from "next/navigation";

const siteHosts = new Set([
  "polikarpovclarity.com",
  "www.polikarpovclarity.com",
  "polikarpovclarity.ru",
  "www.polikarpovclarity.ru"
]);

export function allowedAnalyticsUrl(
  eventUrl: string,
  currentOrigin: string,
  referrerUrl: string,
  publicPaths: readonly string[]
) {
  try {
    const url = new URL(eventUrl, currentOrigin);
    if (url.origin !== currentOrigin || !publicPaths.includes(url.pathname)) return null;

    if (referrerUrl) {
      const referrer = new URL(referrerUrl);
      if (referrer.search || referrer.hash || referrer.username || referrer.password) return null;
      if (referrer.origin === currentOrigin || siteHosts.has(referrer.hostname)) {
        if (!publicPaths.includes(referrer.pathname)) return null;
      } else if (referrer.pathname !== "/" || !["https:", "http:"].includes(referrer.protocol)) {
        return null;
      }
    }

    return url.origin + url.pathname;
  } catch {
    return null;
  }
}

export function SiteAnalytics({ mode, publicPaths }: {
  mode: "development" | "production";
  publicPaths: readonly string[];
}) {
  const pathname = usePathname();
  if (!pathname || !publicPaths.includes(pathname)) return null;

  return (
    <Analytics
      mode={mode}
      framework="next"
      route={pathname}
      path={pathname}
      basePath={mode === "production" ? process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH : undefined}
      configString={mode === "production" ? process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG : undefined}
      beforeSend={(event) => {
        if (event.type !== "pageview") return null;
        const url = allowedAnalyticsUrl(
          event.url,
          window.location.origin,
          document.referrer,
          publicPaths
        );
        return url ? { ...event, url } : null;
      }}
    />
  );
}
