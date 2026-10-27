import type { Metadata } from "next";
import { Suspense } from "react";
import { QuestionnaireEntry } from "@/components/questionnaire/entry";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({ title: "Анкета и подбор формата", description: "Выбранный формат Medical Clarity, защищённая анкета и бесплатный организационный подбор.", path: "/questionnaire", indexing: { index: false, follow: false } });
export default function QuestionnairePage() {
  return <Suspense fallback={<main className="container section"><p>Открываем выбранный формат…</p></main>}><QuestionnaireEntry /></Suspense>;
}
