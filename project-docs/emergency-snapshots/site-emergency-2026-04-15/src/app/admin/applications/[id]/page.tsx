import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell, DefinitionList } from "@/components/admin/shell";
import { SensitiveAccessPanel } from "@/components/admin/sensitive-access";
import {
  applicationStatusLabel,
  chargeModelLabel,
  closeReasonLabel,
  externalLinkKindLabel,
  formatDateTime,
  formatMoney,
  imagingSourceTypeLabel,
  messageAuthorLabel,
  offerStatusLabel,
  preferredContactLabel,
  productLabel,
  readOnlyReasonLabel,
  requirementStatusLabel,
  requirementTypeLabel,
  threadStatusLabel,
  uploadCategoryLabel,
  uploadStatusLabel
} from "@/features/admin/presentation";
import { getApplicationDetail } from "@/features/admin/service";
import { canStaffReplyToThread } from "@/features/messages/service";
import { requireStaffSession } from "@/lib/auth/session";

const redFlagLabels: Record<string, string> = {
  hasFever: "Температура или признаки воспаления",
  hasAcuteSwelling: "Резко нарастающий отёк",
  unableToBearWeight: "Невозможно опираться на конечность",
  hasNumbness: "Онемение",
  hasWeakness: "Выраженная слабость",
  hasBladderOrBowelSymptoms: "Нарушения мочеиспускания или стула",
  hasChestPain: "Боль в груди",
  hasShortnessOfBreath: "Одышка",
  hasConfusion: "Спутанность сознания"
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    materialsUrl?: string;
    portalUrl?: string;
    notice?: string;
    error?: string;
  }>;
};

