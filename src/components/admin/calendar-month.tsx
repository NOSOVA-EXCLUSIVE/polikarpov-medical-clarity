"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type CalendarMonthSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "AVAILABLE" | "PENDING" | "CONFIRMED" | "BLOCKED" | "LEGACY_HELD" | "LEGACY_BOOKED";
  patientName?: string;
  applicationId?: string;
  displayNumber?: string;
  editable?: boolean;
  kind: "PRELIMINARY" | "LEGACY";
};
export type CalendarMonthDay = { date: string; slots: CalendarMonthSlot[] };
export type CalendarMonthData = { month: string; timeZone: string; days: CalendarMonthDay[] };

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const labels: Record<CalendarMonthSlot["status"], string> = {
  AVAILABLE: "Свободно", PENDING: "Ожидает подтверждения", CONFIRMED: "Записан",
  BLOCKED: "Закрыто врачом", LEGACY_HELD: "Временно удержано", LEGACY_BOOKED: "Записан · прежнее обращение"
};

function calendarHref(month: string, timeZone: string) {
  return `/admin/calendar?${new URLSearchParams({ month, timezone: timeZone })}`;
}
function adjacentMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function daySummary(day: CalendarMonthDay) {
  const free = day.slots.filter(slot => slot.status === "AVAILABLE").length;
  const occupied = day.slots.filter(slot => ["CONFIRMED", "LEGACY_BOOKED", "PENDING", "LEGACY_HELD"].includes(slot.status)).length;
  if (!day.slots.length) return "Время не открыто";
  if (free) return `Свободно: ${free}${occupied ? ` · занято: ${occupied}` : ""}`;
  return occupied ? `Свободного времени нет · записей: ${occupied}` : "Время закрыто";
}

