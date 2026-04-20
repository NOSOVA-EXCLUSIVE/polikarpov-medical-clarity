import type { ReactNode } from "react";

import {
  closeReasonLabel,
  formatDateTime,
  messageAuthorLabel,
  productLabel,
  readOnlyReasonLabel,
  threadStatusLabel
} from "@/features/admin/presentation";
import { getPortalMessagesContext } from "@/features/messages/service";
import { getPortalSession } from "@/lib/auth/portal-session";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
  }>;
};

function Notice({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return <div className={danger ? "notice notice--danger" : "notice"}>{children}</div>;
}

export default async function PortalMessagesPage({ searchParams }: PageProps) {
  const session = await getPortalSession();
  const flash = (await searchParams) ?? {};

  if (!session) {
    return (
      <main className="section">
        <div className="container stack">
          <div className="card stack">
            <p className="eyebrow">Центр сообщений</p>
            <h1>Доступ по защищённой ссылке</h1>
            <p className="muted">
              Чтобы открыть переписку по кейсу, используйте персональную ссылку из письма. Она ведёт прямо в закрытый
              центр сообщений и не требует отдельной регистрации.
            </p>
            {flash.error ? (
              <Notice danger>
                <p>
                  Эта ссылка больше недоступна или сессия истекла. Если доступ всё ещё нужен, попросите отправить новую
                  ссылку.
                </p>
              </Notice>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  try {
    const context = await getPortalMessagesContext(session);

    const statusNotice =
      context.thread.status === "READ_ONLY"
        ? readOnlyReasonLabel(context.thread.readOnlyReason)
        : context.thread.status === "CLOSED"
          ? closeReasonLabel(context.thread.closeReason)
          : null;

    return (
      <main className="section">
        <div className="container stack">
          <div className="card stack">
            <p className="eyebrow">Центр сообщений</p>
            <h1>{productLabel(context.application.productCode)}</h1>
            <p className="muted">
              Это защищённая переписка по вашему текущему кейсу. В экстренных ситуациях не используйте этот раздел и
              обратитесь за очной помощью.
            </p>
            <div className="two-column">
              <article className="card stack-sm">
                <strong>Статус</strong>
                <p>{threadStatusLabel(context.thread.status)}</p>
              </article>
              <article className="card stack-sm">
                <strong>Что это за формат</strong>
                <p>{context.thread.rulesText}</p>
              </article>
            </div>
            <div className="two-column">
              <article className="card stack-sm">
                <strong>Открыт с</strong>
                <p>{context.thread.startsAt ? formatDateTime(context.thread.startsAt) : "—"}</p>
              </article>
              <article className="card stack-sm">
                <strong>Доступен до</strong>
                <p>{context.thread.endsAt ? formatDateTime(context.thread.endsAt) : "Пока кейс активен"}</p>
              </article>
            </div>
            {typeof context.thread.remainingPatientMessages === "number" ? (
              <Notice>
                <p>Осталось сообщений пациента: {context.thread.remainingPatientMessages}</p>
              </Notice>
            ) : null}
            {statusNotice ? (
              <Notice danger={context.thread.status !== "ACTIVE"}>
                <p>{statusNotice}</p>
              </Notice>
            ) : null}
            {flash.notice === "sent" ? (
              <Notice>
                <p>Сообщение отправлено. Когда в переписке появится ответ, мы пришлём уведомление на email.</p>
              </Notice>
            ) : null}
            {flash.error === "message" ? (
              <Notice danger>
                <p>Не удалось отправить сообщение. Проверьте текст и попробуйте ещё раз.</p>
              </Notice>
            ) : null}
          </div>

          <section className="card stack">
            <div className="card-meta">
              <h2>Переписка по кейсу</h2>
              <span className="status">{threadStatusLabel(context.thread.status)}</span>
            </div>
            {context.messages.length === 0 ? (
              <p className="muted">Сообщений пока нет.</p>
            ) : (
              <div className="stack-sm">
                {context.messages.map((message) => {
                  const author =
                    message.authorRole === "PATIENT"
                      ? "Вы"
                      : message.senderUser?.name || messageAuthorLabel(message.authorRole);

                  return (
                    <article key={message.id} className="card stack-sm">
                      <div className="card-meta">
                        <strong>{author}</strong>
                        <span className="muted">{formatDateTime(message.createdAt)}</span>
                      </div>
                      <p>{message.body}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {context.thread.canPatientSend ? (
            <section className="card stack">
              <h2>Новое сообщение</h2>
              <p className="muted">
                Пишите только по текущему кейсу. Если врачу нужны новые большие MRI, видео или архивы, вам отправят
                отдельную защищённую ссылку на дозагрузку материалов.
              </p>
              <form action="/api/portal/thread/messages" className="stack" method="post">
                <label className="field">
                  <span>Сообщение</span>
                  <textarea
                    name="body"
                    placeholder="Опишите коротко, что именно нужно уточнить."
                    rows={5}
                    required
                  />
                </label>
                <div>
                  <button className="button" type="submit">
                    Отправить сообщение
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <section className="card stack">
              <h2>Новые сообщения сейчас недоступны</h2>
              <p className="muted">
                Этот раздел остаётся доступным для чтения. Если по кейсу потребуется дозагрузить материалы, вам пришлют
                отдельную защищённую ссылку.
              </p>
            </section>
          )}
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main className="section">
        <div className="container stack">
          <div className="card stack">
            <p className="eyebrow">Центр сообщений</p>
            <h1>Переписка сейчас недоступна</h1>
            <Notice danger>
              <p>
                {error instanceof Error
                  ? error.message
                  : "Не удалось открыть переписку. Если доступ всё ещё нужен, попросите отправить новую ссылку."}
              </p>
            </Notice>
          </div>
        </div>
      </main>
    );
  }
}
