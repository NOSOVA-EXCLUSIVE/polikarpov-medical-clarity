import { PortalMaterialsForm } from "@/components/portal/materials-form";
import { formatDateTime, requirementTypeLabel } from "@/features/admin/presentation";
import { getMaterialsPortalContext } from "@/features/portal/materials-service";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PortalMaterialsPage({ params }: PageProps) {
  const { token } = await params;

  try {
    const context = await getMaterialsPortalContext(token);

    return (
      <main className="section portal-materials-page">
        <div className="container stack">
          <div className="card stack">
            <p className="eyebrow">Дозагрузка материалов</p>
            <h1>Добавить материалы по кейсу</h1>
            <p className="muted">
              Врач запросил дополнительные материалы. Здесь можно безопасно добавить файлы, внешние ссылки и данные доступа, не возвращаясь к полной анкете.
            </p>
            <div className="two-column">
              <article className="card stack-sm">
                <strong>Что нужно прислать</strong>
                <p>{requirementTypeLabel(context.requirement.type)}</p>
              </article>
              <article className="card stack-sm">
                <strong>Ссылка действует до</strong>
                <p>{formatDateTime(context.requirement.expiresAt)}</p>
              </article>
            </div>
            <p className="muted">Кейс: {context.application.patientName}</p>
            <div className="notice">
              <p>{context.requirement.note}</p>
            </div>
          </div>

          <PortalMaterialsForm token={token} />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main className="section portal-materials-page">
        <div className="container stack">
          <div className="card stack">
            <p className="eyebrow">Дозагрузка материалов</p>
            <h1>Ссылка недоступна</h1>
            <div className="notice notice--danger">
              <p>
                {error instanceof Error
                  ? error.message
                  : "Эта ссылка больше недоступна. Если материалы всё ещё нужно прислать, попросите врача или администратора отправить новую ссылку."}
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }
}