function sizeLabel(sizeBytes: bigint) {
  const bytes = Number(sizeBytes);

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function ApplicationDetailPage({
  params,
  searchParams
}: PageProps) {
  await requireStaffSession();
  const { id } = await params;
  const flash = (await searchParams) ?? {};
  const application = await getApplicationDetail(id);

  if (!application) {
    notFound();
  }

  const noticeMessage =
    flash.notice === "upload_request_created"
      ? "Пациенту отправлен запрос на файлы и документы."
      : flash.notice === "imaging_request_created"
        ? "Пациенту отправлен запрос на ссылку или доступ к исследованию."
        : flash.notice === "rejected"
          ? "Кейс переведён в отклонённые."
          : flash.notice === "activated"
            ? "Кейс активирован. Центр сообщений открыт и ссылка отправлена на email пациента."
            : flash.notice === "completed"
              ? "Кейс завершён. Переписка закрыта."
              : flash.notice === "message_sent"
                ? "Ответ в центр сообщений отправлен. Пациент получил уведомление на email."
                : null;

  const thread = application.messageThread;
  const canReply = canStaffReplyToThread(thread);

  return (
    <AdminShell
      title={`Карточка заявки ${application.id}`}
      description="Здесь можно проверить материалы, принять решение по кейсу, открыть или завершить сопровождение и работать с перепиской внутри системы."
    >
      {noticeMessage ? (
        <div className="notice">
          <p>{noticeMessage}</p>
        </div>
      ) : null}

      {flash.error ? (
        <div className="notice notice--danger">
          <p>Не удалось выполнить действие. Проверьте заполнение формы и попробуйте ещё раз.</p>
        </div>
      ) : null}

      {flash.materialsUrl ? (
        <div className="card stack">
          <h2>Ссылка для дозагрузки материалов</h2>
          <p className="muted">Эту защищённую ссылку можно переслать пациенту вручную, если нужно продублировать доступ.</p>
          <a className="text-link" href={flash.materialsUrl}>
            {flash.materialsUrl}
          </a>
        </div>
      ) : null}

      {flash.portalUrl ? (
        <div className="card stack">
          <h2>Ссылка в центр сообщений</h2>
          <p className="muted">
            Это текущая ссылка входа пациента в закрытый центр сообщений. Она уже отправлена на email, но при необходимости
            её можно переслать повторно вручную.
          </p>
          <a className="text-link" href={flash.portalUrl}>
            {flash.portalUrl}
          </a>
        </div>
      ) : null}

      <section className="two-column">
        <article className="card stack">
          <h2>Пациент и кейс</h2>
          <DefinitionList
            items={[
              { label: "Статус", value: applicationStatusLabel(application.status) },
              {
                label: "Запрошенный продукт",
                value: productLabel(application.requestedProductCode)
              },
              {
                label: "Назначенный продукт",
                value: productLabel(application.assignedProductCode)
              },
              {
                label: "Предпочтительный контакт",
                value: preferredContactLabel(application.patient.preferredContact)
              },
              { label: "Email", value: application.patient.email },
              { label: "Телефон", value: application.patient.phone },
              { label: "Страна / город", value: `${application.patient.country}, ${application.patient.city}` },
              { label: "Часовой пояс", value: application.patient.timezone },
              {
                label: "Формат материалов",
                value: imagingSourceTypeLabel(application.imagingSourceType)
              },
              { label: "Подана", value: formatDateTime(application.submittedAt) }
            ]}
          />
        </article>

        <article className="card stack">
          <h2>Клиническая сводка</h2>
          <div className="stack-sm">
            <p>
              <strong>Основная жалоба:</strong> {application.chiefComplaint}
            </p>
            {application.bodyArea ? (
              <p>
                <strong>Где проблема:</strong> {application.bodyArea}
              </p>
            ) : null}
            {application.symptomTimeline ? (
              <p>
                <strong>Когда и как началось:</strong> {application.symptomTimeline}
              </p>
            ) : null}
            {application.goalOfConsultation ? (
              <p>
                <strong>Цель обращения:</strong> {application.goalOfConsultation}
              </p>
            ) : null}
            {application.reviewNoteForDoctor ? (
              <p>
                <strong>Что важно посмотреть:</strong> {application.reviewNoteForDoctor}
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="two-column">
        <article className="card stack">
          <h2>Тревожные признаки</h2>
          {application.redFlags ? (
            <div className="stack-sm">
              {Object.entries(redFlagLabels).map(([key, label]) => {
                const value = Boolean((application.redFlags as Record<string, unknown>)[key]);

                return (
                  <p key={key} className="muted">
                    {label}: {value ? "да" : "нет"}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="muted">Пациент не отметил тревожные признаки.</p>
          )}
        </article>

        <article className="card stack">
          <h2>История случая</h2>
          <div className="stack-sm">
            {application.traumaHistory ? <p><strong>Травма:</strong> {application.traumaHistory}</p> : null}
            {application.surgeryHistory ? <p><strong>Операции:</strong> {application.surgeryHistory}</p> : null}
            {application.priorDiagnoses ? <p><strong>Диагнозы / мнения:</strong> {application.priorDiagnoses}</p> : null}
            {application.priorSpecialists ? <p><strong>Кто уже смотрел:</strong> {application.priorSpecialists}</p> : null}
            {application.currentTreatment ? <p><strong>Текущее лечение:</strong> {application.currentTreatment}</p> : null}
          </div>
        </article>
      </section>

      <section className="card stack">
        <h2>Загруженные файлы и архивы</h2>
        {application.uploads.length === 0 ? <p className="muted">Материалы внутри системы пока не загружены.</p> : null}
        {application.uploads.map((upload) => (
          <article key={upload.id} className="card stack-sm">
            <div className="card-meta">
              <div className="stack-sm">
                <strong>{upload.originalName}</strong>
                <p className="muted">
                  {uploadCategoryLabel(upload.category)} · {sizeLabel(upload.sizeBytes)}
                  {upload.durationSeconds ? ` · ${upload.durationSeconds} сек` : ""}
                </p>
              </div>
              <span className="status">{uploadStatusLabel(upload.status)}</span>
            </div>
            <p className="muted">Ключ в хранилище: {upload.storageKey}</p>
            <SensitiveAccessPanel
              applicationId={application.id}
              targetId={upload.id}
              targetType="upload"
              hasPassword={Boolean(upload.accessPasswordCiphertext)}
              hasInstructions={Boolean(upload.accessInstructionsCiphertext)}
            />
          </article>
        ))}
      </section>

      <section className="card stack">
        <h2>Внешние ссылки на исследования и архивы</h2>
        {application.externalLinks.length === 0 ? (
          <p className="muted">Внешние ссылки пациент пока не добавил.</p>
        ) : null}
        {application.externalLinks.map((link) => (
          <article key={link.id} className="card stack-sm">
            <div className="card-meta">
              <strong>{link.label || externalLinkKindLabel(link.kind)}</strong>
              <a className="text-link" href={link.url}>
                Открыть ссылку
              </a>
            </div>
            <p className="muted">{externalLinkKindLabel(link.kind)}</p>
            <p className="muted">{link.url}</p>
            {link.note ? <p>{link.note}</p> : null}
            <SensitiveAccessPanel
              applicationId={application.id}
              targetId={link.id}
              targetType="externalLink"
              hasPassword={Boolean(link.accessPasswordCiphertext)}
              hasInstructions={Boolean(link.accessInstructionsCiphertext)}
            />
          </article>
        ))}
      </section>

      <section className="two-column">
        <article className="card stack">
          <h2>Следующий этап кейса</h2>
          <p className="muted">
            После оплаты врач вручную переводит кейс в активные и открывает центр сообщений. Для Product 1 и 2 это окно
            уточнений после результата. Для Product 3 и 4 — рабочая переписка в рамках сопровождения.
          </p>
          <DefinitionList
            items={[
              {
                label: "Последняя оплата",
                value: application.payments[0]
                  ? `${chargeModelLabel(application.payments[0].chargeModel)} · ${formatMoney(
                      application.payments[0].amountCents,
                      application.payments[0].currency
                    )}`
                  : "Пока нет"
              },
              {
                label: "Ближайшая запись",
                value: application.appointments[0]
                  ? `${formatDateTime(application.appointments[0].startsAt)}`
                  : "Пока не создана"
              }
            ]}
          />
          {application.status === "PAID" ? (
            <form action={`/api/admin/applications/${application.id}/activate`} method="post">
              <button className="button" type="submit">
                Активировать кейс и открыть центр сообщений
              </button>
            </form>
          ) : null}
          {application.status === "ACTIVE" ? (
            <form action={`/api/admin/applications/${application.id}/complete`} method="post">
              <button className="button button--secondary" type="submit">
                Завершить кейс
              </button>
            </form>
          ) : null}
        </article>

        <article className="card stack">
          <h2>Статус переписки</h2>
          {thread ? (
            <>
              <DefinitionList
                items={[
                  { label: "Статус", value: threadStatusLabel(thread.status) },
                  { label: "Открыт", value: thread.startsAt ? formatDateTime(thread.startsAt) : "—" },
                  { label: "Доступен до", value: thread.endsAt ? formatDateTime(thread.endsAt) : "Пока кейс активен" },
                  {
                    label: "Сообщения пациента",
                    value:
                      typeof thread.patientMessageLimit === "number"
                        ? `${thread.patientMessageCount} из ${thread.patientMessageLimit}`
                        : `${thread.patientMessageCount} без жёсткого лимита`
                  },
                  { label: "Почему только чтение", value: readOnlyReasonLabel(thread.readOnlyReason) },
                  { label: "Причина закрытия", value: closeReasonLabel(thread.closeReason) }
                ]}
              />
              <p className="muted">
                {thread.status === "ACTIVE"
                  ? "Переписка активна. Пациент может писать по правилам выбранного продукта."
                  : thread.status === "READ_ONLY"
                    ? "Пациент больше не может отправлять новые сообщения, но история остаётся доступной."
                    : "Переписка ещё не открыта или уже закрыта."}
              </p>
            </>
          ) : (
            <p className="muted">Центр сообщений пока не открыт.</p>
          )}
        </article>
      </section>

      {thread ? (
        <section className="two-column">
          <article className="card stack">
            <h2>Переписка по кейсу</h2>
            {thread.messages.length === 0 ? (
              <p className="muted">Сообщений пока нет.</p>
            ) : (
              <div className="stack-sm">
                {thread.messages.map((message) => (
                  <article key={message.id} className="card stack-sm">
                    <div className="card-meta">
                      <strong>{message.senderUser?.name || messageAuthorLabel(message.authorRole)}</strong>
                      <span className="muted">{formatDateTime(message.createdAt)}</span>
                    </div>
                    <p>{message.body}</p>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="card stack">
            <h2>Ответить пациенту</h2>
            {canReply ? (
              <>
                <p className="muted">
                  Этот ответ появится в закрытом центре сообщений, а пациент получит уведомление на email с новой ссылкой
                  входа.
                </p>
                <form action={`/api/admin/applications/${application.id}/messages/reply`} className="stack" method="post">
                  <label className="field">
                    <span>Сообщение</span>
                    <textarea
                      name="body"
                      rows={6}
                      placeholder="Напишите коротко и спокойно, что важно пациенту сейчас."
                      required
                    />
                  </label>
                  <div>
                    <button className="button" type="submit">
                      Отправить ответ
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p className="muted">
                Сейчас новый ответ недоступен: тред ещё не открыт, переведён в режим только для чтения или уже закрыт.
              </p>
            )}
          </article>
        </section>
      ) : null}

      <section className="two-column">
        <article className="card stack">
          <h2>Запросить файлы и документы</h2>
          <p className="muted">Используйте этот запрос, если для просмотра не хватает выписок, фото, видео или архивов внутри системы.</p>
          <form action={`/api/admin/applications/${application.id}/request-upload`} className="stack" method="post">
            <label className="field">
              <span>Что нужно прислать</span>
              <textarea
                name="note"
                rows={4}
                placeholder="Например: добавьте выписку после операции, свежие фото и короткое видео походки."
                required
              />
            </label>
            <div>
              <button className="button" type="submit">
                Отправить запрос на файлы
              </button>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2>Запросить ссылку или доступ</h2>
          <p className="muted">Используйте этот запрос, если ссылка не открывается или не хватает пароля, кода доступа или инструкции.</p>
          <form action={`/api/admin/applications/${application.id}/request-imaging-access`} className="stack" method="post">
            <label className="field">
              <span>Что нужно уточнить по доступу</span>
              <textarea
                name="note"
                rows={4}
                placeholder="Например: пришлите рабочую ссылку на МРТ, пароль к архиву или короткую инструкцию, как открыть исследование."
                required
              />
            </label>
            <div>
              <button className="button" type="submit">
                Отправить запрос на доступ
              </button>
            </div>
          </form>
        </article>
      </section>

      <section className="two-column">
        <article className="card stack">
          <h2>Отклонить кейс</h2>
          <p className="muted">Используйте это действие, если онлайн-формат не подходит, есть red flags или пациенту нужен очный маршрут.</p>
          <form action={`/api/admin/applications/${application.id}/reject`} className="stack" method="post">
            <label className="field">
              <span>Причина для внутренней фиксации</span>
              <textarea
                name="note"
                rows={4}
                placeholder="Например: тревожные признаки, неподходящий формат, требуется очное наблюдение."
                required
              />
            </label>
            <div>
              <button className="button button--secondary" type="submit">
                Отклонить кейс
              </button>
            </div>
          </form>
        </article>

        <article className="card stack">
          <h2>Подготовить персональную ссылку</h2>
          <p className="muted">Используйте это действие, когда материалов достаточно и пациента можно перевести к записи и оплате.</p>
          <form action={`/api/admin/applications/${application.id}/create-offer`} className="form-grid" method="post">
            <label className="field">
              <span>Продукт</span>
              <select
                defaultValue={application.assignedProductCode ?? application.requestedProductCode ?? "SECOND_OPINION"}
                name="productCode"
              >
                <option value="SECOND_OPINION">Продукт 1</option>
                <option value="MEDICAL_ROUTE">Продукт 2</option>
                <option value="RECOVERY_4_WEEKS">Продукт 3</option>
                <option value="PERSONAL_SUPPORT">Продукт 4</option>
              </select>
            </label>
            <label className="field">
              <span>Модель оплаты</span>
              <select defaultValue="ONE_TIME" name="chargeModel">
                <option value="ONE_TIME">Разовая</option>
                <option value="PACKAGE">Пакет</option>
                <option value="RECURRING_READY">Готово к продлению</option>
              </select>
            </label>
            <label className="field">
              <span>Сумма в центах</span>
              <input defaultValue="30000" min="1" name="amountCents" type="number" />
            </label>
            <label className="field">
              <span>Валюта</span>
              <input defaultValue="EUR" name="currency" />
            </label>
            <label className="field field--full">
              <span>Длительность / объём в минутах</span>
              <input defaultValue="45" min="1" name="durationMinutes" type="number" />
            </label>
            <div className="field--full">
              <button className="button" type="submit">
                Создать персональную ссылку
              </button>
            </div>
          </form>
        </article>
      </section>

      <section className="two-column">
        <article className="card stack">
          <h2>История запросов</h2>
          {application.requirements.length === 0 ? (
            <p className="muted">Дополнительные запросы пациенту пока не отправлялись.</p>
          ) : (
            application.requirements.map((requirement) => (
              <article key={requirement.id} className="card stack-sm">
                <div className="card-meta">
                  <strong>{requirementTypeLabel(requirement.type)}</strong>
                  <span className="status">{requirementStatusLabel(requirement.status)}</span>
                </div>
                <p>{requirement.note}</p>
                <p className="muted">Создан: {formatDateTime(requirement.createdAt)} · {requirement.createdBy.name}</p>
                {requirement.accessTokens[0] ? (
                  <p className="muted">Ссылка действует до: {formatDateTime(requirement.accessTokens[0].expiresAt)}</p>
                ) : null}
              </article>
            ))
          )}
        </article>

        <article className="card stack">
          <h2>Подготовленные офферы</h2>
          {application.offers.length === 0 ? (
            <p className="muted">Офферы пока не создавались.</p>
          ) : (
            application.offers.map((offer) => (
              <article key={offer.id} className="card stack-sm">
                <div className="card-meta">
                  <strong>{productLabel(offer.productCode)}</strong>
                  <span className="status">{offerStatusLabel(offer.status)}</span>
                </div>
                <p className="muted">{chargeModelLabel(offer.chargeModel)} · {formatMoney(offer.amountCents, offer.currency)}</p>
                <p className="muted">Создан: {formatDateTime(offer.createdAt)} · {offer.createdBy.name}</p>
                <p className="muted">Истекает: {formatDateTime(offer.expiresAt)}</p>
              </article>
            ))
          )}
        </article>
      </section>

      <div>
        <Link className="text-link" href="/admin/applications">
          ← Вернуться к списку заявок
        </Link>
      </div>
    </AdminShell>
  );
}
