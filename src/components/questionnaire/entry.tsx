"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PageHero, Section } from "@/components/public/shell";
import { QuestionnaireForm } from "@/components/questionnaire/form";
import { TimezoneInput } from "@/components/questionnaire/timezone-input";
import { organizationalSelection } from "@/features/products/services-v21";
import { resolveQuestionnaireEntry } from "@/features/questionnaire/entry-selection";
import { ServiceOverview } from "@/components/public/service-overview";
import { INTAKE_DATA_CONSENT_LABEL, INTAKE_DATA_CONSENT_VERSION } from "@/features/questionnaire/intake-consent-content";
import type { OrganizationalInquiryInput } from "@/features/questionnaire/organizational-inquiry";

const inquiryFieldNames = ["name", "email", "phone", "preferredContact", "telegramUsername", "country", "timezone", "task", "materials", "website"] as const;
const contactOptions = [
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Телефон" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "TELEGRAM", label: "Telegram" }
] as const;

function responseMessage(body: any, fallback: string): string {
  return typeof body?.error === "string" ? body.error : body?.error?.message || fallback;
}

function OrganizationalInquiryForm() {
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [number, setNumber] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [preferredContact, setPreferredContact] = useState<OrganizationalInquiryInput["preferredContact"]>("EMAIL");
  const [telegramUsername, setTelegramUsername] = useState("");
  const requiresPhone = preferredContact === "PHONE" || preferredContact === "WHATSAPP";
  async function acceptConsent() {
    if (!accepted || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/questionnaire/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accepted: true, textVersion: INTAKE_DATA_CONSENT_VERSION }) });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(responseMessage(body, "Не удалось сохранить согласие."));
      setReady(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(inquiryFieldNames.map((key) => [key, String(data.get(key) ?? "")]));
    setDraft(values);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/organizational-inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const body = await response.json();
      if (response.status === 403 && body?.error?.code === "INTAKE_CONSENT_REQUIRED") { setReady(false); setAccepted(false); }
      if (!response.ok || !body.success) throw new Error(responseMessage(body, "Не удалось сохранить обращение."));
      setNumber(body.displayNumber);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Попробуйте ещё раз."); }
    finally { setBusy(false); }
  }
  if (number) return <article className="card stack" role="status"><p className="eyebrow">Обращение сохранено</p><h2>{number}</h2><p>Вы отправили запрос на бесплатный организационный подбор. Для организационной связи выбран способ: {contactOptions.find((option) => option.value === preferredContact)?.label}. Email остаётся каналом для персонального входа и уведомлений.</p><p className="muted">Медицинская оценка, просмотр снимков и платная услуга этим обращением не заказываются.</p><Link className="button button--secondary" href="/services">Вернуться к услугам</Link></article>;
  return <article className="card stack organizational-inquiry">
    {!ready ? <><h2>Перед началом</h2><p>Для подбора нужны только имя, email, страна, краткая задача и перечень имеющихся материалов. При желании добавьте удобный способ связи и часовой пояс. Полная медицинская анкета и файлы не требуются.</p><label className="checkbox-row"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>{INTAKE_DATA_CONSENT_LABEL} (<Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">Политика обработки данных</Link>)</span></label><div><button className="button" type="button" disabled={!accepted || busy} onClick={acceptConsent}>{busy ? "Сохраняем согласие…" : "Продолжить"}</button></div></> : <form className="stack" onSubmit={submit}>
      <h2>Подобрать подходящий формат</h2><p>Опишите организационную задачу: например, выбрать формат для одного МРТ или узнать порядок передачи материалов. Диагнозы, подробный анамнез и результаты исследований здесь не нужны.</p>
      <div className="two-column"><label className="field">Как к вам обращаться<input name="name" defaultValue={draft.name || ""} autoComplete="name" required minLength={2} maxLength={160} /></label><label className="field">Email для ответа<input name="email" defaultValue={draft.email || ""} type="email" autoComplete="email" required maxLength={254} /></label></div>
      <p className="muted">Email обязателен для персонального входа и уведомлений. Дополнительно можно выбрать удобный способ организационной связи.</p>
      <div className="two-column">
        <label className="field">{requiresPhone ? "Телефон с кодом страны" : "Телефон с кодом страны (необязательно)"}<input name="phone" defaultValue={draft.phone || ""} type="tel" autoComplete="tel" required={requiresPhone} maxLength={40} /></label>
        <label className="field">Удобный способ связи<select name="preferredContact" value={preferredContact} disabled={busy} onChange={(event) => setPreferredContact(event.target.value as OrganizationalInquiryInput["preferredContact"])}>{contactOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>
      {preferredContact === "TELEGRAM" && <label className="field">Имя пользователя Telegram<input name="telegramUsername" value={telegramUsername} onChange={(event) => setTelegramUsername(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={65} placeholder="@username" /><span className="muted">Укажите имя пользователя без ссылки. Телефон для этого способа связи необязателен.</span></label>}
      <div className="two-column">
        <label className="field">Страна проживания<input name="country" defaultValue={draft.country || ""} autoComplete="country-name" required minLength={2} maxLength={80} /></label>
        <label className="field">Часовой пояс (необязательно)<TimezoneInput name="timezone" defaultValue={draft.timezone || ""} maxLength={80} /></label>
      </div>
      <label className="field">Какой формат или порядок работы хотите уточнить?<textarea name="task" defaultValue={draft.task || ""} required minLength={5} maxLength={1000} rows={3} placeholder="Например: хочу понять, какой формат подойдёт для независимого просмотра одного исследования." /></label>
      <label className="field">Какие материалы уже есть?<textarea name="materials" defaultValue={draft.materials || ""} maxLength={1000} rows={3} placeholder="Только перечень: одно МРТ, описание, две выписки. Файлы и ссылки сейчас не нужны." /></label>
      <input name="website" className="form-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <p className="muted">Бесплатно. Первый организационный ответ — до трёх рабочих дней. Выбранное время предварительной беседы подтверждает врач. Медицинская оценка и просмотр снимков в подбор не входят; платный формат и оплата согласуются отдельно.</p>
      <div><button className="button" type="submit" disabled={busy}>{busy ? "Сохраняем обращение…" : "Отправить запрос на подбор"}</button></div>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </article>;
}

export function QuestionnaireEntry() {
  const params = useSearchParams();
  const raw = params.get("service");
  const legacy = params.get("product");
  const selection = resolveQuestionnaireEntry(raw, legacy);
  if (selection.kind === "choose") return <main className="questionnaire-selection-page"><PageHero className="questionnaire-hero" eyebrow="Анкета пациента" title="С какой услугой вы хотите обратиться?" description={<p className="lead">Выберите услугу или попросите помочь с выбором. Ни одна платная услуга заранее не выбрана.</p>} /><Section><div className="card stack-sm"><h2>Помогите выбрать бесплатно</h2><p>{organizationalSelection.description}</p><Link className="button button--secondary" href="/questionnaire?service=service-selection">Подобрать услугу бесплатно</Link></div></Section><Section title="Выберите услугу"><ServiceOverview idPrefix="questionnaire" destination="questionnaire" /></Section></main>;
  if (selection.kind === "invalid") return <main className="questionnaire-selection-page"><Section title="Выберите формат заново"><article className="card stack"><p>Ссылка содержит неизвестный формат. Выберите услугу из актуального каталога — ваш запрос не будет автоматически подменён другой услугой.</p><Link className="button" href="/services">Открыть услуги и цены</Link></article></Section></main>;
  const service = selection.service;
  if (service.kind === "organizational_selection") return <main className="organizational-inquiry-page"><PageHero eyebrow="Бесплатный организационный подбор" title={organizationalSelection.title} description={<><p className="lead">{organizationalSelection.shortDescription}</p><p>{organizationalSelection.description}</p></>} /><Section><OrganizationalInquiryForm /></Section></main>;
  return <main><PageHero className="questionnaire-hero" eyebrow="Анкета пациента" title="Сведения для выбранного формата" description={<><p className="lead">Последовательно опишите задачу и приложите необходимые материалы. Предварительная беседа с врачом проходит до окончательного предложения и оплаты; выбранное время подтверждает врач. После беседы согласуются формат, объём, стоимость и срок.</p><p>Вы можете изменить формат на первом шаге. Если нужен только организационный подбор, воспользуйтесь <Link className="text-link" href="/questionnaire?service=service-selection">короткой бесплатной формой</Link>.</p><p><Link className="text-link" href="/documents#materials-guide">Как подготовить исследования и документы</Link></p></>} /><QuestionnaireForm initialSelectedServiceId={service.id} /></main>;
}
