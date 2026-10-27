import type { ReactNode } from "react";
import { ManualCallRequestForm } from "@/components/manual/call-request-form";
import { ManualDeliverableViewer } from "@/components/manual/deliverable-viewer";
import { requireManualPatient } from "@/features/manual-v21/access";
import { getManualContext } from "@/features/manual-v21/service";
import { addCalendarDays, canOpenManualContact, parseManualPolicy } from "@/features/manual-v21/policy";

export const dynamic = "force-dynamic";

const PHASES: Record<string, string> = {
  REVIEW: "Предварительное рассмотрение", CALL_REQUESTED: "Время созвона предложено",
  CALL_CONFIRMED: "Уточняющий созвон подтверждён", CALL_COMPLETED: "Уточняющий созвон состоялся",
  OFFERED: "Персональное предложение готово", ACCEPTED: "Условия приняты",
  PAID: "Оплата подтверждена, ожидается начало работы", ACTIVE: "Работа начата", COMPLETED: "Работа завершена"
};
function date(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Moscow" }).format(value) + " (МСК)" : "—";
}
function TextForm({ action, title, children, contactId }: {
  action: "message" | "open-contact"; title: string; children?: ReactNode; contactId?: string;
}) {
  return <form action="/api/manual/actions" method="post" className="stack">
    <input type="hidden" name="action" value={action} />
    {contactId ? <input type="hidden" name="contactId" value={contactId} /> : null}
    <label className="field"><span>{title}</span><textarea name="body" maxLength={10000} rows={4} required /></label>
    {children}<div><button className="button" type="submit">Отправить</button></div>
  </form>;
}

