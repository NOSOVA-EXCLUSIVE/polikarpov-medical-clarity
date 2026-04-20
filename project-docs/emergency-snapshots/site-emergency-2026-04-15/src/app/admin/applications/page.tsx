import Link from "next/link";
import type { ApplicationStatus, ProductCode } from "@prisma/client";

import { AdminShell } from "@/components/admin/shell";
import {
  applicationStatusLabel,
  formatDateTime,
  imagingSourceTypeLabel,
  productLabel
} from "@/features/admin/presentation";
import { listApplications } from "@/features/admin/service";
import { requireStaffSession } from "@/lib/auth/session";

type SearchParams = {
  status?: ApplicationStatus | "ALL";
  productCode?: ProductCode | "ALL";
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
    query: params.query
  });

  return (
    <AdminShell
      title="Заявки"
      description="Рабочий список для первичного просмотра, запроса материалов и подготовки следующего шага по кейсу."
    >
      <section className="card stack">
        <h2>Фильтры</h2>
        <form className="form-grid" method="get">
          <label className="field">
            <span>Статус</span>
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
            <span>Продукт</span>
            <select defaultValue={params.productCode ?? "ALL"} name="productCode">
              <option value="ALL">Все</option>
              <option value="SECOND_OPINION">Продукт 1</option>
              <option value="MEDICAL_ROUTE">Продукт 2</option>
              <option value="RECOVERY_4_WEEKS">Продукт 3</option>
              <option value="PERSONAL_SUPPORT">Продукт 4</option>
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
          <article key={application.id} className="card stack-sm">
            <div className="card-meta">
              <div className="stack-sm">
                <strong>{application.patient.fullName}</strong>
                <p className="muted">
                  {application.patient.email} · {application.patient.country} · {application.patient.timezone}
                </p>
              </div>
              <span className="status">{applicationStatusLabel(application.status)}</span>
            </div>
            <p>{application.chiefComplaint}</p>
            <p className="muted">
              {productLabel(application.assignedProductCode ?? application.requestedProductCode)} ·{" "}
              {imagingSourceTypeLabel(application.imagingSourceType)} · {formatDateTime(application.submittedAt)}
            </p>
            <p className="muted">
              Файлы: {application._count.uploads} · внешние ссылки: {application._count.externalLinks} · запросы:{" "}
              {application._count.requirements} · офферы: {application._count.offers}
            </p>
            <div>
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
