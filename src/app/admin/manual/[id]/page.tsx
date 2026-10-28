import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell, DefinitionList } from "@/components/admin/shell";
import { ManualAdminActions } from "@/components/admin/manual-actions";
import { ManualDeliverableUploadForm } from "@/components/manual/deliverable-upload-form";
import { requireManualStaff } from "@/features/manual-v21/access";
import { getManualContext } from "@/features/manual-v21/service";
import { manualPhaseLabels } from "@/features/manual-v21/presentation";
import { prisma } from "@/lib/db/prisma";
import { readServiceSelectionSnapshot } from "@/features/questionnaire/service-selection";

export const dynamic = "force-dynamic";
const date = (value: Date | null) => value ? value.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) + " МСК" : "—";

export default async function ManualAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireManualStaff();
  const { id } = await params;
  const context = await getManualContext(id).catch(() => null);
  if (!context) notFound();
  const agreement = context.currentAgreement;
  const receipt = await prisma.auditEvent.findFirst({ where: { applicationId: context.applicationId, action: "service_selection_recorded" }, orderBy: { createdAt: "asc" }, select: { metadataJson: true } });
  const organizational = readServiceSelectionSnapshot(receipt?.metadataJson)?.kind === "organizational_selection";
  return <AdminShell title={`Обращение ${context.reference}`} description="Ручной маршрут v2.1. Онлайн-оплата отключена.">
    <Link className="text-link" href={`/admin/applications/${context.applicationId}`}>← Анкета и исходные материалы</Link>
    <section className="card stack">
      <h2>Порядок работы</h2>
      <p>Предварительная беседа с врачом → окончательное предложение → принятие пациентом → фиксация фактической оплаты → отдельное начало работы врачом.</p>
      <DefinitionList items={[
        { label: "Пациент", value: context.application.patient.fullName },
        { label: "Этап", value: manualPhaseLabels[context.phase] ?? context.phase },
        { label: "Предварительная беседа с врачом", value: context.callStartsAt ? `${date(context.callStartsAt)} — ${date(context.callEndsAt)} (${context.callTimezone})` : "Время ещё не предложено" },
        { label: "Начало работы", value: date(context.workStartedAt) },
        { label: "Конец периода работы", value: date(context.workEndsAt) },
        { label: "Результат выдан", value: date(context.resultDeliveredAt) },
        { label: "Работа завершена", value: date(context.completedAt) },
        { label: "Пациенту доступна история до", value: context.completedAt ? date(context.patientAccessEndsAt) : "30 календарных дней после завершения" }
      ]}/>
    </section>
    {agreement ? <section className="card stack">
      <h2>Предложение, редакция {agreement.revision}</h2>
      <strong>{agreement.title} · €{(agreement.amountCents / 100).toFixed(2)}</strong>
      <p style={{ whiteSpace: "pre-wrap" }}>{Array.isArray(agreement.scopeJson) ? agreement.scopeJson.join("\n") : ""}</p>
      <p>{agreement.turnaround}</p>
      <p>{agreement.acceptedAt ? `Принято: ${date(agreement.acceptedAt)}` : "Пока не принято пациентом"}</p>
      <p>Ответы — до трёх рабочих дней. После завершения история доступна 30 календарных дней.</p>
    </section> : null}
    <ManualAdminActions applicationId={context.applicationId} caseId={context.id} phase={context.phase}
      organizational={organizational}
      doctor={actor.role === "DOCTOR"} agreementId={agreement?.id ?? null} serviceId={agreement?.serviceId ?? null}
      contacts={context.contacts.map(c => ({ id: c.id, ordinal: c.ordinal, status: c.status }))}/>
    <section className="card stack">
      <h2>Переписка и результаты</h2>
      <p className="muted">Организационные сообщения не расходуют медицинские контакты. Завершение контакта подтверждает врач после содержательного ответа.</p>
      {context.messages.length ? context.messages.map(m => <article className="card stack-sm" key={m.id}>
        <strong>{m.authorRole === "PATIENT" ? "Пациент" : m.authorRole === "DOCTOR" ? "Врач" : m.authorRole === "ADMIN" ? "Администратор" : "Система"}
          {m.contactId ? ` · Контакт ${context.contacts.find(c => c.id === m.contactId)?.ordinal ?? ""}` : " · Организационное сообщение / результат"}</strong>
        <small>{date(m.createdAt)}</small><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</p>
      </article>) : <p>Сообщений пока нет.</p>}
    </section>
    <section className="card stack">
      <h2>Материалы для пациента</h2>
      <p>Пациент видит материалы только в своём кабинете. Номер обращения отображается при просмотре; маркировка не встраивается в исходный файл.</p>
      {context.deliverables.map(f => <p key={f.id}><a className="text-link" href={`/api/admin/manual/${context.id}/deliverables/${f.id}`} target="_blank" rel="noreferrer">{f.title}</a> · {f.mimeType} · {Number(f.sizeBytes)} байт</p>)}
      {context.phase === "ACTIVE" ? <ManualDeliverableUploadForm caseId={context.id}/> : null}
    </section>
    <section className="card stack"><h2>История предложений и оплат</h2>
      {context.agreements.map(a => <p key={a.id}>Редакция {a.revision}: {a.title} · €{(a.amountCents/100).toFixed(2)} · {a.supersededAt ? "Заменена новой редакцией" : a.acceptedAt ? "Принята" : "Ожидает принятия"}</p>)}
      {context.receipts.map(r => <p key={r.id}>Оплата €{(r.amountCents/100).toFixed(2)} фактически получена {date(r.receivedAt)}. Записал сотрудник {r.recordedByUserId}.</p>)}
    </section>
  </AdminShell>;
}
