"use client";

import { useEffect, useState } from "react";

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: "AVAILABLE" | "PENDING" | "CONFIRMED";
  own: boolean;
};

export function PreliminarySlotOptions({ staffCaseId, onReadyChange }: { staffCaseId?: string; onReadyChange?: (ready: boolean) => void }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState("");
  const [timeZone, setTimeZone] = useState("Europe/Moscow");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const url = staffCaseId
      ? `/api/admin/calendar/preliminary?available=1&caseId=${encodeURIComponent(staffCaseId)}`
      : "/api/manual/slots";
    fetch(url, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("SLOTS_UNAVAILABLE");
        const result = await response.json();
        if (!Array.isArray(result.slots)) throw new Error("SLOTS_UNAVAILABLE");
        const safeSlots: Slot[] = result.slots.filter((slot: Slot) => slot && typeof slot.id === "string"
          && ["AVAILABLE", "PENDING", "CONFIRMED"].includes(slot.status)
          && Number.isFinite(Date.parse(slot.startsAt)) && Number.isFinite(Date.parse(slot.endsAt)));
        if (controller.signal.aborted) return;
        setSlots(safeSlots);
        setSelected(previous => safeSlots.some(slot => slot.id === previous) ? previous : safeSlots.find(slot => slot.own)?.id || "");
      })
      .catch(() => { if (!controller.signal.aborted) setError("Не удалось загрузить свободное время. Обновите список или свяжитесь с врачом."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [staffCaseId, revision]);

  useEffect(() => {
    onReadyChange?.(!loading && !error && slots.some(slot => slot.id === selected));
  }, [loading, error, selected, slots, onReadyChange]);

  const zones = [...new Set([timeZone, "Europe/Moscow", "Europe/Berlin", "Asia/Jerusalem", "Asia/Dubai", "Asia/Yekaterinburg", "Asia/Almaty", "Asia/Bangkok", "UTC"])];
  const dayFormatter = new Intl.DateTimeFormat("ru-RU", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeFormatter = new Intl.DateTimeFormat("ru-RU", { timeZone, hour: "2-digit", minute: "2-digit" });
  const grouped = new Map<string, Slot[]>();
  for (const slot of slots) {
    const day = dayFormatter.format(new Date(slot.startsAt));
    grouped.set(day, [...(grouped.get(day) || []), slot]);
  }

  return <div className="preliminary-slot-picker stack">
    <div className="preliminary-slot-toolbar">
      <label className="field"><span>Часовой пояс отображения</span>
        <select value={timeZone} onChange={event => setTimeZone(event.target.value)}>
          {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
        </select>
      </label>
      <button type="button" className="button button--secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>Обновить свободное время</button>
    </div>
    <p className="muted">Показано время, открытое врачом, в часовом поясе {timeZone}. После подтверждения выбора интервал резервируется за этим обращением; запись подтверждает врач.</p>
    {loading ? <p role="status">Загружаем расписание…</p> : error ? <p role="alert" className="notice">{error}</p>
      : slots.length === 0 ? <p className="notice" role="status">Свободное время пока не открыто. Врач добавит интервалы; после этого обновите список.</p>
      : <div className="preliminary-slot-days">{[...grouped].map(([day, daySlots]) => <fieldset className="preliminary-slot-day stack-sm" key={day}>
        <legend><strong>{day}</strong></legend>
        {daySlots.map(slot => <label className="preliminary-slot-option" key={slot.id}>
          <input name="slotId" type="radio" value={slot.id} required checked={selected === slot.id} onChange={() => setSelected(slot.id)} disabled={loading}/>
          <span><strong>{timeFormatter.format(new Date(slot.startsAt))}–{timeFormatter.format(new Date(slot.endsAt))}</strong>
            <span className="muted">{slot.own ? slot.status === "CONFIRMED" ? " · Ваша подтверждённая запись" : " · Ожидает подтверждения врача" : " · Свободно"}</span>
          </span>
        </label>)}
      </fieldset>)}</div>}
  </div>;
}
