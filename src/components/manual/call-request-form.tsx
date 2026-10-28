"use client";

import { useRef, useState } from "react";

export function ManualCallRequestForm() {
  const [error, setError] = useState("");
  const starts = useRef<HTMLInputElement>(null);
  const ends = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLInputElement>(null);
  return <form action="/api/manual/actions" method="post" className="stack" onSubmit={(event) => {
    const form = event.currentTarget;
    const choice = (form.elements.namedItem("localStart") as HTMLInputElement).value;
    const date = new Date(choice);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      event.preventDefault(); setError("Выберите время в будущем."); return;
    }
    if (starts.current && ends.current && zone.current) {
      starts.current.value = date.toISOString();
      ends.current.value = new Date(date.getTime() + 30 * 60 * 1000).toISOString();
      zone.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  }}>
    <input type="hidden" name="action" value="request-call" />
    <input type="hidden" name="startsAt" ref={starts} />
    <input type="hidden" name="endsAt" ref={ends} />
    <input type="hidden" name="timezone" ref={zone} />
    <label className="field"><span>Удобное время предварительной беседы с врачом</span>
      <input type="datetime-local" name="localStart" required /></label>
    <p className="muted">Время указано по часовому поясу вашего устройства. Запрос на 30 минут — предложение времени;
      окончательную дату и длительность подтверждает врач. Это не оплата и не начало услуги.</p>
    {error ? <p role="alert">{error}</p> : null}
    <div><button className="button" type="submit">Предложить время</button></div>
  </form>;
}
