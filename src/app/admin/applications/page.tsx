import Link from "next/link";
import type { ApplicationStatus, ProductCode } from "@prisma/client";

import { AdminShell } from "@/components/admin/shell";
import {
  applicationStatusLabel,
  formatDateTime,
  imagingSourceTypeLabel,
  manualBookingBadgeLabel,
  manualPaymentPendingLabel,
  productLabel
} from "@/features/admin/presentation";
import { listApplications } from "@/features/admin/service";
import { allServicesV21 } from "@/features/products/services-v21";
import { describeServiceSelection } from "@/features/questionnaire/service-selection";
import { manualPhaseLabels } from "@/features/manual-v21/presentation";
import { requireStaffSession } from "@/lib/auth/session";

type SearchParams = {
  status?: ApplicationStatus | "ALL";
  productCode?: ProductCode | "ALL";
  selectedServiceId?: string;
  manualPhase?: string;
  query?: string;
};

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function ApplicationsPage({ searchParams }: PageProps) {
  await requireStaffSession();
  const params = (await searchParams) ?? {};

  const applications = await listApplications({
    status: params.status,
    productCode: params.productCode,
    selectedServiceId: params.selectedServiceId,
    manualPhase: params.manualPhase,
    query: params.query
  });

  return (
    <AdminShell
      title={<span className="admin-page-title">Заявки</span>}
      description="Рабочий список для первичного просмотра, запроса материалов и подготовки следующего шага по кейсу."
    >
      <section className="card stack">
        <h2 className="admin-section-title">Фильтры</h2>
        <form className="form-grid" method="get">
          <label className="field">
            <span>Статус анкеты</span>
            <select defaultValue={params.status ?? "ALL"} name="status">
              <option value="ALL">Все</option>
              <option value="NEW">Новые</option>
              <option value="UNDER_REVIEW">На просмотре врачом</option>
              <option value="NEEDS_UPLOAD">Ждут файлы</option>
              <option value="NEEDS_IMAGING_ACCESS">Ждут доступ к исследованиям</option>
              <option value="BOOKING_SENT">Ссылка отправлена</option>
              <option value="REJECTED">Отклонённые кейсы</option>
            </select>
          </label>
          <label className="field">
            <span>Этап ручного маршрута v2.1</span>
            <select defaultValue={params.manualPhase ?? "ALL"} name="manualPhase">
              <option value="ALL">Все обращения</option>
              <option value="NOT_STARTED">Ручной маршрут v2.1 ещё не создан</option>
              <option value="OPEN">Все незавершённые обращения v2.1</option>
              {Object.entries(manualPhaseLabels).map(([phase, label]) => (
                <option key={phase} value={phase}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Выбранная услуга v2.1</span>
            <select defaultValue={params.selectedServiceId ?? "ALL"} name="selectedServiceId">
              <option value="ALL">Все</option>
              {allServicesV21.map((service) => (
                <option key={service.id} value={service.id}>{service.title}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Продукт прежнего каталога</span>
            <select defaultValue={params.productCode ?? "ALL"} name="productCode">
              <option value="ALL">Все</option>
              {(["SECOND_OPINION", "MEDICAL_ROUTE", "RECOVERY_4_WEEKS", "PERSONAL_SUPPORT"] as const).map((code) => (
                <option key={code} value={code}>{productLabel(code)}</option>
              ))}
            </select>
          </label>
          <label className="field field--full">
            <span>Поиск</span>
            <input
              defaultValue={params.query ?? ""}
              name="query"
              placeholder="ФИО, email, номер заявки или ключевые слова"
            />
          </label>
          <div>
            <button className="button" type="submit">
              Применить
            </button>
          </div>
        </form>
      </section>

      <section className="stack">
        {applications.length === 0 ? <p className="muted">По этим фильтрам заявок пока нет.</p> : null}
        {applications.map((application) => (
          <article
            key={application.id}
            className={`card stack-sm ${
              application.patientConfirmedManualBooking
                ? "admin-application-card--confirmed"
                : ""
            }`.trim()}
          >
            <div className="card-meta">
              <div className="stack-sm">
                <strong>{application.patient.fullName}</strong>
                <p className="muted">{application.displayNumber}</p>
                <p className="muted">
                  {application.patient.email} · {application.patient.country} · {application.patient.timezone}
                </p>
              </div>
              <div className="stack-sm">
                <span className="status">{application.manualCase
                  ? `v2.1 · ${manualPhaseLabels[application.manualCase.phase] ?? application.manualCase.phase}`
                  : applicationStatusLabel(application.status)}</span>
                {application.patientConfirmedManualBooking ? (
                  <>
                    <span className="status status--held">{manualBookingBadgeLabel()}</span>
                    <span className="status status--manual-pending">{manualPaymentPendingLabel()}</span>
                  </>
                ) : null}
                {application.latestMaterialsSubmission ? (
                  <span className="status status--new-materials">Новые материалы</span>
                ) : null}
              </div>
            </div>
            <p>{application.chiefComplaint}</p>
            <p className="muted">
              {application.serviceSelection ? describeServiceSelection(application.serviceSelection) : productLabel(application.assignedProductCode ?? application.requestedProductCode)} ·{" "}
              {imagingSourceTypeLabel(application.imagingSourceType)} · {formatDateTime(application.submittedAt)}
            </p>
            <p className="muted">
              Файлы: {application._count.uploads} · внешние ссылки: {application._count.externalLinks} · запросы:{" "}
              {application._count.requirements} · офферы: {application._count.offers}
            </p>
            <div className="stack-sm">
              {application.manualCase ? <Link className="text-link" href={`/admin/manual/${application.manualCase.id}`}>
                Открыть ручную запись и кабинет v2.1
              </Link> : null}
              <Link className="text-link" href={`/admin/applications/${application.id}`}>
                Открыть карточку заявки
              </Link>
            </div>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
