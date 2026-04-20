import Link from "next/link";

import { chargeModelLabel, formatDateTime, formatMoney, productLabel } from "@/features/admin/presentation";
import { getPaymentSuccessContext, mapPaymentStatusLabel } from "@/features/booking/service";

type PageProps = {
  searchParams?: Promise<{
    session_id?: string;
  }>;
};

export default async function PaymentSuccessPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const sessionId = params.session_id;

  if (!sessionId) {
    return (
      <main className="section">
        <div className="container stack">
          <div className="card stack">
            <p className="eyebrow">Оплата и запись</p>
            <h1>Подтверждение пока недоступно</h1>
            <div className="notice notice--danger">
              <p>Мы не нашли идентификатор оплаты. Пожалуйста, вернитесь по персональной ссылке и попробуйте ещё раз.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const payment = await getPaymentSuccessContext(sessionId);

  if (!payment) {
    return (
      <main className="section">
        <div className="container stack">
          <div className="card stack">
            <p className="eyebrow">Оплата и запись</p>
            <h1>Платёж не найден</h1>
            <div className="notice notice--danger">
              <p>Мы пока не нашли этот платёж в системе. Если деньги уже списаны, не оплачивайте повторно и дождитесь подтверждения.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="section">
      <div className="container stack">
        <section className="page-hero">
          <div className="stack">
            <p className="eyebrow">Оплата и запись</p>
            <h1>{payment.status === "PAID" ? "Запись подтверждена" : "Мы подтверждаем оплату"}</h1>
            <p className="lead">
              {payment.status === "PAID"
                ? "Спасибо. Ваш слот закреплён, а запись уже сохранена в системе."
                : "Мы получили информацию о платеже. Обычно подтверждение появляется быстро, но иногда системе нужно ещё немного времени."}
            </p>
          </div>
        </section>

        {payment.status !== "PAID" ? (
          <div className="notice">
            <p>Если деньги уже списаны, ничего дополнительно делать не нужно. Не оплачивайте повторно и просто дождитесь подтверждения.</p>
          </div>
        ) : null}

        <section className="two-column">
          <article className="card stack">
            <h2>Что уже зафиксировано</h2>
            <p>{productLabel(payment.offer.productCode)}</p>
            <p className="muted">
              {chargeModelLabel(payment.offer.chargeModel)} · {formatMoney(payment.amountCents, payment.currency)}
            </p>
            <p className="muted">Статус оплаты: {mapPaymentStatusLabel(payment.status)}</p>
            {payment.appointment ? (
              <p className="muted">
                Выбранный слот: {formatDateTime(payment.appointment.startsAt)} · {payment.appointment.timezone}
              </p>
            ) : null}
          </article>

          <article className="card stack">
            <h2>Что будет дальше</h2>
            <ul className="list">
              <li>Если оплата уже подтверждена, слот закреплён за вами.</li>
              <li>Следующие инструкции придут на email, который вы указали в анкете.</li>
              <li>Если статус ещё обновляется, ничего заново оплачивать не нужно.</li>
            </ul>
          </article>
        </section>

        <div className="hero-actions">
          <Link className="button button--secondary" href="/doctor">
            Вернуться на страницу врача
          </Link>
        </div>
      </div>
    </main>
  );
}
