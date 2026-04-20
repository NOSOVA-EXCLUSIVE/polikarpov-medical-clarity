import "server-only";

import type { ProductCode } from "@prisma/client";

import { productLabel } from "@/features/admin/presentation";
import { getCloseReasonText, getReadOnlyReasonText, getThreadRulesText } from "@/features/messages/content";
import { prisma } from "@/lib/db/prisma";
import { sendTransactionalEmail } from "@/lib/email/postmark";
import { env } from "@/lib/env/server";

async function sendEmailSafely(input: {
  to: string | string[];
  subject: string;
  htmlBody: string;
  textBody: string;
}) {
  try {
    await sendTransactionalEmail(input);
  } catch (error) {
    console.error("Email notification failed", error);
  }
}

async function getActiveStaffEmails() {
  const staff = await prisma.user.findMany({
    where: { isActive: true },
    select: { email: true }
  });

  return [...new Set(staff.map((item) => item.email).filter(Boolean))];
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
