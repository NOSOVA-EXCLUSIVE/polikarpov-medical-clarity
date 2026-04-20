import type { QuestionnaireSubmitInput } from "@/features/questionnaire/schemas";

export const QUESTIONNAIRE_LEAD_STATUSES = {
  new: {
    code: "new",
    label: "Новая анкета",
    description: "Анкета получена и ожидает первичного клинического разбора."
  },
  in_review: {
    code: "in_review",
    label: "На разборе",
    description: "Врач изучает ситуацию, материалы и клинический контекст."
  },
  contacted: {
    code: "contacted",
    label: "Связь установлена",
    description: "Пациент получил первое профессиональное сообщение по анкете."
  },
  waiting_reply: {
    code: "waiting_reply",
    label: "Ожидается ответ",
    description: "Материалы разобраны, ожидается обратная связь пациента."
  },
  offer_sent: {
    code: "offer_sent",
    label: "Предложен формат",
    description: "Пациенту предложен конкретный формат работы и дальнейшие шаги."
  },
  payment_pending: {
    code: "payment_pending",
    label: "Ожидается оплата",
    description: "Формат согласован, ожидается подтверждение оплаты."
  },
  paid: {
    code: "paid",
    label: "Оплачено",
    description: "Оплата получена, можно переходить к записи и подготовке."
  },
  closed: {
    code: "closed",
    label: "Закрыто",
    description: "Работа по анкете завершена без дальнейшего движения."
  }
} as const;

export type QuestionnaireLeadStatusCode = keyof typeof QUESTIONNAIRE_LEAD_STATUSES;

export const QUESTIONNAIRE_LEAD_STATUS = QUESTIONNAIRE_LEAD_STATUSES.new;

export const QUESTIONNAIRE_LEAD_TRANSITIONS: Readonly<
  Record<QuestionnaireLeadStatusCode, QuestionnaireLeadStatusCode[]>
> = {
  new: ["in_review", "closed"],
  in_review: ["contacted", "offer_sent", "closed"],
  contacted: ["waiting_reply", "offer_sent", "closed"],
  waiting_reply: ["offer_sent", "closed"],
  offer_sent: ["payment_pending", "closed"],
  payment_pending: ["paid", "closed"],
  paid: ["closed"],
  closed: []
} as const;

export const QUESTIONNAIRE_COMMUNICATION_PLAN = {
  firstTouchWindowHours: {
    min: 3,
    max: 12
  },
  firstReminderAfterHours: 24,
  secondReminderAfterHours: 48
} as const;

export const QUESTIONNAIRE_MESSAGE_TEMPLATES = {
  firstMessage: `Здравствуйте!

Я внимательно изучил(а) вашу анкету и материалы.

Спасибо, что подробно описали ситуацию — это помогает увидеть картину целиком.

По вашей ситуации:
[врач добавляет 1–2 коротких персональных наблюдения]

Сейчас важно:
[краткий вывод]

Я вижу, что в вашем случае возможен онлайн-формат работы и могу предложить вам следующий вариант:

👉 [название формата]

Что вы получите:
— разбор ситуации
— объяснение, что происходит
— рекомендации
— ответы на вопросы

Стоимость: [цена]

Если вам подходит — напишите, и я предложу удобное время.`,
  firstReminder: `Здравствуйте!

Я подготовил для вас разбор по анкете.

Подскажите, пожалуйста, актуален ли для вас вопрос —
и я направлю рекомендации и варианты работы.`,
  secondReminder: `Напомню о себе 🙂

Если вопрос ещё актуален — напишите, и я подскажу, как лучше действовать в вашей ситуации.`,
  replyBridge: `Если вам подходит этот формат, можем перейти к записи.
Я предложу удобное время после оплаты.`,
  paymentRequest: `Отлично, тогда зафиксируем формат.

Стоимость: [цена]

После оплаты я:
— забронирую для вас время
— подготовлюсь к разбору

[ссылка на оплату]

После оплаты напишите, пожалуйста, и я сразу подтвержу запись.`,
  paymentConfirmed: `Спасибо, оплату получил(а).

Я подготовлюсь к разбору вашей ситуации.

В ближайшее время предложу удобное время для консультации.`
} as const;

function trimObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      typeof entry === "string" ? entry.trim() : entry
    ])
  ) as T;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function buildQuestionnaireSnapshot(input: QuestionnaireSubmitInput) {
  return {
    statusLabel: QUESTIONNAIRE_LEAD_STATUS.label,
    requestedProductCode: input.requestedProductCode,
    patient: trimObject({
      fullName: input.patient.fullName,
      age: input.patient.age ?? "",
      email: input.patient.email,
      phone: input.patient.phone,
      preferredContact: input.patient.preferredContact,
      country: input.patient.country,
      city: input.patient.city,
      timezone: input.patient.timezone
    }),
    caseDetails: trimObject({
      chiefComplaint: input.caseDetails.chiefComplaint,
      bodyArea: input.caseDetails.bodyArea ?? "",
      symptomTimeline: input.caseDetails.symptomTimeline ?? "",
      traumaHistory: input.caseDetails.traumaHistory ?? "",
      surgeryHistory: input.caseDetails.surgeryHistory ?? "",
      priorDiagnoses: input.caseDetails.priorDiagnoses ?? "",
      priorSpecialists: input.caseDetails.priorSpecialists ?? "",
      currentTreatment: input.caseDetails.currentTreatment ?? "",
      goalOfConsultation: input.caseDetails.goalOfConsultation ?? "",
      reviewNoteForDoctor: input.caseDetails.reviewNoteForDoctor ?? ""
    }),
    redFlags: input.redFlags,
    legal: input.legal,
    uploads: input.uploads.map((upload) => ({
      category: upload.category,
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      extension: upload.extension,
      sizeBytes: upload.sizeBytes,
      durationSeconds: upload.durationSeconds ?? null,
      storageKey: upload.storageKey
    })),
    externalLinks: input.externalLinks.map((link) => ({
      kind: link.kind,
      url: link.url,
      label: link.label ?? null,
      note: link.note ?? null
    }))
  };
}

export function buildQuestionnaireWorkflowHooks(input: {
  submissionId: string;
  submittedAt: Date;
  preferredContact: QuestionnaireSubmitInput["patient"]["preferredContact"];
  requestedProductCode: QuestionnaireSubmitInput["requestedProductCode"];
}) {
  const firstTouchEarliest = addHours(
    input.submittedAt,
    QUESTIONNAIRE_COMMUNICATION_PLAN.firstTouchWindowHours.min
  );
  const firstTouchLatest = addHours(
    input.submittedAt,
    QUESTIONNAIRE_COMMUNICATION_PLAN.firstTouchWindowHours.max
  );
  const firstReminderAt = addHours(
    input.submittedAt,
    QUESTIONNAIRE_COMMUNICATION_PLAN.firstReminderAfterHours
  );
  const secondReminderAt = addHours(
    input.submittedAt,
    QUESTIONNAIRE_COMMUNICATION_PLAN.secondReminderAfterHours
  );

  return {
    leadStatus: {
      current: QUESTIONNAIRE_LEAD_STATUS.code,
      label: QUESTIONNAIRE_LEAD_STATUS.label,
      availableStatuses: Object.values(QUESTIONNAIRE_LEAD_STATUSES),
      transitions: QUESTIONNAIRE_LEAD_TRANSITIONS,
      history: [
        {
          status: QUESTIONNAIRE_LEAD_STATUS.code,
          label: QUESTIONNAIRE_LEAD_STATUS.label,
          at: input.submittedAt.toISOString()
        }
      ]
    },
    doctorNotification: {
      id: `doctor-notification-${input.submissionId}`,
      event: "questionnaire.submitted",
      status: "pending",
      channel: "internal",
      recipientRole: "doctor",
      createdAt: input.submittedAt.toISOString()
    },
    reviewQueue: {
      id: `review-${input.submissionId}`,
      queue: "doctor-review",
      status: "pending",
      priority: "standard",
      createdAt: input.submittedAt.toISOString(),
      visibleFrom: input.submittedAt.toISOString()
    },
    communication: {
      primaryChannel: input.preferredContact,
      firstTouch: {
        templateKey: "firstMessage",
        earliestAt: firstTouchEarliest.toISOString(),
        latestAt: firstTouchLatest.toISOString(),
        nextStatus: "contacted" as QuestionnaireLeadStatusCode
      },
      reminders: [
        {
          templateKey: "firstReminder",
          sendAt: firstReminderAt.toISOString(),
          nextStatus: "waiting_reply" as QuestionnaireLeadStatusCode
        },
        {
          templateKey: "secondReminder",
          sendAt: secondReminderAt.toISOString(),
          nextStatus: "waiting_reply" as QuestionnaireLeadStatusCode
        }
      ],
      replyBridge: {
        templateKey: "replyBridge",
        nextStatus: "offer_sent" as QuestionnaireLeadStatusCode
      }
    },
    paymentPreparation: {
      requestedProductCode:
        input.requestedProductCode === "NOT_SURE" ? null : input.requestedProductCode,
      requestTemplateKey: "paymentRequest",
      confirmationTemplateKey: "paymentConfirmed",
      pendingStatus: "payment_pending" as QuestionnaireLeadStatusCode,
      paidStatus: "paid" as QuestionnaireLeadStatusCode
    },
    integrations: {
      emailNotification: {
        status: "ready_for_integration",
        event: "questionnaire.submitted"
      },
      telegramNotification: {
        status: "ready_for_integration",
        event: "questionnaire.submitted"
      },
      whatsappNotification: {
        status: "ready_for_integration",
        event: "questionnaire.submitted"
      },
      crmPush: {
        status: "ready_for_integration",
        event: "lead.created"
      },
      adminDashboard: {
        status: "ready",
        queue: "doctor-review"
      }
    }
  };
}
