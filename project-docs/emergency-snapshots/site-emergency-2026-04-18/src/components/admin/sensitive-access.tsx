"use client";

import { useState, useTransition } from "react";

type SensitiveAccessProps = {
  applicationId: string;
  targetId: string;
  targetType: "upload" | "externalLink";
  hasPassword: boolean;
  hasInstructions: boolean;
};

export function SensitiveAccessPanel({
  applicationId,
  targetId,
  targetType,
  hasPassword,
  hasInstructions
}: SensitiveAccessProps) {
  const [revealed, setRevealed] = useState<{
    accessPassword: string | null;
    accessInstructions: string | null;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const reveal = () => {
    startTransition(async () => {
      setError(null);

      const response = await fetch(
        `/api/admin/applications/${applicationId}/sensitive-access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetId,
            targetType,
            action: "reveal"
          })
        }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "Не удалось открыть чувствительные данные.");
        return;
      }

      setRevealed(payload.data);
    });
  };

  const copyValue = async (value: string | null) => {
    if (!value) return;

    await fetch(`/api/admin/applications/${applicationId}/sensitive-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetId,
        targetType,
        action: "copy"
      })
    });

    await navigator.clipboard.writeText(value);
  };

  if (!hasPassword && !hasInstructions) {
    return <p className="muted">Доступы не указаны.</p>;
  }

  return (
    <div className="stack-sm">
      <div className="hero-actions">
        <button className="button button--secondary" type="button" onClick={reveal} disabled={pending}>
          {pending ? "Открываем..." : "Показать"}
        </button>
      </div>

      {error ? (
        <div className="notice notice--danger">
          <p>{error}</p>
        </div>
      ) : null}

      {revealed ? (
        <div className="stack-sm">
          {revealed.accessPassword ? (
            <div className="card stack-sm">
              <strong>Пароль</strong>
              <p>{revealed.accessPassword}</p>
              <div>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => void copyValue(revealed.accessPassword)}
                >
                  Скопировать пароль
                </button>
              </div>
            </div>
          ) : null}
          {revealed.accessInstructions ? (
            <div className="card stack-sm">
              <strong>Инструкция доступа</strong>
              <p>{revealed.accessInstructions}</p>
              <div>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => void copyValue(revealed.accessInstructions)}
                >
                  Скопировать инструкцию
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="muted">Пароли и инструкции скрыты до явного раскрытия.</p>
      )}
    </div>
  );
}
