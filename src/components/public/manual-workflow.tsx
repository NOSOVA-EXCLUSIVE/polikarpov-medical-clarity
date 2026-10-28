export type ManualWorkflowVariant = "general" | "written" | "support" | "video";

const completionByVariant = {
  general: {
    title: "Результат и завершение",
    text: "Вы получаете результат согласованного формата. По окончании врач отдельно подтверждает завершение работы."
  },
  written: {
    title: "Письменный результат",
    text: "Вы получаете письменный результат с перечнем изученных материалов, ограничениями оценки и дальнейшими вопросами. Врач подтверждает завершение работы."
  },
  support: {
    title: "Плановые контакты и итог",
    text: "В согласованный период проходят письменные контакты в объёме выбранного формата. По завершении вы получаете итог."
  },
  video: {
    title: "Видео и PDF-памятка",
    text: "Вы получаете персональное видео и PDF-памятку с согласованным содержанием и ограничениями. Врач подтверждает завершение работы."
  }
} satisfies Record<ManualWorkflowVariant, { title: string; text: string }>;

export function ManualWorkflow({ variant = "general" }: { variant?: ManualWorkflowVariant }) {
  const steps = [
    {
      title: "Заявка",
      text: "Вы выбираете формат и передаёте сведения с согласия на обработку данных."
    },
    {
      title: "Предварительная беседа с врачом",
      text: "Врач подтверждает время беседы. Вы уточняете задачу и необходимые материалы."
    },
    {
      title: "Персональное предложение",
      text: "После беседы согласуются формат, объём, стоимость и срок. Вы принимаете персональное предложение."
    },
    {
      title: "Ручная оплата",
      text: "Оплата согласуется и оформляется вручную вне сайта. Оплата сама по себе не запускает работу."
    },
    {
      title: "Отдельное начало работы",
      text: "После оплаты и получения достаточных материалов врач отдельно подтверждает начало работы и согласованную дату готовности."
    },
    completionByVariant[variant]
  ];

  return (
    <div className="service-detail-process-grid manual-workflow">
      {steps.map((step, index) => (
        <article key={step.title} className="service-detail-process-card">
          <p className="service-detail-process-card__number">{String(index + 1).padStart(2, "0")}</p>
          <h3>{step.title}</h3>
          <p className="service-detail-process-card__text">{step.text}</p>
        </article>
      ))}
    </div>
  );
}
