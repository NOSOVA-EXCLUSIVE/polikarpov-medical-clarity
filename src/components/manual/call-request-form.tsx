"use client";

import { PreliminarySlotOptions } from "./preliminary-slot-options";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ManualCallRequestForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/manual/actions", { method: "POST", body: data,
        credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("BOOKING_NOT_CONFIRMED");
      const result = await response.json();
      if (result.status !== "saved") throw new Error("BOOKING_NOT_CONFIRMED");
      setMessage("Выбранное время сохранено и ожидает подтверждения врача.");
      router.refresh();
    } catch {
      setMessage("Не удалось подтвердить выбор. Возможно, время уже занято. Проверьте обновлённый список и выберите доступный интервал.");
    } finally { setBusy(false); setRevision(value => value + 1); }
  }
  return <form action="/api/manual/actions" method="post" className="stack" onSubmit={submit}>
    <input type="hidden" name="action" value="request-call" />
    <PreliminarySlotOptions key={revision} onReadyChange={setReady} />
    <p className="muted">Предварительная беседа проходит до окончательного предложения и оплаты. Выбор времени не начинает платную услугу.</p>
    {message ? <p className="notice" role="status">{message}</p> : null}
    <div><button className="button" type="submit" disabled={!ready || busy}>{busy ? "Сохраняем выбор…" : "Подтвердить выбор времени"}</button></div>
  </form>;
}
