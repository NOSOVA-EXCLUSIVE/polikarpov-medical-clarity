import "server-only";

import type { ChargeModel, PreferredContact, ProductCode, RequirementType } from "@prisma/client";

import {
  chargeModelLabel,
  formatMoney,
  preferredContactLabel,
  productLabel,
  requirementTypeLabel
} from "@/features/admin/presentation";
import { getCloseReasonText, getReadOnlyReasonText, getThreadRulesText } from "@/features/messages/content";
import { prisma } from "@/lib/db/prisma";
import { sendTransactionalEmail } from "@/lib/email/postmark";
import { env } from "@/lib/env/server";

export type NotificationDeliveryResult = {
  status: "sent" | "failed";
  manualFallbackRequired: boolean;
  provider: "postmark";
  errorMessage?: string;
};

async function sendEmailSafely(input: {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody: string;
}): Promise<NotificationDeliveryResult> {
  try {
    await sendTransactionalEmail(input);
    return {
      status: "sent",
      manualFallbackRequired: false,
      provider: "postmark"
    };
  } catch (error) {
    console.error("Email notification failed", error);
    return {
      status: "failed",
      manualFallbackRequired: true,
      provider: "postmark",
      errorMessage: error instanceof Error ? error.message : "Unknown email error"
    };
  }
}

async function getActiveStaffEmails() {
  const staff = await prisma.user.findMany({
    where: { isActive: true },
    select: { email: true }
  });

  return [...new Set(staff.map((item) => item.email).filter(Boolean))];
}

async function getQuestionnaireStaffRecipients() {
  if (env.ADMIN_SEED_EMAIL?.trim()) {
    return [env.ADMIN_SEED_EMAIL.trim()];
  }

  if (env.POSTMARK_REPLY_TO_EMAIL.trim()) {
    return [env.POSTMARK_REPLY_TO_EMAIL.trim()];
  }

  return getActiveStaffEmails();
}

export async function sendQuestionnaireSubmittedStaffEmail(input: {
  applicationId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  preferredContact: PreferredContact;
  city: string;
  country: string;
  timezone: string;
  requestedProductCode: ProductCode | null;
  useQueueLink?: boolean;
}) {
  const recipients = await getQuestionnaireStaffRecipients();

  if (recipients.length === 0) {
    return {
      status: "failed",
      manualFallbackRequired: true,
      provider: "postmark",
      errorMessage: "No staff recipient configured"
    } satisfies NotificationDeliveryResult;
  }

  const adminUrl = input.useQueueLink
    ? `${env.APP_URL}/admin/applications`
    : `${env.APP_URL}/admin/applications/${input.applicationId}`;
  const requestedFormat = input.requestedProductCode
    ? productLabel(input.requestedProductCode)
    : "Пациент пока не выбрал конкретный формат";

  return sendEmailSafely({
    to: recipients,
    subject: `Новая анкета · ${input.patientName}`,
    textBody: [
      "Поступила новая анкета.",
      "",
      `Пациент: ${input.patientName}`,
      `Email: ${input.patientEmail}`,
      `Телефон: ${input.patientPhone}`,
      `Предпочтительный контакт: ${preferredContactLabel(input.preferredContact)}`,
      `Город / страна: ${input.city}, ${input.country}`,
      `Часовой пояс: ${input.timezone}`,
      `Запрошенный формат: ${requestedFormat}`,
      "",
      `Открыть в admin: ${adminUrl}`
    ].join("\n"),
    htmlBody: [
      "<p>Поступила новая анкета.</p>",
      `<p><strong>Пациент:</strong> ${input.patientName}</p>`,
      `<p><strong>Email:</strong> ${input.patientEmail}<br />`,
      `<strong>Телефон:</strong> ${input.patientPhone}<br />`,
      `<strong>Предпочтительный контакт:</strong> ${preferredContactLabel(input.preferredContact)}<br />`,
      `<strong>Город / страна:</strong> ${input.city}, ${input.country}<br />`,
      `<strong>Часовой пояс:</strong> ${input.timezone}<br />`,
      `<strong>Запрошенный формат:</strong> ${requestedFormat}</p>`,
      `<p><a href="${adminUrl}">Открыть заявку в admin</a></p>`
    ].join("")
  });
}

