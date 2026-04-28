import type {
  ApplicationStatus,
  ChargeModel,
  CloseReason,
  ExternalLinkKind,
  ImagingSourceType,
  MessageAuthorRole,
  OfferStatus,
  PreferredContact,
  ProductCode,
  ReadOnlyReason,
  RequirementStatus,
  RequirementType,
  ThreadStatus
} from "@prisma/client";

import { canonicalProductLabelByCode } from "@/features/products/catalog";

export function productLabel(productCode: ProductCode | null | undefined) {
  if (!productCode) {
    return "Не назначен";
  }

  return canonicalProductLabelByCode[productCode] ?? "Не назначен";
}

export function applicationStatusLabel(status: ApplicationStatus) {
  switch (status) {
    case "NEW":
      return "Новая";
    case "UNDER_REVIEW":
      return "На просмотре врачом";
    case "NEEDS_UPLOAD":
      return "Ждут файлы";
    case "NEEDS_IMAGING_ACCESS":
      return "Ждут доступ к исследованиям";
    case "REJECTED":
      return "Отклонена";
    case "BOOKING_SENT":
      return "Ссылка отправлена";
    case "PAID":
      return "Оплачено";
    case "ACTIVE":
      return "Активна";
    case "COMPLETED":
      return "Завершена";
    case "ARCHIVED":
      return "В архиве";
    default:
      return status;
  }
}

export function requirementTypeLabel(type: RequirementType) {
  return type === "UPLOAD" ? "Запрос материалов" : "Запрос доступов к исследованиям";
}

export function requirementStatusLabel(status: RequirementStatus) {
  switch (status) {
    case "OPEN":
      return "Ожидает пациента";
    case "RESOLVED":
      return "Выполнено";
    default:
      return status;
  }
}

export function chargeModelLabel(model: ChargeModel) {
  switch (model) {
    case "ONE_TIME":
      return "Разовая оплата";
    case "PACKAGE":
      return "Пакет";
    case "RECURRING_READY":
      return "Готово к продлению";
    default:
      return model;
  }
}

export function externalLinkKindLabel(kind: ExternalLinkKind) {
  switch (kind) {
    case "IMAGING":
      return "Ссылка на исследование";
    case "VIDEO":
      return "Ссылка на видео";
    case "CLOUD":
      return "Облако / архив";
    default:
      return kind;
  }
}

export function imagingSourceTypeLabel(type: ImagingSourceType | null | undefined) {
  switch (type) {
    case "UPLOADED":
      return "Только загруженные файлы";
    case "EXTERNAL_LINK_ONLY":
      return "Только внешние ссылки";
    case "MIXED":
      return "Файлы и внешние ссылки";
    default:
      return "Материалы пока не добавлены";
  }
}

export function offerStatusLabel(status: OfferStatus) {
  switch (status) {
    case "OPEN":
      return "Ссылка активна";
    case "HELD":
      return "Слот удержан";
    case "PAID":
      return "Оплачено";
    case "EXPIRED":
      return "Срок истёк";
    case "CANCELLED":
      return "Отменено";
    default:
      return status;
  }
}

export function preferredContactLabel(contact: PreferredContact) {
  switch (contact) {
    case "EMAIL":
      return "Email";
    case "PHONE":
      return "Телефон";
    case "WHATSAPP":
      return "WhatsApp";
    case "TELEGRAM":
      return "Telegram";
    default:
      return contact;
  }
}

export function uploadCategoryLabel(category: "DOCUMENT" | "IMAGE" | "VIDEO") {
  switch (category) {
    case "DOCUMENT":
      return "Документ или архив";
    case "IMAGE":
      return "Изображение";
    case "VIDEO":
      return "Видео";
    default:
      return category;
  }
}

export function uploadStatusLabel(status: "PENDING" | "ATTACHED" | "DELETED") {
  switch (status) {
    case "PENDING":
      return "Ожидает подтверждения";
    case "ATTACHED":
      return "Прикреплён";
    case "DELETED":
      return "Удалён";
    default:
      return status;
  }
}

export function threadStatusLabel(status: ThreadStatus) {
  switch (status) {
    case "INACTIVE":
      return "Ещё не открыт";
    case "ACTIVE":
      return "Активен";
    case "READ_ONLY":
      return "Только чтение";
    case "CLOSED":
      return "Закрыт";
    default:
      return status;
  }
}

export function readOnlyReasonLabel(reason: ReadOnlyReason | null | undefined) {
  switch (reason) {
    case "WINDOW_EXPIRED":
      return "Окно уточнений завершилось";
    case "MESSAGE_LIMIT_REACHED":
      return "Лимит сообщений пациента исчерпан";
    case "PACKAGE_ENDED":
      return "Период сопровождения завершён";
    case "MANUAL_LOCK":
      return "Переписка переведена в режим чтения вручную";
    case "CASE_STATUS_CHANGE":
      return "Статус кейса изменился";
    default:
      return "—";
  }
}

export function closeReasonLabel(reason: CloseReason | null | undefined) {
  switch (reason) {
    case "CASE_COMPLETED":
      return "Кейс завершён";
    case "CASE_ARCHIVED":
      return "Кейс в архиве";
    case "MANUAL_CLOSE":
      return "Закрыто вручную";
    case "REJECTED":
      return "Кейс отклонён";
    default:
      return "—";
  }
}

export function messageAuthorLabel(role: MessageAuthorRole) {
  switch (role) {
    case "PATIENT":
      return "Пациент";
    case "DOCTOR":
      return "Врач";
    case "ADMIN":
      return "Администратор";
    case "SYSTEM":
      return "Система";
    default:
      return role;
  }
}

export function formatDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency
  }).format(amountCents / 100);
}
