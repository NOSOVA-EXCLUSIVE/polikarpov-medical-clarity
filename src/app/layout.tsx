import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getSiteUrl, SITE_NAME } from "@/lib/seo";

import "./globals.css";
import { inlineGlobalStyles } from "./inline-global-styles";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description:
    "Polikarpov Medical Clarity — частная практика травматолога-ортопеда: экспертное второе мнение, дистанционный клинический разбор и профессиональная интерпретация МРТ и медицинских материалов.",
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    locale: "ru_RU",
    type: "website"
  },
  twitter: {
    card: "summary"
  }
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <head>
        <style id="global-style-fallback" dangerouslySetInnerHTML={{ __html: inlineGlobalStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