export async function sendMaterialsRequestEmail(input: {
  patientName: string;
  patientEmail: string;
  requirementType: RequirementType;
  note: string;
  materialsUrl: string;
  expiresAt: Date;
}) {
  const requirementLabel = requirementTypeLabel(input.requirementType);

  return sendEmailSafely({
    to: input.patientEmail,
    subject: `Нужны дополнительные материалы · ${requirementLabel}`,
    textBody: [
      `Здравствуйте, ${input.patientName}.`,
      "",
      "Для продолжения разбора врач запросил дополнительные материалы по вашему кейсу.",
      `Что нужно добавить: ${requirementLabel}.`,
      "",
      input.note.trim(),
      "",
      `Открыть защищённую ссылку: ${input.materialsUrl}`,
      `Ссылка действует до: ${input.expiresAt.toLocaleString("ru-RU")}`,
      "",
      "Если ситуация стала срочной, пожалуйста, не используйте эту ссылку вместо очной помощи."
    ].join("\n"),
    htmlBody: [
      `<p>Здравствуйте, ${input.patientName}.</p>`,
      "<p>Для продолжения разбора врач запросил дополнительные материалы по вашему кейсу.</p>",
      `<p><strong>Что нужно добавить:</strong> ${requirementLabel}</p>`,
      `<p>${input.note.trim()}</p>`,
      `<p><a href="${input.materialsUrl}">Открыть защищённую ссылку</a></p>`,
      `<p>Ссылка действует до: ${input.expiresAt.toLocaleString("ru-RU")}</p>`,
      "<p>Если ситуация стала срочной, пожалуйста, не используйте эту ссылку вместо очной помощи.</p>"
    ].join("")
  });
}

export async function sendOfferCreatedEmail(input: {
  patientName: string;
  patientEmail: string;
  productCode: ProductCode;
  chargeModel: ChargeModel;
  amountCents: number;
  currency: string;
  bookingUrl: string;
  expiresAt: Date;
}) {
  const product = productLabel(input.productCode);
  const priceLine = `${chargeModelLabel(input.chargeModel)} · ${formatMoney(
    input.amountCents,
    input.currency
  )}`;

  return sendEmailSafely({
    to: input.patientEmail,
    subject: `Персональная ссылка для записи · ${product}`,
    textBody: [
      `Здравствуйте, ${input.patientName}.`,
      "",
      "Для вас подготовлен персональный следующий шаг по кейсу.",
      `Формат: ${product}`,
      `Стоимость: ${priceLine}`,
      "",
      "Сначала выберите удобный слот. После выбора откроется защищённая страница оплаты.",
      `Перейти к записи: ${input.bookingUrl}`,
      `Ссылка действует до: ${input.expiresAt.toLocaleString("ru-RU")}`,
      "",
      "Если ссылка перестанет открываться, напишите в ответ на это письмо — мы отправим новую."
    ].join("\n"),
    htmlBody: [
      `<p>Здравствуйте, ${input.patientName}.</p>`,
      "<p>Для вас подготовлен персональный следующий шаг по кейсу.</p>",
      `<p><strong>Формат:</strong> ${product}<br />`,
      `<strong>Стоимость:</strong> ${priceLine}</p>`,
      "<p>Сначала выберите удобный слот. После выбора откроется защищённая страница оплаты.</p>",
      `<p><a href="${input.bookingUrl}">Перейти к записи</a></p>`,
      `<p>Ссылка действует до: ${input.expiresAt.toLocaleString("ru-RU")}</p>`,
      "<p>Если ссылка перестанет открываться, напишите в ответ на это письмо — мы отправим новую.</p>"
    ].join("")
  });
}

export async function sendPortalOpenedEmail(input: {
  patientName: string;
  patientEmail: string;
  productCode: ProductCode;
  portalUrl: string;
  expiresAt: Date;
}) {
  const product = productLabel(input.productCode);
  const ruleText = getThreadRulesText(input.productCode);

  await sendEmailSafely({
    to: input.patientEmail,
    subject: `Доступ к центру сообщений · ${product}`,
    textBody: [
      `Здравствуйте, ${input.patientName}.`,
      "",
      `Для вашего кейса открыт закрытый центр сообщений по формату: ${product}.`,
      ruleText,
      "",
      `Открыть центр сообщений: ${input.portalUrl}`,
      `Ссылка действует до: ${input.expiresAt.toLocaleString("ru-RU")}`,
      "",
      "Если ситуация стала экстренной, пожалуйста, не используйте этот раздел и обратитесь за очной помощью."
    ].join("\n"),
    htmlBody: [
      `<p>Здравствуйте, ${input.patientName}.</p>`,
      `<p>Для вашего кейса открыт закрытый центр сообщений по формату: <strong>${product}</strong>.</p>`,
      `<p>${ruleText}</p>`,
      `<p><a href="${input.portalUrl}">Открыть центр сообщений</a></p>`,
      `<p>Ссылка действует до: ${input.expiresAt.toLocaleString("ru-RU")}</p>`,
      "<p>Если ситуация стала экстренной, пожалуйста, не используйте этот раздел и обратитесь за очной помощью.</p>"
    ].join("")
  });
}

