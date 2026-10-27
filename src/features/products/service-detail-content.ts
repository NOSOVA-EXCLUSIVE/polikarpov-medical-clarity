import {
  allServicesV21,
  formatServicePrice,
  type ServiceV21
} from "@/features/products/services-v21";

export type ServiceDetailContent = {
  catalogVersion: "2.1";
  serviceId: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  referencePrice?: string;
  euroPrice?: string;
  forWho: string[];
  doctorDoes: string[];
  outcomes: string[];
  process: string[];
  notSuitable: string[];
  turnaround: string;
  clarifications: string;
};

function buildServiceDetail(service: ServiceV21): ServiceDetailContent {
  return {
    catalogVersion: service.catalogVersion,
    serviceId: service.id,
    slug: service.slug,
    title: service.title,
    subtitle: service.shortDescription,
    description: service.description,
    price: formatServicePrice(service),
    forWho: service.forWho,
    doctorDoes: service.scope,
    outcomes: [service.result, service.clarifications],
    process: service.kind === "organizational_selection"
      ? [
          "Вы кратко описываете задачу и перечисляете имеющиеся материалы.",
          "Вы выбираете время организационного созвона; врач подтверждает его.",
          "На созвоне уточняются подходящий формат и порядок передачи материалов до окончательного предложения и оплаты.",
          "Вы получаете организационный ответ без медицинской оценки и просмотра снимков."
        ]
      : [
          "Вы описываете задачу и указываете, какие обследования уже есть.",
          "После согласия на обработку данных вы передаёте необходимые материалы. Врач предварительно знакомится с обращением.",
          "Вы выбираете время уточняющего созвона; врач подтверждает его. Созвон проходит до окончательного предложения и оплаты.",
          "После созвона врач подтверждает формат, объём, стоимость и срок. Вы принимаете персональное предложение; получение оплаты фиксируется вручную.",
          "Врач отдельно подтверждает начало работы и согласованные даты.",
          "Врач изучает материалы в пределах согласованного объёма, фиксирует ограничения и проверяет выводы.",
          "Вы получаете проверенный врачом персональный результат по согласованному случаю в своём кабинете."
        ],
    notSuitable: service.exclusions,
    turnaround: service.turnaround,
    clarifications: service.clarifications
  };
}

export const serviceDetailContentMap: Record<string, ServiceDetailContent> =
  Object.fromEntries(allServicesV21.map((service) => [service.slug, buildServiceDetail(service)]));
