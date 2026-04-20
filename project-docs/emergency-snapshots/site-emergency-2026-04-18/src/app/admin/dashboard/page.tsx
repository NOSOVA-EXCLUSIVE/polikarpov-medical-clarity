import Link from "next/link";

import { AdminShell, StatCard } from "@/components/admin/shell";
import { applicationStatusLabel, formatDateTime, productLabel } from "@/features/admin/presentation";
import { getDashboardSnapshot } from "@/features/admin/service";
import { requireStaffSession } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  const session = await requireStaffSession();
  const snapshot = await getDashboardSnapshot();

  return (
    <AdminShell
      title="Обзор заявок"
      description={`Вы вошли как ${session.name}. Здесь видно, какие кейсы требуют первичного просмотра, дозапроса материалов или следующего решения.`}
    >
      <div className="card-grid">
        <StatCard label="Новые анкеты" value={snapshot.counters.newCount} href="/admin/applications?status=NEW" />
        <StatCard
          label="На просмотре врачом"
          value={snapshot.counters.underReviewCount}
          href="/admin/applications?status=UNDER_REVIEW"
        />
        <StatCard
          label="Ждут файлы"
          value={snapshot.counters.needsUploadCount}
          href="/admin/applications?status=NEEDS_UPLOAD"
        />
        <StatCard
          label="Ждут доступ к исследованиям"
          value={snapshot.counters.needsImagingCount}
          href="/admin/applications?status=NEEDS_IMAGING_ACCESS"
        />
        <StatCard
          label="Ссылка отправлена"
          value={snapshot.counters.bookingSentCount}
          href="/admin/applications?status=BOOKING_SENT"
        />
      </div>

      <section className="card stack">
        <div className="card-meta">
          <h2>Последние поступившие заявки</h2>
          <Link className="text-link" href="/admin/applications">
            Открыть все заявки
          </Link>
        </div>
        <div className="stack-sm">
          {snapshot.latestApplications.map((application) => (
            <article key={application.id} className="card stack-sm">
              <div className="card-meta">
                <div className="stack-sm">
                  <strong>{application.patient.fullName}</strong>
                  <p className="muted">{application.patient.email}</p>
                </div>
                <span className="status">{applicationStatusLabel(application.status)}</span>
              </div>
              <p className="muted">
                {productLabel(application.assignedProductCode ?? application.requestedProductCode)} ·{" "}
                {formatDateTime(application.submittedAt)}
              </p>
              <div>
                <Link className="text-link" href={`/admin/applications/${application.id}`}>
                  Открыть карточку
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <form action="/api/admin/logout" method="post">
        <button className="button button--secondary" type="submit">
          Выйти
        </button>
      </form>
    </AdminShell>
  );
}
