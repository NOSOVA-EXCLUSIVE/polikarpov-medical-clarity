import type { ReactNode } from "react";

import { IntakeSourceCapture } from "@/components/public/intake-source-capture";
import { SiteAnalytics } from "@/components/public/site-analytics";
import { getPreviewAppUrl } from "@/lib/preview/guard";
import { publicSiteRoutes } from "@/lib/public-site-routes";
import { PublicFooter, PublicHeader } from "../../components/public/shell";

type PublicLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function PublicLayout({ children }: PublicLayoutProps) {
  const analyticsMode = process.env.VERCEL_ENV === "production"
    ? "production"
    : getPreviewAppUrl() ? "development" : null;

  return (
    <div className="public-site">
      <PublicHeader />
      {children}
      <PublicFooter />
      <IntakeSourceCapture />
      {analyticsMode
        ? <SiteAnalytics mode={analyticsMode} publicPaths={publicSiteRoutes.map(({ path }) => path)} />
        : null}
    </div>
  );
}