export function AdminCalendarMonth({ calendar, today }: { calendar: CalendarMonthData; today: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [year, number] = calendar.month.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, number - 1, 1));
  const leading = (firstDay.getUTCDay() + 6) % 7;
  const trailing = (7 - (leading + calendar.days.length) % 7) % 7;
  const monthTitle = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(firstDay);
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: calendar.timeZone });
  const slotDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: calendar.timeZone });
  const dayTitle = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" });
  const zones = Array.from(new Set([calendar.timeZone, "Europe/Moscow", "Europe/Kaliningrad", "Europe/Berlin", "Asia/Yekaterinburg", "Asia/Novosibirsk", "Asia/Vladivostok"]));

  async function changeSlot(slot: CalendarMonthSlot, action: "block" | "release") {
    if (busyId) return;
    setBusyId(slot.id); setFeedback(null);
    try {
      const response = await fetch("/api/admin/calendar/preliminary", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, slotId: slot.id }), cache: "no-store"
      });
      if (!response.ok) throw new Error("CALENDAR_ACTION_FAILED");
      const result = await response.json();
      if (result.success !== true) throw new Error("CALENDAR_ACTION_NOT_CONFIRMED");
      setFeedback({ error: false, text: action === "block" ? "Время закрыто для новых записей." : "Время снова доступно пациентам." });
      router.refresh();
    } catch {
      setFeedback({ error: true, text: "Не удалось изменить время. Обновите календарь и проверьте, не было ли оно уже выбрано пациентом." });
    } finally { setBusyId(null); }
  }

  function slotView(slot: CalendarMonthSlot) {
    const action = slot.editable === false ? null : slot.status === "AVAILABLE" ? "block" : slot.status === "BLOCKED" ? "release" : null;
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(slot.endsAt);
    const crossesDate = slotDate.format(startsAt) !== slotDate.format(endsAt);
    const range = crossesDate ? `${slotDate.format(startsAt)} ${time.format(startsAt)} — ${slotDate.format(endsAt)} ${time.format(endsAt)}` : `${time.format(startsAt)}–${time.format(endsAt)}`;
    return <article key={`${slot.kind}-${slot.id}`} className={`admin-calendar__slot admin-calendar__slot--${slot.status.toLowerCase()}`}>
      <strong className="admin-calendar__slot-time">{range}</strong>
      <span className="admin-calendar__slot-status">{labels[slot.status]}</span>
      <span className="admin-calendar__slot-kind">{slot.kind === "PRELIMINARY" ? "Предварительная беседа" : "Консультация"}</span>
      {slot.applicationId ? <Link className="admin-calendar__patient" href={`/admin/applications/${slot.applicationId}`}>
        {slot.patientName || "Открыть обращение"}{slot.displayNumber ? <span>{slot.displayNumber}</span> : null}
      </Link> : slot.patientName ? <span className="admin-calendar__patient">{slot.patientName}</span> : null}
      {action && slot.kind === "PRELIMINARY" ? <button className="admin-calendar__slot-action" disabled={Boolean(busyId)} onClick={() => changeSlot(slot, action)} type="button">
        {busyId === slot.id ? "Сохраняем…" : action === "block" ? "Закрыть время" : "Открыть снова"}
      </button> : null}
      {action && slot.kind === "LEGACY" ? <form action={`/api/admin/calendar/slots/${slot.id}`} method="post">
        <input type="hidden" name="action" value={action}/>
        {action === "block" ? <input type="hidden" name="note" value="Слот временно заблокирован врачом."/> : null}
        <button className="admin-calendar__slot-action" type="submit">{action === "block" ? "Закрыть время" : "Открыть снова"}</button>
      </form> : null}
    </article>;
  }

  return <section className="admin-calendar" aria-label="Расписание врача на месяц">
    <div className="admin-calendar__toolbar">
      <div className="admin-calendar__month-nav">
        <Link className="admin-calendar__nav-button" href={calendarHref(adjacentMonth(calendar.month, -1), calendar.timeZone)} aria-label="Предыдущий месяц">←</Link>
        <h2 className="admin-calendar__month-title">{monthTitle}</h2>
        <Link className="admin-calendar__nav-button" href={calendarHref(adjacentMonth(calendar.month, 1), calendar.timeZone)} aria-label="Следующий месяц">→</Link>
        <Link className="admin-calendar__today-link" href={calendarHref(today.slice(0, 7), calendar.timeZone)}>Сегодня</Link>
      </div>
      <form className="admin-calendar__timezone" method="get" action="/admin/calendar">
        <input name="month" type="hidden" value={calendar.month}/>
        <label htmlFor="calendar-timezone">Часовой пояс расписания</label>
        <div><select defaultValue={calendar.timeZone} id="calendar-timezone" name="timezone">{zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select>
          <button className="admin-calendar__nav-button" type="submit">Показать</button></div>
      </form>
    </div>
    <p className="admin-calendar__intro">Все интервалы показаны сразу. Даты и время ниже указаны в часовом поясе <strong>{calendar.timeZone}</strong>.</p>
    <ul className="admin-calendar__legend" aria-label="Обозначения расписания">
      <li><span className="admin-calendar__dot admin-calendar__dot--free"/>Свободно</li>
      <li><span className="admin-calendar__dot admin-calendar__dot--pending"/>Ожидает подтверждения</li>
      <li><span className="admin-calendar__dot admin-calendar__dot--booked"/>Записан</li>
      <li><span className="admin-calendar__dot admin-calendar__dot--blocked"/>Закрыто</li>
    </ul>
    {feedback ? <p role={feedback.error ? "alert" : "status"} className={`notice ${feedback.error ? "notice--danger" : ""}`}>{feedback.text}</p> : null}
    <div className="admin-calendar__desktop">
      <div className="admin-calendar__weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <ol className="admin-calendar__month-grid">
        {Array.from({ length: leading }, (_, index) => <li key={`before-${index}`} className="admin-calendar__empty" aria-hidden="true"/>)}
        {calendar.days.map(day => <li key={day.date} className={`admin-calendar__day ${day.date === today ? "admin-calendar__day--today" : ""}`}>
          <div className="admin-calendar__day-heading"><h3><time dateTime={day.date}>{Number(day.date.slice(-2))}</time></h3>{day.date === today ? <span>Сегодня</span> : null}</div>
          <p className="admin-calendar__day-summary">{daySummary(day)}</p>
          <div className="admin-calendar__day-slots">{day.slots.map(slotView)}</div>
        </li>)}
        {Array.from({ length: trailing }, (_, index) => <li key={`after-${index}`} className="admin-calendar__empty" aria-hidden="true"/>)}
      </ol>
    </div>
    <div className="admin-calendar__mobile">
      <div className="admin-calendar__weekdays" aria-hidden="true">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <ol className="admin-calendar__mobile-grid" aria-label="Обзор месяца; полное расписание ниже">
        {Array.from({ length: leading }, (_, index) => <li key={`before-${index}`} aria-hidden="true"/>)}
        {calendar.days.map(day => {
          const free = day.slots.filter(slot => slot.status === "AVAILABLE").length;
          const occupied = day.slots.filter(slot => ["CONFIRMED", "LEGACY_BOOKED", "PENDING", "LEGACY_HELD"].includes(slot.status)).length;
          return <li key={day.date}><a href={`#calendar-agenda-${day.date}`} className={day.date === today ? "admin-calendar__mobile-day admin-calendar__mobile-day--today" : "admin-calendar__mobile-day"} aria-label={`${dayTitle.format(new Date(`${day.date}T12:00:00Z`))}: ${daySummary(day)}`}>
            <time dateTime={day.date}>{Number(day.date.slice(-2))}</time>
            {free ? <span className="admin-calendar__mini-free">Св. {free}</span> : null}
            {occupied ? <span className="admin-calendar__mini-busy">Зан. {occupied}</span> : null}
            {!free && !occupied ? <span className="admin-calendar__mini-empty">{day.slots.length ? "Закр." : "—"}</span> : null}
          </a></li>;
        })}
      </ol>
      <p className="admin-calendar__intro">Всё время на каждый день — ниже. Нажатие на дату только прокручивает к ней список.</p>
      <div className="admin-calendar__agenda">{calendar.days.map(day => <section key={day.date} id={`calendar-agenda-${day.date}`} className="admin-calendar__agenda-day">
        <h3><time dateTime={day.date}>{dayTitle.format(new Date(`${day.date}T12:00:00Z`))}</time>{day.date === today ? <span>Сегодня</span> : null}</h3>
        <p className="admin-calendar__day-summary">{daySummary(day)}</p>
        <div className="admin-calendar__day-slots">{day.slots.map(slotView)}</div>
      </section>)}</div>
    </div>
  </section>;
}
