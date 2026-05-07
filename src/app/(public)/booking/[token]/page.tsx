import Link from "next/link";

import { chargeModelLabel, formatDateTime, formatMoney, productLabel } from "@/features/admin/presentation";
import { getBookingMode } from "@/features/booking/mode";
import { getBookingPageContext } from "@/features/booking/service";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{
    cancelled?: string;
    error?: string;
    manual?: string;
    message?: string;
  }>;
};

export default async function BookingPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = (await searchParams) ?? {};
  const bookingMode = getBookingMode();
  const isManualMode = bookingMode === "manual";

  try {
    const context = await getBookingPageContext(token);
    const isManualConfirmed =
      isManualMode && (query.manual === "confirmed" || Boolean(context.heldSlot));

    return (
      <main className="section booking-page">
        <div className="container stack">
          <section className="page-hero">
            <div className="page-hero__grid">
              <div className="stack">
                <p className="eyebrow">Персональная запись</p>
                <h1 className={isManualMode ? "booking-page__title booking-page__title--manual" : "booking-page__title"}>
                  {isManualMode
                    ? "Выберите удобное время и подтвердите заявку"
                    : "Выберите удобное время и перейдите к оплате"}
                </h1>
                <p className="lead booking-page__lead">
                  {isManualMode
                    ? "Выберите доступное время. После подтверждения заявки мы свяжемся с Вами вручную и отдельно передадим инструкции по оплате."
                    : "Выберите доступное время. После подтверждения слота откроется защищённая страница оплаты."}
                </p>
              </div>
              <aside className="card stack-sm booking-page__offer-card">
                <p className="eyebrow">Ваше предложение</p>
                <strong className="booking-page__offer-name">{context.patient.fullName}</strong>
                <p className="muted booking-page__offer-product">{productLabel(context.offer.productCode)}</p>
                <p className="muted booking-page__offer-price">
                  {chargeModelLabel(context.offer.chargeModel)} · {formatMoney(context.offer.amountCents, context.offer.currency)}
                </p>
                <p className="muted booking-page__offer-expiry">
                  Ссылка действует до {formatDateTime(context.offer.expiresAt)}
                </p>
              </aside>
            </div>
          </section>

          {query.cancelled && !isManualMode ? (
            <div className="notice">
              <p>
                Оплата не завершилась. Если ссылка ещё активна, можно снова выбрать слот и перейти к оплате по этой же персональной ссылке.
              </p>
            </div>
          ) : null}

          {query.error ? (
            <div className="notice notice--danger">
              <p>
                {query.message
                  ? isManualMode
                    ? `Не удалось обработать подтверждение: ${query.message}`
                    : `Не удалось открыть оплату: ${query.message}`
                  : isManualMode
                    ? "Не удалось обработать подтверждение. Попробуйте ещё раз. Если ситуация повторится, дождитесь связи с врачом или администратором."
                    : "Не удалось открыть оплату. Попробуйте ещё раз. Если ситуация повторится, не оплачивайте повторно по другим ссылкам без подтверждения."}
              </p>
            </div>
          ) : null}

          {context.heldSlot ? (
            <div className="notice">
              <p>
                Сейчас за Вами предварительно удержан слот на {formatDateTime(context.heldSlot.startsAt)}. Удержание действует до{" "}
                {context.heldSlot.holdExpiresAt ? formatDateTime(context.heldSlot.holdExpiresAt) : "ближайшего времени"}.
              </p>
            </div>
          ) : null}

          {isManualConfirmed ? (
            <section className="card stack">
              <h2 className="booking-page__section-title">Заявка подтверждена</h2>
              <p className="lead booking-page__lead">
                Ваше персональное предложение подготовлено. Запись и оплата сейчас оформляются вручную. Мы свяжемся с Вами по выбранному каналу связи для подтверждения времени консультации и передачи инструкций по оплате.
              </p>
              <div className="hero-actions">
                <Link className="button button--secondary" href="/services">
                  Вернуться к услугам
                </Link>
              </div>
            </section>
          ) : null}

          <section className="two-column">
            <article className="card stack">
              <h2 className="booking-page__section-title">Как проходит этот шаг</h2>
              <ul className="list">
                {isManualMode ? (
                  <>
                    <li>Вы выбираете один удобный слот из доступных вариантов.</li>
                    <li>После подтверждения заявки врач или администратор связывается с Вами вручную.</li>
                    <li>Инструкции по оплате и подтверждение времени консультации передаются отдельно.</li>
                  </>
                ) : (
                  <>
                    <li>Вы выбираете один удобный слот из доступных вариантов.</li>
                    <li>Система временно удерживает этот слот, пока Вы переходите к оплате.</li>
                    <li>После оплаты запись подтверждается, а следующий шаг появляется сразу на экране.</li>
                  </>
                )}
              </ul>
            </article>
            <article className="card stack">
              <h2 className="booking-page__section-title">Важно</h2>
              <ul className="list">
                {isManualMode ? (
                  <>
                    <li>Онлайн-оплата на этой странице временно не проводится.</li>
                    <li>После подтверждения заявки мы отдельно передадим инструкции по оплате.</li>
                    <li>Если ссылка уже не работает, попросите отправить новое персональное предложение.</li>
                  </>
                ) : (
                  <>
                    <li>Слот удерживается на ограниченное время во время перехода к оплате.</li>
                    <li>Если оплата не завершена вовремя, слот может снова стать доступным.</li>
                    <li>Нажатие кнопки ниже не списывает деньги сразу: сначала откроется защищённая платёжная страница.</li>
                    <li>Если ссылка уже не работает, попросите отправить новое персональное предложение.</li>
                  </>
                )}
              </ul>
            </article>
          </section>

          {!isManualConfirmed ? (
            <section className="card stack">
              <div className="stack-sm">
                <h2 className="booking-page__section-title booking-page__slot-title">Выберите время</h2>
                <p className="muted">
                  Для этой ссылки доступны только те слоты, которые врач открыл под персональную запись.
                </p>
              </div>

              {context.slots.length === 0 ? (
                <div className="notice notice--danger">
                  <p>Сейчас по этой ссылке нет доступных слотов. Пожалуйста, попросите обновить предложение.</p>
                </div>
              ) : (
                <form action={`/api/booking/${token}/checkout`} className="stack" method="post">
                  <div className="stack-sm">
                    {context.slots.map((slot) => (
                      <label key={slot.id} className="card card-meta">
                        <div className="stack-sm">
                          <strong>{formatDateTime(slot.startsAt)}</strong>
                          <p className="muted">
                            До {formatDateTime(slot.endsAt)} · {slot.timezone}
                          </p>
                        </div>
                        <input
                          defaultChecked={context.heldSlot?.id === slot.id}
                          name="slotId"
                          required
                          type="radio"
                          value={slot.id}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="hero-actions">
                    <button className="button" type="submit">
                      {isManualMode ? "Подтвердить заявку" : "Удержать слот и перейти к оплате"}
                    </button>
                    <Link className="button button--secondary" href="/services">
                      Вернуться к услугам
                    </Link>
                  </div>
                </form>
              )}
            </section>
          ) : null}
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main className="section booking-page">
        <div className="container stack">
          <div className="card stack">
            <p className="eyebrow">Персональная запись</p>
            <h1 className="booking-page__title">Ссылка недоступна</h1>
            <div className="notice notice--danger">
              <p>
                {error instanceof Error
                  ? error.message
                  : "Эта ссылка больше недоступна. Если запись всё ещё нужна, попросите отправить новую ссылку."}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }
}
