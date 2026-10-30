"use client";

import { createContext, useContext, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { paidServicesV21 } from "@/features/products/services-v21";
import { PreliminarySlotOptions } from "@/components/manual/preliminary-slot-options";

type Props = { applicationId: string; caseId?: string; phase?: string; doctor?: boolean;
  slotId?: string;
  organizational?: boolean;
  agreementId?: string | null; serviceId?: string | null;
  contacts?: { id: string; ordinal: number; status: string }[] };

const errors: Record<string, string> = {
  DOCTOR_ACTION_REQUIRED: "Это действие подтверждает врач. Войдите в учётную запись врача.",
  FULL_QUESTIONNAIRE_REQUIRED: "Для платной услуги нужна полная анкета с согласиями. Организационного запроса недостаточно.",
  CALL_SLOT_CONFLICT: "На это время уже подтверждена другая беседа или консультация.",
  CALL_TIME_UNAVAILABLE: "Выбранное время уже занято. Обновите расписание и выберите другой интервал.",
  CALENDAR_SLOT_UNAVAILABLE: "Выбранное время уже занято. Обновите расписание и выберите другой интервал.",
  CALENDAR_SLOT_CHANGED: "Запись изменилась. Обновите страницу и проверьте новое время перед подтверждением.",
  CALENDAR_INTERVAL_OCCUPIED: "Это время пересекается с другой записью. Выберите свободный интервал.",
  CATALOG_AMOUNT_MISMATCH: "Стоимость не соответствует каталогу и подтверждённому снижению цены.",
  DISCOUNT_SOURCE_INVALID: "Не подтверждены условия снижения цены после первичной оценки.",
  DISCOUNT_ALREADY_USED: "Снижение цены по этой первичной оценке уже использовано.",
  PENDING_CONTACT_RESPONSE: "Остался незавершённый контакт пациента. Сначала ответьте и завершите контакт.",
  PACKAGE_NOT_ENDED: "Согласованный период сопровождения ещё не закончился.",
  CLARIFICATION_WINDOW_OPEN: "Согласованный срок уточнений ещё не закончился.",
  DOCTOR_RESPONSE_REQUIRED: "Сначала нужен содержательный ответ врача в этом контакте.",
  CLARIFICATION_PERIOD_REQUIRED: "Укажите и согласуйте срок одного блока уточнений.",
  MANUAL_CASE_CHANGED: "Состояние изменилось. Обновите страницу и проверьте результат.",
  LEGACY_CASE_PRESERVED: "Для обращения уже действует прежний маршрут. Он сохранён без изменений."
};

const ActionContext = createContext<{ busy: boolean; doctor: boolean; submit: (event: FormEvent<HTMLFormElement>, action: string) => Promise<void> } | null>(null);
function Form({ action, title, children, doctorOnly = false }: { action: string; title: string; children?: ReactNode; doctorOnly?: boolean }) {
  const state = useContext(ActionContext)!;
  return <form className="card stack-sm" onSubmit={e => state.submit(e, action)}>
    {children}<button className="button button--secondary" disabled={state.busy || (doctorOnly && !state.doctor)} type="submit">{title}</button>
    {doctorOnly && !state.doctor ? <small>Требуется учётная запись врача.</small> : null}
  </form>;
}

export function ManualAdminActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [accessUrl, setAccessUrl] = useState("");
  const [createdCaseId, setCreatedCaseId] = useState("");
  const [selectedService, setSelectedService] = useState(props.serviceId ?? paidServicesV21[0].id);
  const service = paidServicesV21.find(s => s.id === selectedService)!;
  const contacts = props.contacts ?? [];
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    setBusy(true); setNotice("");
    const values = new FormData(event.currentTarget);
    const data: Record<string, unknown> = {};
    for (const [key, value] of values) if (typeof value === "string" && value) data[key] = value;
    if (action === "record-payment") {
      data.receivedAt = new Date(String(data.receivedAt)).toISOString();
      data.confirmed = data.confirmed === "on";
    }
    if (action === "start") data.ready = data.ready === "on";
    if (action === "link-organizational-call") data.sameTask = data.sameTask === "on";
    if (action === "extend") data.until = new Date(String(data.until)).toISOString();
    if (action === "create-agreement") {
      data.amountCents = Math.round(Number(data.amountMajor) * 100); delete data.amountMajor;
      if (data.clarificationDays) data.clarificationDays = Number(data.clarificationDays);
      if (data.sameClinicalCase) data.sameClinicalCase = data.sameClinicalCase === "on";
    }
    try {
      const response = await fetch(`/api/admin/applications/${props.applicationId}/manual`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action, data }), cache: "no-store"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.code ?? "MANUAL_ACTION_FAILED");
      if (result.accessUrl) setAccessUrl(result.accessUrl);
      if (result.caseId) setCreatedCaseId(result.caseId);
      setNotice(result.delivery === "captured" ? "Ссылка создана. Тестовое письмо перехвачено, не доставлено." :
        result.delivery === "sent" ? "Персональная ссылка отправлена пациенту." :
        result.delivery === "failed" ? "Ссылка создана, письмо не отправлено. Передайте её пациенту согласованным способом." : "Изменение сохранено.");
      // Keep the new private link and delivery result visible after the first send.
      if (action !== "create") router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "MANUAL_ACTION_FAILED";
      setNotice(errors[code] ?? "Действие не выполнено: проверьте этап обращения и обязательные поля. Состояние можно уточнить после обновления страницы.");
    } finally { setBusy(false); }
  }
  const state = { busy, doctor: Boolean(props.doctor), submit };
  if (!props.caseId) return <ActionContext.Provider value={state}><div className="stack">
    <p>Пациент получит персональный вход и сможет выбрать время предварительной беседы из открытых вами интервалов.</p>
    <Form action="create" title="Отправить пациенту ссылку для записи"><input type="hidden" name="sendLink" value="on"/></Form>
    {notice ? <p role="status" className="notice">{notice}</p> : null}
    {createdCaseId ? <a className="button button--secondary" href={`/admin/manual/${createdCaseId}`}>Открыть запись и кабинет пациента</a> : null}
    {accessUrl ? <div className="notice stack-sm"><strong>Персональная ссылка пациента</strong>
      <input aria-label="Персональная ссылка пациента" value={accessUrl} readOnly onFocus={event => event.currentTarget.select()}/>
      <small>Ссылка конфиденциальна. Не пересылайте её третьим лицам.</small></div> : null}
  </div></ActionContext.Provider>;
  return <ActionContext.Provider value={state}><section className="stack">
    {notice ? <p role="status" className="notice">{notice}</p> : null}
    <Form action="reissue-access" title="Отправить пациенту ссылку для записи">
      <p>Ссылка предназначена только владельцу обращения. Прежние ссылки будут отозваны. Не пересылайте её третьим лицам.</p>
      <input type="hidden" name="sendLink" value="on"/>
    </Form>
    {accessUrl ? <div className="notice stack-sm"><strong>Новая персональная ссылка</strong>
      <input aria-label="Персональная ссылка пациента" value={accessUrl} readOnly onFocus={e => e.currentTarget.select()}/>
      <small>Ссылка доступа конфиденциальна. Она не добавляется в адрес страницы администратора.</small></div> : null}
    {["REVIEW", "CALL_REQUESTED", "CALL_CONFIRMED"].includes(props.phase ?? "") ? <>
      <Form action="request-call" title="Сохранить выбранное время беседы">
        <p>Сначала откройте интервалы в календаре. При переносе прежняя бронь освобождается только после сохранения новой.</p>
        <PreliminarySlotOptions staffCaseId={props.caseId}/>
      </Form>
      <a className="text-link" href="/admin/calendar">Открыть календарь месяца →</a>
      {props.phase === "CALL_REQUESTED" ? <Form action="confirm-call" title="Подтвердить время беседы" doctorOnly>
        {props.slotId ? <input type="hidden" name="slotId" value={props.slotId}/> : null}
      </Form> : null}
      {props.phase === "CALL_CONFIRMED" ? <Form action="complete-call" title="Подтвердить, что беседа проведена" doctorOnly/> : null}
      {["CALL_REQUESTED", "CALL_CONFIRMED"].includes(props.phase ?? "") ? <Form action="cancel-call" title="Отменить запись и освободить время" doctorOnly>
        {props.slotId ? <input type="hidden" name="slotId" value={props.slotId}/> : null}
        <label className="field"><span>Причина отмены для истории обращения</span><input name="reason" minLength={3} maxLength={1000} required/></label>
      </Form> : null}
    </> : null}
    {!props.organizational && ["REVIEW", "CALL_REQUESTED"].includes(props.phase ?? "") ? <Form action="link-organizational-call" title="Учесть уже проведённую организационную беседу" doctorOnly>
      <p>Используйте только после полной новой анкеты пациента, если тот же вопрос уже уточнён на организационной беседе. Исходное обращение сохраняется.</p>
      <label className="field"><span>ID обращения организационного подбора</span><input name="sourceCaseId" maxLength={160} required/></label>
      <label><input type="checkbox" name="sameTask" required/> Подтверждаю, что беседа проведена по той же задаче и повторять её не требуется</label>
    </Form> : null}
    {props.organizational && props.phase === "CALL_COMPLETED" ? <div className="notice stack-sm">
      <p>Организационный подбор завершён. Для платной услуги пациент сначала заполняет полную анкету с согласиями.</p>
      <p>Врач сможет учесть эту беседу в новой анкете. ID исходного обращения: {props.caseId}.</p>
      <a className="text-link" href="/questionnaire">Открыть полную анкету</a>
    </div> : null}
    {!props.organizational && ["CALL_COMPLETED", "OFFERED", "ACCEPTED"].includes(props.phase ?? "") ? <Form action="create-agreement" title="Подготовить окончательное предложение" doctorOnly>
      <p>Новая редакция заменяет прежнее предложение и требует нового принятия пациентом. После оплаты условия не заменяются.</p>
      <label className="field"><span>Услуга v2.1</span><select name="serviceId" value={selectedService} onChange={e => setSelectedService(e.target.value)}>{paidServicesV21.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <label className="field"><span>Окончательная стоимость, EUR</span><input key={selectedService} type="number" name="amountMajor" min="0.01" step="0.01" defaultValue={service.amountCents/100} required/></label>
      <label className="field"><span>Согласованный объём и результат</span><textarea name="scope" rows={6} maxLength={12000} defaultValue={service.scope.join("\n")} key={`scope-${selectedService}`} required/></label>
      <label className="field"><span>Подтверждённый срок подготовки</span><textarea name="turnaround" maxLength={1000} defaultValue={service.turnaround} key={`term-${selectedService}`} required/></label>
      {selectedService === "clinical-review" ? <label className="field"><span>Согласованный срок одного блока уточнений, календарных дней</span><input name="clarificationDays" type="number" min={1} max={30} required/></label> : null}
      <details><summary>Снижение цены после первичной оценки</summary>
        <p>€10 однократно в течение 45 календарных дней после результата первичной оценки по той же проблеме. Система проверит основание.</p>
        <label className="field"><span>ID обращения первичной оценки</span><input name="discountSourceCaseId" maxLength={160}/></label>
        <label><input type="checkbox" name="sameClinicalCase"/> Подтверждаю, что это тот же клинический случай</label>
      </details>
    </Form> : null}
    {props.phase === "ACCEPTED" && props.agreementId ? <Form action="record-payment" title="Зафиксировать фактически полученную оплату">
      <input type="hidden" name="agreementId" value={props.agreementId}/>
      <label className="field"><span>Когда получена полная оплата ({zone})</span><input name="receivedAt" type="datetime-local" required/></label>
      <label><input type="checkbox" name="confirmed" required/> Подтверждаю получение полной согласованной суммы вне сайта</label>
      <p>Кнопка не переводит деньги и не начинает работу автоматически.</p>
    </Form> : null}
    {props.phase === "PAID" ? <Form action="start" title="Начать работу" doctorOnly>
      <label><input name="ready" type="checkbox" required/> Все необходимые материалы получены, можно начать согласованный период работы</label>
    </Form> : null}
    {props.phase === "ACTIVE" ? <>
      <Form action="deliver-result" title="Выдать результат и зафиксировать дату" doctorOnly>
        <label className="field"><span>Заключение или сообщение о выданном результате</span><textarea name="body" maxLength={12000} rows={6} required/></label>
        <p>Если результат — файл, сначала выдайте его в разделе материалов ниже. Дата результата запускает предусмотренное услугой окно уточнений.</p>
      </Form>
      <Form action="open-contact" title="Открыть плановый контакт" doctorOnly>
        <label className="field"><span>Вопросы и задача планового контакта</span><textarea name="body" maxLength={12000} rows={3} required/></label>
      </Form>
      <Form action="extend" title="Зафиксировать согласованное продление" doctorOnly>
        <label className="field"><span>Новый конец периода ({zone})</span><input name="until" type="datetime-local" required/></label>
        <label className="field"><span>Причина и согласование с пациентом</span><textarea name="reason" minLength={5} maxLength={1000} required/></label>
      </Form>
    </> : null}
    {props.phase !== "COMPLETED" ? <Form action="reply" title="Отправить ответ в кабинет">
      <label className="field"><span>Куда относится ответ</span><select name="contactId"><option value="">Организационный вопрос</option>{contacts.filter(c => c.status === "OPEN").map(c => <option value={c.id} key={c.id}>Контакт {c.ordinal}</option>)}</select></label>
      <label className="field"><span>Ответ</span><textarea name="body" maxLength={12000} rows={5} required/></label>
    </Form> : null}
    {contacts.filter(c => c.status === "OPEN").map(c => <Form action="complete-contact" title={`Завершить контакт ${c.ordinal} после ответа и необходимых уточнений`} doctorOnly key={c.id}><input type="hidden" name="contactId" value={c.id}/></Form>)}
    {["ACTIVE", "CALL_COMPLETED"].includes(props.phase ?? "") ? <Form action="complete" title="Завершить работу и открыть 30 дней истории" doctorOnly>
      <p>Завершение возможно после результата, окончания согласованного периода и ответов на своевременные обращения. Для бесплатного подбора — после организационной беседы.</p>
    </Form> : null}
  </section></ActionContext.Provider>;
}