export default async function ManualCabinetPage({ searchParams }: {
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  let context: Awaited<ReturnType<typeof getManualContext>>;
  try {
    const session = await requireManualPatient();
    context = await getManualContext(session.caseId);
  } catch {
    return <main className="section"><div className="container stack"><section className="card stack">
      <p className="eyebrow">Личный кабинет</p><h1>Доступ по персональной ссылке</h1>
      <p>Откройте актуальную персональную ссылку от врача. Если срок входа истёк, попросите новую ссылку.
        Доступ к истории сохраняется 30 календарных дней после фактического завершения работы.</p>
      <p className="muted">Истечение пациентского доступа не удаляет историю врача.</p>
    </section></div></main>;
  }
  const flash = (await searchParams) || {};
  const agreement = context.currentAgreement;
  const open = context.contacts.find((contact) => contact.status === "OPEN");
  const done = context.contacts.filter((contact) => contact.status === "ANSWERED").length;
  const policy = agreement ? parseManualPolicy(agreement.policyJson) : null;
  const contactLimit = policy?.contactLimit || 0;
  const canOpen = Boolean(policy && canOpenManualContact({ phase: context.phase, policy,
    contactCount: context.contacts.length, hasOpenContact: Boolean(open), workEndsAt: context.workEndsAt,
    resultDeliveredAt: context.resultDeliveredAt }));
  const scope = Array.isArray(agreement?.scopeJson) ? agreement.scopeJson.filter((item): item is string => typeof item === "string") : [];
  return <main className="section"><div className="container stack" style={{ overflowWrap: "anywhere" }}>
    <section className="card stack">
      <p className="eyebrow">Личный кабинет · обращение {context.reference}</p>
      <h1>{agreement?.title || "Уточнение формата помощи"}</h1>
      <p>{PHASES[context.phase] || context.phase}</p>
      <p className="muted">Персональная ссылка для входа действует одни сутки. Если она истекла, врач может выдать новую
        в пределах срока доступа к обращению. Это не сокращает согласованный период доступа к истории.</p>
      <p className="muted">Кабинет принадлежит только этому обращению. При экстренных симптомах обратитесь за очной помощью.</p>
      {flash.notice === "saved" ? <p className="notice" role="status">Изменения сохранены.</p> : null}
      <div className="two-column">
        <article><strong>Уточняющий созвон</strong><p>{date(context.callStartsAt)}</p>
          <p className="muted">{context.callConfirmedAt ? "Время подтверждено врачом." : "Время окончательно подтверждает врач."}</p></article>
        <article><strong>Начало работы</strong><p>{date(context.workStartedAt)}</p>
          <p className="muted">Созвон, принятие условий и оплата сами по себе не запускают срок услуги.</p></article>
        <article><strong>Срок работы</strong><p>{date(context.workEndsAt)}</p></article>
        {policy?.clarificationDays && context.resultDeliveredAt ? <article><strong>Уточнения к результату до</strong>
          <p>{date(context.workEndsAt || addCalendarDays(context.resultDeliveredAt, policy.clarificationDays))}</p></article> : null}
        <article><strong>Доступ к истории после завершения</strong>
          <p>{context.patientAccessEndsAt ? date(context.patientAccessEndsAt) : "30 календарных дней после фактического завершения"}</p></article>
      </div>
    </section>

    {["REVIEW", "CALL_REQUESTED"].includes(context.phase) ? <section className="card stack">
      <h2>Предварительный уточняющий созвон</h2>
      <p>Созвон проходит до окончательного предложения и оплаты. Бесплатный подбор формата носит организационный характер.</p>
      <ManualCallRequestForm />
    </section> : null}

    {agreement ? <section className="card stack"><h2>Персональное предложение</h2>
      <p><strong>{agreement.title}</strong> · {(agreement.amountCents / 100).toLocaleString("ru-RU", {
        style: "currency", currency: agreement.currency })}</p>
      {scope.length ? <ul>{scope.map((item, index) => <li key={index}>{item}</li>)}</ul> : null}
      <p>Срок подготовки: {agreement.turnaround}.</p>
      <p>Начало работы отдельно подтверждает врач после согласования условий, подтверждения оплаты и достаточности материалов.
        Уточняющий созвон и принятие предложения сами по себе срок услуги не запускают.</p>
      {policy?.packageDays ? <p>Период сопровождения — {policy.packageDays} календарных дней с зафиксированного врачом начала работы.
        Точные дата и время начала и окончания будут видны в кабинете.</p> : null}
      {policy?.clarificationDays ? <p>Уточнения к готовому результату: один собранный блок вопросов в течение {policy.clarificationDays}
        {" "}календарных дней после фактической выдачи результата. Это уточнения по согласованному объёму, а не новый независимый разбор.</p> : null}
      {contactLimit > 0 ? <p>Количество содержательных контактов: {contactLimit}. Контакт включает согласованный вопрос или блок,
        содержательный ответ врача и необходимые уточнения; несколько сообщений по одному блоку могут составлять один контакт.
        Организационные и технические вопросы не расходуют этот лимит. Своевременно открытый блок будет рассмотрен и после окончания срока.</p> : null}
      <p>Ответ в сопровождении — до {policy?.replyWorkingDays || 3} рабочих дней.
        После фактического завершения — {policy?.historyDays || 30} календарных дней доступа к истории только для чтения.
        Истечение пациентского доступа не удаляет историю врача.</p>
      <p>Номер обращения отображается при просмотре материалов. Эта маркировка не встроена в исходный файл и не исключает копирование.</p>
      {agreement.acceptedAt ? <p>Условия приняты: {date(agreement.acceptedAt)}.</p> : context.phase === "OFFERED" ?
        <form action="/api/manual/actions" method="post" className="stack">
          <input type="hidden" name="action" value="accept-agreement" />
          <input type="hidden" name="agreementId" value={agreement.id} />
          <label><input type="checkbox" name="accepted" value="yes" required /> Я прочитал(а) и принимаю условия этого персонального предложения,
            включая сроки и период доступа к истории.</label>
          <div><button className="button" type="submit">Принять предложение</button></div>
        </form> : null}
      <p className="muted">Онлайн-оплата отключена. Получение оплаты вручную подтверждает врач; кабинет не списывает деньги.</p>
    </section> : null}

    {contactLimit > 0 && ["ACTIVE", "COMPLETED"].includes(context.phase) ? <section className="card stack">
      <h2>Контакты по услуге</h2><p>Завершено {done} из {contactLimit}{open ? `; контакт № ${open.ordinal} в работе` : ""}.</p>
      <p className="muted">Контакт — согласованный вопрос или блок, содержательный ответ врача и необходимые уточнения.
        Своевременно отправленный блок будет рассмотрен и после окончания срока; новый блок после срока не открывается.</p>
      {open ? <TextForm action="message" contactId={open.id} title={`Дополнение к контакту № ${open.ordinal}`} /> :
        canOpen ? <TextForm action="open-contact" title="Новый содержательный вопрос или блок" /> :
          <p>Новые содержательные контакты сейчас недоступны.</p>}
    </section> : null}

    {context.deliverables.length ? <section className="card stack"><h2>Материалы врача</h2>
      <p className="muted">Материалы предназначены лично вам. Маркировка при просмотре не исключает копирование и запись экрана.</p>
      {context.deliverables.map((file) => <ManualDeliverableViewer key={file.id} file={file} reference={context.reference} />)}
    </section> : null}

    <section className="card stack"><h2>Переписка</h2>
      {context.messages.length ? context.messages.map((message) => <article className="card stack-sm" key={message.id}>
        <div className="card-meta"><strong>{message.authorRole === "PATIENT" ? "Вы" : message.authorRole === "SYSTEM" ? "Система" : "Команда врача"}</strong>
          <span className="muted">{date(message.createdAt)}</span></div>
        <p className="muted">{message.kind === "RESULT" ? "Результат работы" :
          message.kind === "OPENING" ? "Новый блок по услуге" :
          message.kind === "REPLY" ? "Ответ по контакту услуги" :
          message.contactId ? "По контакту услуги" : message.authorRole === "SYSTEM" ? "Системное сообщение" : "Организационное сообщение"}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{message.body}</p>
      </article>) : <p>Сообщений пока нет.</p>}
      {context.phase !== "COMPLETED" ? <TextForm action="message" title="Организационный вопрос">
        <p className="muted">Время, доступ, оплата и технические вопросы. Они не расходуют контакты услуги.
          Медицинский вопрос отправляйте внутри соответствующего контакта.</p>
      </TextForm> : <p>История доступна только для чтения.</p>}
    </section>
  </div></main>;
}
