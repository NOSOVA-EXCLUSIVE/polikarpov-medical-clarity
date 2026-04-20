"use client";

import { useMemo, useState } from "react";

function initialLocalDateTime() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  const hours = `${now.getHours()}`.padStart(2, "0");
  const minutes = `${now.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoOrEmpty(value: string) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export function AdminCalendarCreateForm() {
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow",
    []
  );
  const [localDateTime, setLocalDateTime] = useState(initialLocalDateTime);
  const startsAtIso = toIsoOrEmpty(localDateTime);

  return (
    <form action="/api/admin/calendar/slots" className="form-grid" method="post">
      <label className="field">
        <span>Дата и время</span>
        <input
          required
          type="datetime-local"
          value={localDateTime}
          onChange={(event) => setLocalDateTime(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Длительность в минутах</span>
        <input defaultValue="45" min="15" name="durationMinutes" required type="number" />
      </label>
      <input name="startsAtIso" type="hidden" value={startsAtIso} />
      <input name="timezone" type="hidden" value={timezone} />
      <div className="field field--full">
        <p className="muted">
          Слот будет создан в вашем текущем часовом поясе: {timezone}.
        </p>
      </div>
      <div className="field--full">
        <button className="button" type="submit">
          Добавить слот
        </button>
      </div>
    </form>
  );
}
