"use client";

import { useState } from "react";

type UploadCategory = "DOCUMENT" | "IMAGE" | "VIDEO";
type LinkKind = "IMAGING" | "VIDEO" | "CLOUD";

type UploadDraft = {
  id: string;
  category: UploadCategory;
  originalName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  durationSeconds?: number;
  storageKey: string;
  accessPassword?: string;
  accessInstructions?: string;
};

type LinkDraft = {
  id: string;
  kind: LinkKind;
  url: string;
  label?: string;
  note?: string;
  accessPassword?: string;
  accessInstructions?: string;
};

function extensionOf(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() ?? "" : "";
}

async function videoDuration(file: File) {
  return await new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(Math.ceil(video.duration));
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Не удалось определить длительность видео."));
    };
    video.src = objectUrl;
  });
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadCategoryLabel(category: UploadCategory) {
  switch (category) {
    case "DOCUMENT":
      return "документы";
    case "IMAGE":
      return "изображения";
    case "VIDEO":
      return "видео";
    default:
      return "файлы";
  }
}

function uploadCardLabel(category: UploadCategory) {
  switch (category) {
    case "DOCUMENT":
      return "Документ или архив";
    case "IMAGE":
      return "Изображение";
    case "VIDEO":
      return "Видео";
    default:
      return category;
  }
}

function linkKindLabel(kind: LinkKind) {
  switch (kind) {
    case "IMAGING":
      return "Ссылка на исследование";
    case "VIDEO":
      return "Ссылка на видео";
    case "CLOUD":
      return "Облако / архив";
    default:
      return kind;
  }
}

