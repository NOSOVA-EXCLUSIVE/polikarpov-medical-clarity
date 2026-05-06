import Link from "next/link";

import { AdminCalendarCreateForm } from "@/components/admin/calendar-create-form";
import { AdminShell } from "@/components/admin/shell";
import { formatDateTime } from "@/features/admin/presentation";
import { listCalendarSlotsForAdmin, mapSlotStatusLabel } from "@/features/booking/service";
import { requireStaffSession } from "@/lib/auth/session";

type SearchParams = {
  notice?: string;
  error?: string;
  message?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function AdminCalendarPage({ searchParams }: PageProps) {
  await requireStaffSession();
  const params = (await searchParams) ?? {};
  const slots = await listCalendarSlotsForAdmin();

  const noticeMessage =
    params.notice === "slot_created"
      ? "Новый слот добавлен в календарь."
      : params.notice === "slot_updated"
        ? "Состояние слота обновлено."
        : null;

  return (
    <AdminShell
      title={<span className="admin-page-title">Календарь слотов</span>}
      description="Здесь врач управляет доступными слотами для персональных ссылок на запись."
    >
      {noticeMessage ? (
        <div className="notice">
          <p>{noticeMessage}</p>
        </div>
      ) : null}

      {params.error ? (
        <div className="notice notice--danger">
          <p>{params.message ?? "Не удалось обновить календарь. Проверьте данные и повторите попытку."}</p>
        </div>
      ) : null}

      <section className="card stack">
        <h2 className="admin-section-title">Добавить новый слот</h2>
        <p className="muted">
          Создавайте только те интервалы, которые реально готовы к записи через персональную ссылку.
        </p>
        <AdminCalendarCreateForm />
      </section>

      <section className="stack">
        {slots.length === 0 ? <p className="muted">В календаре пока нет доступных слотов.</p> : null}
        {slots.map((slot) => (
          <article key={slot.id} className="card stack-sm">
            <div className="card-meta">
              <div className="stack-sm">
                <strong>{formatDateTime(slot.startsAt)}</strong>
                <p className="muted">
                  До {formatDateTime(slot.endsAt)} · {slot.timezone}
                </p>
              </div>
              <span className="status">{mapSlotStatusLabel(slot.status)}</span>
            </div>

            {slot.status === "HELD" && slot.heldOffer ? (
              <p className="muted">
                Удерживается для:{" "}
                <Link className="text-link" href={`/admin/applications/${slot.heldOffer.application.id}`}>
                  {slot.heldOffer.application.patient.fullName}
                </Link>
              </p>
            ) : null}

            {slot.status === "BOOKED" && slot.bookedAppointment ? (
              <p className="muted">
                Забронирован:{" "}
                <Link className="text-link" href={`/admin/applications/${slot.bookedAppointment.application.id}`}>
                  {slot.bookedAppointment.application.patient.fullName}
                </Link>
              </p>
            ) : null}

            {slot.blockedReason ? <p className="muted">Причина блокировки: {slot.blockedReason}</p> : null}
            {slot.holdExpiresAt ? (
              <p className="muted">Удержание действует до: {formatDateTime(slot.holdExpiresAt)}</p>
            ) : null}

            {slot.status === "AVAILABLE" ? (
              <form action={`/api/admin/calendar/slots/${slot.id}`} className="stack-sm" method="post">
                <input name="action" type="hidden" value="block" />
                <input name="note" type="hidden" value="Слот временно заблокирован врачом." />
                <button className="button button--secondary" type="submit">
                  Заблокировать слот
                </button>
              </form>
            ) : null}

            {(slot.status === "BLOCKED" || slot.status === "HELD") && !slot.bookedAppointment ? (
              <form action={`/api/admin/calendar/slots/${slot.id}`} className="stack-sm" method="post">
                <input name="action" type="hidden" value="release" />
                <button className="button button--secondary" type="submit">
                  Вернуть в доступные
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
