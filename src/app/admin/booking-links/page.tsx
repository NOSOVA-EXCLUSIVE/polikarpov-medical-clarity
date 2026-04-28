import Link from "next/link";

import { AdminShell } from "@/components/admin/shell";
import {
  chargeModelLabel,
  formatDateTime,
  formatMoney,
  offerStatusLabel,
  productLabel
} from "@/features/admin/presentation";
import { listBookingLinks } from "@/features/admin/service";
import { requireStaffSession } from "@/lib/auth/session";

type SearchParams = {
  bookingUrl?: string;
  notice?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function BookingLinksPage({ searchParams }: PageProps) {
  await requireStaffSession();
  const params = (await searchParams) ?? {};
  const offers = await listBookingLinks();

  return (
    <AdminShell
      title="Ссылки на запись"
      description="Здесь собраны персональные офферы и ссылки, которые переводят пациента к следующему шагу после просмотра кейса."
    >
      {(params.notice === "offer_email_sent" || params.notice === "offer_email_failed") &&
      params.bookingUrl ? (
        <div className="card stack">
          <h2>Новая ссылка для пациента</h2>
          <p className="muted">
            {params.notice === "offer_email_sent"
              ? "Письмо пациенту уже отправлено. Скопируйте ссылку только если понадобится ручной повтор."
              : "Ссылка создана, но письмо пациенту не отправилось. Скопируйте её сейчас и отправьте вручную."}
          </p>
          <a className="text-link" href={params.bookingUrl}>
            {params.bookingUrl}
          </a>
        </div>
      ) : null}

      <section className="stack">
        {offers.length === 0 ? <p className="muted">Персональные ссылки пока не создавались.</p> : null}
        {offers.map((offer) => (
          <article key={offer.id} className="card stack-sm">
            <div className="card-meta">
              <div className="stack-sm">
                <strong>{offer.application.patient.fullName}</strong>
                <p className="muted">{offer.application.patient.email}</p>
              </div>
              <span className="status">{offerStatusLabel(offer.status)}</span>
            </div>
            <p>{productLabel(offer.productCode)}</p>
            <p className="muted">
              {chargeModelLabel(offer.chargeModel)} · {formatMoney(offer.amountCents, offer.currency)}
            </p>
            <p className="muted">
              Создан: {formatDateTime(offer.createdAt)} · Истекает: {formatDateTime(offer.expiresAt)}
            </p>
            <div>
              <Link className="text-link" href={`/admin/applications/${offer.application.id}`}>
                Открыть карточку заявки
              </Link>
            </div>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
