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

const PRODUCT_LABELS: Record<ProductCode, string> = {
  SECOND_OPINION: "Экспертное второе мнение",
  MEDICAL_ROUTE: "Клинический разбор ситуации",
  RECOVERY_4_WEEKS: "Контроль восстановления",
  PERSONAL_SUPPORT: "Индивидуальное сопровождение"
};

export function productLabel(productCode: ProductCode | null | undefined) {
  if (!productCode) {
    return "Не назначен";
  }

  return PRODUCT_LABELS[productCode] ?? "Не назначен";
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
  return type === "UPLOAD"
    ? "Запрос материалов"
    : "Запрос доступа к исследованиям";
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
      return "Просмотр исследования";
    case "VIDEO":
      return "Видео по ссылке";
    case "CLOUD":
      return "Архив материалов";
    default:
      return kind;
  }
}

export function imagingSourceTypeLabel(type: ImagingSourceType) {
  switch (type) {
    case "UPLOADED":
      return "Файлы внутри системы";
    case "EXTERNAL_LINK_ONLY":
      return "Ссылки на архивы и исследования";
    case "MIXED":
      return "Файлы и ссылки";
    default:
      return type;
  }
}

export function offerStatusLabel(status: OfferStatus) {
  switch (status) {
    case "OPEN":
      return "Открыт";
    case "HELD":
      return "Слот удержан";
    case "PAID":
      return "Оплачен";
    case "EXPIRED":
      return "Истёк";
    case "CANCELLED":
      return "Отменён";
    default:
      return status;
  }
}

export function preferredContactLabel(contact: PreferredContact) {
  switch (contact) {
    case "PHONE":
      return "Телефон";
    case "WHATSAPP":
      return "WhatsApp";
    case "TELEGRAM":
      return "Telegram";
    case "EMAIL":
      return "Email";
    default:
      return contact;
  }
}

export function uploadCategoryLabel(category: string) {
  switch (category) {
    case "DOCUMENT":
      return "Документ";
    case "IMAGE":
      return "Изображение";
    case "VIDEO":
      return "Видео";
    default:
      return category;
  }
}

export function uploadStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Ожидает";
    case "READY":
      return "Готов";
    case "FAILED":
      return "Ошибка";
    default:
      return status;
  }
}

export function threadStatusLabel(status: ThreadStatus) {
  switch (status) {
    case "INACTIVE":
      return "Ожидает активации";
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

export function readOnlyReasonLabel(reason: ReadOnlyReason | null) {
  switch (reason) {
    case "WINDOW_EXPIRED":
      return "Завершилось окно сообщений";
    case "MESSAGE_LIMIT_REACHED":
      return "Исчерпан лимит сообщений";
    case "PACKAGE_ENDED":
      return "Пакет завершён";
    case "MANUAL_LOCK":
      return "Переведено вручную";
    case "CASE_STATUS_CHANGE":
      return "Статус кейса изменён";
    case null:
      return "Не применимо";
    default:
      return reason;
  }
}

export function closeReasonLabel(reason: CloseReason | null) {
  switch (reason) {
    case "CASE_COMPLETED":
      return "Кейс завершён";
    case "CASE_ARCHIVED":
      return "Кейс архивирован";
    case "MANUAL_CLOSE":
      return "Закрыто вручную";
    case "REJECTED":
      return "Отклонено";
    case null:
      return "Не применимо";
    default:
      return reason;
  }
}

export function messageAuthorLabel(role: MessageAuthorRole) {
  switch (role) {
    case "DOCTOR":
    case "ADMIN":
      return "Врач / администратор";
    case "SYSTEM":
      return "Система";
    case "PATIENT":
    default:
      return "Пациент";
  }
}

export function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export function normalizeCurrencyCode(currency: string) {
  if (currency === "RUB" || currency === "EUR") {
    return currency;
  }

  return "RUB";
}

export function formatMoney(amountCents: number, currency: string) {
  const normalizedCurrency = normalizeCurrencyCode(currency);

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: normalizedCurrency
  }).format(amountCents / 100);
}
