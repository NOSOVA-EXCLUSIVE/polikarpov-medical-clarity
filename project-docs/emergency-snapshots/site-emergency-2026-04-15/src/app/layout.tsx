import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { inlineGlobalStyles } from "./inline-global-styles";

export const metadata: Metadata = {
  title: "Polikarpov Medical Clarity",
  description: "Частная практика травматолога-ортопеда для русскоязычных пациентов за рубежом"
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
