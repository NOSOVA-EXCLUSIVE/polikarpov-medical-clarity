import type { ProductCode, ReadOnlyReason } from "@prisma/client";

export const SUPPORT_PACKAGE_DAYS_BY_PRODUCT: Partial<Record<ProductCode, number>> = {
  RECOVERY_4_WEEKS: 28
};

export function getThreadRulesText(productCode: ProductCode) {
  switch (productCode) {
    case "SECOND_OPINION":
      return "Это окно коротких уточнений после консультации. Здесь можно задать до 3 сообщений в течение 72 часов. Новый кейс, повторный полный разбор и отправка больших MRI, видео или архивов без решения врача здесь не проводятся.";
    case "MEDICAL_ROUTE":
      return "Это окно уточнений по составленному маршруту. Здесь можно задать до 5 сообщений в течение 7 дней. Новый кейс, повторный полный разбор и отправка больших MRI, видео или архивов без решения врача здесь не проводятся.";
    case "RECOVERY_4_WEEKS":
      return "Центр сообщений открыт на срок пакета сопровождения. Используйте его для рабочих вопросов по восстановлению и самочувствию в рамках уже согласованного плана.";
    case "PERSONAL_SUPPORT":
      return "Центр сообщений открыт на срок активного сопровождения. Используйте его для текущих вопросов по кейсу и организационных уточнений в рамках согласованного плана.";
    default:
      return "Центр сообщений доступен только в рамках активного кейса.";
  }
}

export function getOpeningSystemMessage(productCode: ProductCode) {
  switch (productCode) {
    case "SECOND_OPINION":
      return "Окно уточнений открыто. Здесь можно задать короткие вопросы по итогам консультации в течение 72 часов.";
    case "MEDICAL_ROUTE":
      return "Окно уточнений по маршруту открыто. Здесь можно уточнить шаги и последовательность действий в течение 7 дней.";
    case "RECOVERY_4_WEEKS":
      return "Сопровождение запущено. Этот центр сообщений используйте для текущих вопросов по восстановлению в течение пакета.";
    case "PERSONAL_SUPPORT":
      return "Индивидуальное сопровождение запущено. Этот центр сообщений используйте для текущих вопросов по кейсу в течение активного пакета.";
    default:
      return "Центр сообщений открыт.";
  }
}

export function getReadOnlyReasonText(reason: ReadOnlyReason) {
  switch (reason) {
    case "WINDOW_EXPIRED":
      return "Окно уточнений завершилось.";
    case "MESSAGE_LIMIT_REACHED":
      return "Лимит сообщений пациента исчерпан.";
    case "PACKAGE_ENDED":
      return "Период сопровождения завершён.";
    case "MANUAL_LOCK":
      return "Переписка временно переведена в режим только для чтения.";
    case "CASE_STATUS_CHANGE":
      return "Статус кейса изменился, поэтому отправка новых сообщений недоступна.";
    default:
      return "Переписка переведена в режим только для чтения.";
  }
}

export function getCloseReasonText(reason: "CASE_COMPLETED" | "CASE_ARCHIVED" | "MANUAL_CLOSE" | "REJECTED") {
  switch (reason) {
    case "CASE_COMPLETED":
      return "Кейс завершён.";
    case "CASE_ARCHIVED":
      return "Кейс переведён в архив.";
    case "MANUAL_CLOSE":
      return "Переписка закрыта вручную.";
    case "REJECTED":
      return "Кейс отклонён.";
    default:
      return "Переписка закрыта.";
  }
}
