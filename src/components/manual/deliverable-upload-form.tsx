"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MANUAL_DIRECT_DELIVERY_MAX_BYTES, MANUAL_DELIVERY_TYPES } from "@/features/manual-v21/delivery-policy";

export function ManualDeliverableUploadForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const base = `/api/admin/manual/${encodeURIComponent(caseId)}/deliverables`;

  async function confirm(id: string) {
    setStatus("Проверяем файл в приватном хранилище…");
    const response = await fetch(`${base}/complete`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }), cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error("Файл ещё не подтверждён и пациенту не выдан. Можно повторить проверку.");
    setPending(null); setStatus("Файл проверен и выдан в кабинет пациента."); router.refresh();
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const title = String(data.get("title") || "").trim();
    if (!(file instanceof File) || !file.size || file.size > MANUAL_DIRECT_DELIVERY_MAX_BYTES ||
        !MANUAL_DELIVERY_TYPES.has(file.type) || !title || title.length > 180) {
      setStatus("Выберите PDF, PNG, JPEG или MP4 до 250 МиБ и укажите название."); return;
    }
    setBusy(true); setPending(null);
    try {
      setStatus("Подготавливаем закрытую загрузку…");
      const prepared = await fetch(`${base}/presign`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, mimeType: file.type, sizeBytes: file.size }), cache: "no-store", credentials: "same-origin" });
      if (!prepared.ok) throw new Error("Загрузка не подготовлена. Проверьте состояние обращения и допустимый размер файла.");
      const result: unknown = await prepared.json();
      if (!result || typeof result !== "object" || !("id" in result) || !("uploadUrl" in result) ||
          typeof result.id !== "string" || typeof result.uploadUrl !== "string") throw new Error("Не удалось подготовить загрузку.");
      const target = new URL(result.uploadUrl);
      if (target.origin !== "https://vercel.com" || target.pathname !== "/api/blob/" ||
          !target.searchParams.get("pathname")?.startsWith(`manual-deliverables/${caseId}/`)) {
        throw new Error("Не удалось подтвердить адрес приватной загрузки.");
      }
      setStatus("Файл загружается прямо в приватное хранилище. Не закрывайте эту страницу…");
      const uploadResponse = await fetch(target, { method: "PUT", headers: { "Content-Type": file.type },
        body: file, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
      if (!uploadResponse.ok) throw new Error("Передача файла не завершена. Пациент пока его не видит.");
      setPending(result.id);
      await confirm(result.id);
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Загрузка не завершена.");
    } finally { setBusy(false); }
  }

  return <form onSubmit={upload} className="stack">
    <label className="field"><span>Название материала</span><input name="title" maxLength={180} required disabled={busy} /></label>
    <label className="field"><span>PDF, PNG, JPEG или MP4, до 250 МиБ</span>
      <input type="file" name="file" accept="application/pdf,image/png,image/jpeg,video/mp4" required disabled={busy} /></label>
    <p className="muted">Файл станет доступен пациенту после проверки размера, типа и принадлежности обращению.
      Маркировка номером обращения отображается при просмотре и не встраивается в исходный файл.</p>
    {status ? <p role="status" aria-live="polite">{status}</p> : null}
    <div className="button-row"><button className="button" type="submit" disabled={busy}>
      {busy ? "Загрузка и проверка…" : "Загрузить и выдать материал"}</button>
      {pending && !busy ? <button className="button button--secondary" type="button" onClick={async () => {
        setBusy(true); try { await confirm(pending); } catch (error) {
          setStatus(error instanceof Error ? error.message : "Файл ещё не подтверждён.");
        } finally { setBusy(false); }
      }}>Повторить проверку загруженного файла</button> : null}
    </div>
  </form>;
}