export async function sendPatientStatusEmail(input: {
  patientName: string;
  patientEmail: string;
  productCode: ProductCode;
  statusLine: string;
  details: string;
}) {
  await sendEmailSafely({
    to: input.patientEmail,
    subject: `Статус кейса · ${productLabel(input.productCode)}`,
    textBody: [`Здравствуйте, ${input.patientName}.`, "", input.statusLine, input.details].join("\n"),
    htmlBody: [
      `<p>Здравствуйте, ${input.patientName}.</p>`,
      `<p><strong>${input.statusLine}</strong></p>`,
      `<p>${input.details}</p>`
    ].join("")
  });
}

export async function sendThreadReadOnlyEmail(input: {
  patientName: string;
  patientEmail: string;
  productCode: ProductCode;
  reason: "WINDOW_EXPIRED" | "MESSAGE_LIMIT_REACHED" | "PACKAGE_ENDED" | "MANUAL_LOCK" | "CASE_STATUS_CHANGE";
}) {
  await sendPatientStatusEmail({
    patientName: input.patientName,
    patientEmail: input.patientEmail,
    productCode: input.productCode,
    statusLine: "Центр сообщений переведён в режим только для чтения.",
    details: getReadOnlyReasonText(input.reason)
  });
}

export async function sendThreadClosedEmail(input: {
  patientName: string;
  patientEmail: string;
  productCode: ProductCode;
  reason: "CASE_COMPLETED" | "CASE_ARCHIVED" | "MANUAL_CLOSE" | "REJECTED";
}) {
  await sendPatientStatusEmail({
    patientName: input.patientName,
    patientEmail: input.patientEmail,
    productCode: input.productCode,
    statusLine: "Переписка по кейсу закрыта.",
    details: getCloseReasonText(input.reason)
  });
}

export async function sendStaffNewMessageEmail(input: {
  applicationId: string;
  patientName: string;
  productCode: ProductCode;
}) {
  const staffEmails = await getActiveStaffEmails();

  if (staffEmails.length === 0) {
    return;
  }

  const adminUrl = `${env.APP_URL}/admin/applications/${input.applicationId}`;

  await sendEmailSafely({
    to: staffEmails,
    subject: `Новое сообщение пациента · ${input.patientName}`,
    textBody: [
      `Пациент ${input.patientName} отправил новое сообщение по кейсу ${productLabel(input.productCode)}.`,
      "",
      `Открыть карточку заявки: ${adminUrl}`
    ].join("\n"),
    htmlBody: [
      `<p>Пациент <strong>${input.patientName}</strong> отправил новое сообщение по кейсу ${productLabel(input.productCode)}.</p>`,
      `<p><a href="${adminUrl}">Открыть карточку заявки</a></p>`
    ].join("")
  });
}

export async function sendPatientNewMessageEmail(input: {
  patientName: string;
  patientEmail: string;
  productCode: ProductCode;
  portalUrl: string;
  expiresAt: Date;
}) {
  await sendEmailSafely({
    to: input.patientEmail,
    subject: `Новое сообщение по кейсу · ${productLabel(input.productCode)}`,
    textBody: [
      `Здравствуйте, ${input.patientName}.`,
      "",
      "В закрытом центре сообщений появился новый ответ.",
      `Открыть переписку: ${input.portalUrl}`,
      `Ссылка действует до: ${input.expiresAt.toLocaleString("ru-RU")}`
    ].join("\n"),
    htmlBody: [
      `<p>Здравствуйте, ${input.patientName}.</p>`,
      "<p>В закрытом центре сообщений появился новый ответ.</p>",
      `<p><a href="${input.portalUrl}">Открыть переписку</a></p>`,
      `<p>Ссылка действует до: ${input.expiresAt.toLocaleString("ru-RU")}</p>`
    ].join("")
  });
}
