import Link from "next/link";

import { AdminShell, StatCard } from "@/components/admin/shell";
import { applicationStatusLabel, formatDateTime, productLabel } from "@/features/admin/presentation";
import { getDashboardSnapshot } from "@/features/admin/service";
import { describeServiceSelection } from "@/features/questionnaire/service-selection";
import { manualPhaseLabels } from "@/features/manual-v21/presentation";
import { requireStaffSession } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  const session = await requireStaffSession();
  const snapshot = await getDashboardSnapshot();

  return (
    <AdminShell
      title={<span className="admin-page-title">Обзор заявок</span>}
      description={`Вы вошли как ${session.name}. Здесь видно, какие кейсы требуют первичного просмотра, дозапроса материалов или следующего решения.`}
    >
      <div className="card-grid">
        <StatCard label="Открытые обращения v2.1" value={snapshot.counters.manualOpenCount} href="/admin/applications?manualPhase=OPEN" />
        <StatCard label="Новые анкеты" value={snapshot.counters.newCount} href="/admin/applications?status=NEW&manualPhase=NOT_STARTED" />
        <StatCard
          label="На просмотре врачом"
          value={snapshot.counters.underReviewCount}
          href="/admin/applications?status=UNDER_REVIEW&manualPhase=NOT_STARTED"
        />
        <StatCard
          label="Ждут файлы"
          value={snapshot.counters.needsUploadCount}
          href="/admin/applications?status=NEEDS_UPLOAD&manualPhase=NOT_STARTED"
        />
        <StatCard
          label="Ждут доступ к исследованиям"
          value={snapshot.counters.needsImagingCount}
          href="/admin/applications?status=NEEDS_IMAGING_ACCESS&manualPhase=NOT_STARTED"
        />
        <StatCard
          label="Ссылка отправлена"
          value={snapshot.counters.bookingSentCount}
          href="/admin/applications?status=BOOKING_SENT&manualPhase=NOT_STARTED"
        />
      </div>
      <p className="muted">Открытые обращения v2.1 учитываются отдельно. Остальные счётчики показывают анкеты,
        для которых ручной маршрут v2.1 ещё не создан; условия прежних обращений сохраняются.</p>

      <section className="card stack">
        <div className="card-meta">
          <h2 className="admin-section-title">Последние поступившие заявки</h2>
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
                <span className="status">{application.manualCase
                  ? `v2.1 · ${manualPhaseLabels[application.manualCase.phase] ?? application.manualCase.phase}`
                  : applicationStatusLabel(application.status)}</span>
              </div>
              <p className="muted">
                {application.serviceSelection ? describeServiceSelection(application.serviceSelection) : productLabel(application.assignedProductCode ?? application.requestedProductCode)} ·{" "}
                {formatDateTime(application.submittedAt)}
              </p>
              <div className="stack-sm">
                {application.manualCase ? <Link className="text-link" href={`/admin/manual/${application.manualCase.id}`}>
                  Открыть ручную запись и кабинет v2.1
                </Link> : null}
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
