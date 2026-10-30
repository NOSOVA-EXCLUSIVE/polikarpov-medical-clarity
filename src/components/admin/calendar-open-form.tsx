"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AdminCalendarOpenForm({ dates, timeZone }: { dates: string[]; timeZone: string }) {
  const router = useRouter();
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const formatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" });

  function toggleDate(date: string) {
    setSelectedDates(current => current.includes(date) ? current.filter(item => item !== date) : [...current, date].sort());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFeedback(null);
    if (!selectedDates.length) { setFeedback({ error: true, text: "Выберите хотя бы одну дату, для которой нужно открыть время." }); return; }
    const form = new FormData(event.currentTarget);
    const startTime = String(form.get("startTime") || "");
    const endTime = String(form.get("endTime") || "");
    const durationMinutes = Number(form.get("durationMinutes"));
    if (!startTime || !endTime || startTime >= endTime || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 180) {
      setFeedback({ error: true, text: "Проверьте начало, окончание и длительность: окончание должно быть позже начала в тот же день." }); return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/calendar/preliminary", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open", dates: selectedDates, startTime, endTime, durationMinutes, timezone: timeZone }), cache: "no-store"
      });
      if (!response.ok) throw new Error("OPEN_CALENDAR_FAILED");
      const result = await response.json();
      if (result.success !== true || !Number.isInteger(result.createdCount) || result.createdCount < 1) throw new Error("OPEN_CALENDAR_NOT_CONFIRMED");
      setFeedback({ error: false, text: "Время открыто. Новые интервалы доступны в календаре и для записи пациентов." });
      setSelectedDates([]); router.refresh();
    } catch {
      setFeedback({ error: true, text: "Не удалось открыть время. Проверьте даты, часовой пояс и пересечения с уже открытыми интервалами или записями, затем обновите календарь." });
    } finally { setBusy(false); }
  }

  return <section className="card admin-calendar-open" id="calendar-open-time">
    <div className="stack-sm"><h2 className="admin-section-title">Открыть время для предварительных бесед</h2>
      <p className="muted">Выберите одну или несколько дат и удобный период. Пациенты смогут записаться только в открытые Вами интервалы.</p></div>
    {dates.length ? <form className="admin-calendar-open__form" onSubmit={submit}>
      <fieldset className="admin-calendar-open__dates" disabled={busy}>
        <legend>Даты этого месяца</legend>
        <div className="admin-calendar-open__presets">
          <button type="button" className="admin-calendar__slot-action" onClick={() => setSelectedDates(dates.filter(date => { const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); return weekday !== 0 && weekday !== 6; }))}>Выбрать будни</button>
          <button type="button" className="admin-calendar__slot-action" onClick={() => setSelectedDates([])}>Снять выбор</button>
          <span>Выбрано дат: {selectedDates.length}</span>
        </div>
        <div className="admin-calendar-open__date-options">{dates.map(date => <label key={date} className={selectedDates.includes(date) ? "admin-calendar-open__date admin-calendar-open__date--selected" : "admin-calendar-open__date"}>
          <input type="checkbox" checked={selectedDates.includes(date)} onChange={() => toggleDate(date)}/><span>{formatter.format(new Date(`${date}T12:00:00Z`))}</span>
        </label>)}</div>
      </fieldset>
      <div className="admin-calendar-open__time-fields">
        <label className="field"><span>Начало периода</span><input type="time" name="startTime" defaultValue="10:00" required disabled={busy}/></label>
        <label className="field"><span>Окончание периода</span><input type="time" name="endTime" defaultValue="13:00" required disabled={busy}/></label>
        <label className="field"><span>Длительность беседы, минут</span><select name="durationMinutes" defaultValue="30" disabled={busy}>
          <option value="15">15</option><option value="30">30</option><option value="45">45</option><option value="60">60</option>
        </select></label>
      </div>
      <p className="muted">Часовой пояс: <strong>{timeZone}</strong>. Период делится на последовательные интервалы выбранной длительности. Укажите только время, когда Вы готовы принять пациента.</p>
      {feedback ? <p className={`notice ${feedback.error ? "notice--danger" : ""}`} role={feedback.error ? "alert" : "status"}>{feedback.text}</p> : null}
      <div><button className="button" type="submit" disabled={busy}>{busy ? "Открываем время…" : "Открыть выбранное время"}</button></div>
    </form> : <p className="muted">В этом месяце не осталось будущих дат. Перейдите к следующему месяцу, чтобы открыть время.</p>}
  </section>;
}
