import Link from "next/link";
import type { Route } from "next";

import { allServicesV21, formatServicePrice, serviceQuestionnaireHref } from "@/features/products/services-v21";

const serviceGroups = [
  {
    id: "first-step",
    title: "Первый шаг и понятное объяснение",
    ids: ["initial-assessment", "report-explanation"]
  },
  {
    id: "expert-review",
    title: "Исследования и клиническая история",
    ids: ["second-opinion", "clinical-review", "complex-review", "complex-case"]
  },
  {
    id: "continued-support",
    title: "Повторная работа и сопровождение",
    ids: ["follow-up", "recovery-control", "personal-support", "personal-video"]
  }
];

export function ServiceOverview({
  idPrefix = "service-overview",
  destination = "details"
}: {
  idPrefix?: string;
  destination?: "details" | "questionnaire";
}) {
  const paidServices = allServicesV21.filter((service) => service.kind === "paid_service");

  return (
    <div className="service-overview">
      {serviceGroups.map((group) => {
        const services = paidServices.filter((service) => group.ids.includes(service.id));
        const headingId = `${idPrefix}-${group.id}-title`;

        return (
          <section key={group.id} className="service-overview__group" aria-labelledby={headingId}>
            <h2 id={headingId} className="service-overview__heading">{group.title}</h2>
            <div className="service-overview__grid">
              {services.map((service) => (
                <article key={service.id} id={`${idPrefix}-${service.id}`} className="service-overview-card">
                  <h3 className="service-overview-card__title">
                    <Link className="service-overview-card__link" href={(
                      destination === "questionnaire"
                        ? serviceQuestionnaireHref(service.id)
                        : `/services/${service.slug}`
                    ) as Route}>
                      {service.title}
                    </Link>
                  </h3>
                  <p className="service-overview-card__price">{formatServicePrice(service)}</p>
                  <p className="service-overview-card__description">{service.shortDescription}</p>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