export function PortalMaterialsForm({
  token
}: {
  token: string;
}) {
  const [uploads, setUploads] = useState<UploadDraft[]>([]);
  const [links, setLinks] = useState<LinkDraft[]>([]);
  const [savedLinks, setSavedLinks] = useState<LinkDraft[]>([]);
  const [uploadingCategory, setUploadingCategory] = useState<UploadCategory | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const uploadFiles = async (category: UploadCategory, files: FileList | null) => {
    if (!files?.length) return;

    setUploadingCategory(category);
    setErrorMessage(null);

    try {
      const nextUploads: UploadDraft[] = [];

      for (const file of Array.from(files)) {
        const durationSeconds = category === "VIDEO" ? await videoDuration(file) : undefined;

        const presignResponse = await fetch(`/api/portal/materials/${token}/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            durationSeconds
          })
        });

        const presignPayload = await presignResponse.json();
        if (!presignResponse.ok || !presignPayload.ok) {
          throw new Error(
            presignPayload?.error?.message ?? "Не удалось подготовить загрузку файла."
          );
        }

        const storageResponse = await fetch(presignPayload.data.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || presignPayload.data.contentType
          },
          body: file
        });

        if (!storageResponse.ok) {
          throw new Error("Не удалось загрузить файл в защищённое хранилище.");
        }

        const completeResponse = await fetch(`/api/portal/materials/${token}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            originalName: file.name,
            mimeType: file.type || "application/octet-stream",
            extension: extensionOf(file.name),
            sizeBytes: file.size,
            durationSeconds,
            storageKey: presignPayload.data.storageKey
          })
        });

        const completePayload = await completeResponse.json();
        if (!completeResponse.ok || !completePayload.ok) {
          throw new Error(
            completePayload?.error?.message ?? "Не удалось сохранить загруженный файл."
          );
        }

        nextUploads.push({
          id: completePayload.data.upload.id,
          category: completePayload.data.upload.category,
          originalName: completePayload.data.upload.originalName,
          mimeType: file.type || "application/octet-stream",
          extension: extensionOf(file.name),
          sizeBytes: completePayload.data.upload.sizeBytes,
          durationSeconds: completePayload.data.upload.durationSeconds,
          storageKey: ""
        });
      }

      setUploads((current) => [...current, ...nextUploads]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить файл.");
    } finally {
      setUploadingCategory(null);
    }
  };

  const addLink = () => {
    setLinks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind: "IMAGING",
        url: ""
      }
    ]);
  };

  const saveLink = async (link: LinkDraft) => {
    setErrorMessage(null);

    const response = await fetch(`/api/portal/materials/${token}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: link.kind,
        url: link.url,
        label: link.label,
        note: link.note,
        accessPassword: link.accessPassword,
        accessInstructions: link.accessInstructions
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      setErrorMessage(payload?.error?.message ?? "Не удалось сохранить внешнюю ссылку.");
      return;
    }

    setLinks((current) => current.filter((item) => item.id !== link.id));
    setSavedLinks((current) => [...current, link]);
    setSuccessMessage("Ссылка сохранена. Когда всё будет готово, нажмите «Отправить материалы врачу».");
  };

  const submitAll = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (uploads.length === 0 && savedLinks.length === 0) {
        throw new Error("Сначала добавьте хотя бы один файл или сохраните хотя бы одну внешнюю ссылку.");
      }

      const response = await fetch(`/api/portal/materials/${token}/submit`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message ?? "Не удалось отправить материалы врачу.");
      }

      setSuccessMessage("Материалы отправлены врачу. Кейс снова вернулся на просмотр.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось отправить материалы врачу."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stack">
      <div className="card stack">
        <h2>Добавить файлы</h2>
        <p className="muted">
          Если исследование удобнее передать ссылкой, используйте блок ниже и укажите пароль или инструкцию доступа.
        </p>
        <div className="two-column">
          <label className="field">
            <span>Документы и заключения</span>
            <input
              type="file"
              accept=".pdf,.zip,application/pdf,application/zip"
              multiple
              onChange={(event) => {
                void uploadFiles("DOCUMENT", event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <label className="field">
            <span>Фото и изображения</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic"
              multiple
              onChange={(event) => {
                void uploadFiles("IMAGE", event.target.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        <label className="field">
          <span>Короткие видео</span>
          <input
            type="file"
            accept=".mp4,.mov,video/mp4,video/quicktime"
            multiple
            onChange={(event) => {
              void uploadFiles("VIDEO", event.target.files);
              event.currentTarget.value = "";
            }}
          />
          <small className="muted">
            Можно загрузить до 3 коротких видео. Более объёмные MRI, видео и архивы лучше присылать внешней ссылкой с паролем или инструкцией.
          </small>
        </label>
        {uploadingCategory ? (
          <p className="muted">Загружаем {uploadCategoryLabel(uploadingCategory)}...</p>
        ) : null}
        {uploads.length > 0 ? (
          <div className="stack-sm">
            <h3>Уже добавлено</h3>
            {uploads.map((upload) => (
              <article key={upload.id} className="card stack-sm">
                <strong>{upload.originalName}</strong>
                <p className="muted">
                  {uploadCardLabel(upload.category)} · {formatBytes(upload.sizeBytes)}
                  {upload.durationSeconds ? ` · ${upload.durationSeconds} сек` : ""}
                </p>
              </article>
            ))}
          </div>
        ) : null}
        {savedLinks.length > 0 ? (
          <div className="stack-sm">
            <h3>Сохранённые внешние ссылки</h3>
            {savedLinks.map((link) => (
              <article key={link.id} className="card stack-sm">
                <strong>{link.label || link.url}</strong>
                <p className="muted">{linkKindLabel(link.kind)}</p>
                <p className="muted">{link.url}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card stack">
        <div className="card-meta">
          <h2>Внешние ссылки на исследования и архивы</h2>
          <button className="button button--secondary" type="button" onClick={addLink}>
            Добавить внешнюю ссылку
          </button>
        </div>
        {links.map((link, index) => (
          <article key={link.id} className="card form-grid">
            <label className="field">
              <span>Тип ссылки</span>
              <select
                value={link.kind}
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item) =>
                      item.id === link.id
                        ? { ...item, kind: event.target.value as LinkKind }
                        : item
                    )
                  )
                }
              >
                <option value="IMAGING">Ссылка на исследование</option>
                <option value="VIDEO">Ссылка на видео</option>
                <option value="CLOUD">Облако / архив</option>
              </select>
            </label>
            <label className="field field--full">
              <span>Ссылка</span>
              <input
                value={link.url}
                placeholder="https://..."
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item) =>
                      item.id === link.id ? { ...item, url: event.target.value } : item
                    )
                  )
                }
              />
            </label>
            <label className="field">
              <span>Короткое название</span>
              <input
                value={link.label ?? ""}
                placeholder="Например: МРТ колена, архив после операции"
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item) =>
                      item.id === link.id ? { ...item, label: event.target.value } : item
                    )
                  )
                }
              />
            </label>
            <label className="field">
              <span>Пароль, если нужен</span>
              <input
                value={link.accessPassword ?? ""}
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item) =>
                      item.id === link.id
                        ? { ...item, accessPassword: event.target.value }
                        : item
                    )
                  )
                }
              />
            </label>
            <label className="field field--full">
              <span>Инструкция по доступу</span>
              <textarea
                rows={2}
                placeholder="Например: открыть ссылку, ввести код из письма, скачать zip и использовать пароль"
                value={link.accessInstructions ?? ""}
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item) =>
                      item.id === link.id
                        ? { ...item, accessInstructions: event.target.value }
                        : item
                    )
                  )
                }
              />
            </label>
            <label className="field field--full">
              <span>Что важно посмотреть</span>
              <textarea
                rows={2}
                placeholder="Например: сравнить МРТ до и после операции или обратить внимание на правое плечо"
                value={link.note ?? ""}
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((item) =>
                      item.id === link.id ? { ...item, note: event.target.value } : item
                    )
                  )
                }
              />
            </label>
            <div className="hero-actions field--full">
              <button className="button button--secondary" type="button" onClick={() => void saveLink(link)}>
                Сохранить ссылку {index + 1}
              </button>
            </div>
          </article>
        ))}
      </div>

      {errorMessage ? (
        <div className="notice notice--danger">
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {successMessage ? (
        <div className="notice">
          <p>{successMessage}</p>
        </div>
      ) : null}

      <div className="hero-actions">
        <button className="button" type="button" disabled={submitting} onClick={() => void submitAll()}>
          {submitting ? "Отправляем материалы врачу..." : "Отправить материалы врачу"}
        </button>
      </div>
    </div>
  );
}
