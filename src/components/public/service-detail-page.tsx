import Link from "next/link";
import { notFound } from "next/navigation";
import { BulletList, PageHero, Section } from "@/components/public/shell";
import { getServiceV21, formatServicePrice, serviceQuestionnaireHref } from "@/features/products/services-v21";

export function ServiceDetailPage({ service: reference }: { service: { slug: string } }) {
  const service = getServiceV21(reference.slug);
  if (!service || service.kind !== "paid_service") notFound();
  const questionnaireHref = serviceQuestionnaireHref(service.id);
  return (
    <main className={`service-detail-page service-detail-page--${service.slug}`}>
      <PageHero className="service-detail-hero"
        eyebrow={<Link className="service-detail-hero__back" href="/services">← Все форматы помощи</Link>}
        title={service.title}
        description={<div className="stack-sm"><p className="lead">{service.shortDescription}</p><p>{service.description}</p></div>}
        actions={<><Link className="button" href={questionnaireHref}>Выбрать этот формат</Link><Link className="button button--secondary" href="#service-scope">Что входит</Link></>}
        afterActions={<p className="service-detail-hero__note">Объём, стоимость и срок подтверждаются до оплаты. Отправка анкеты не создаёт платёж.</p>}
        aside={<div className="card card--price service-detail-price-aside stack-sm"><p className="eyebrow">Стоимость формата</p><p className="product-card__price service-detail-price-aside__value">{formatServicePrice(service)}</p><p><strong>Срок:</strong> {service.turnaround}</p><p className="muted">Письменный формат. Результат и порядок передачи материалов согласуются заранее.</p></div>}
      />
      <Section id="service-scope" title="Что входит в этот формат"><div className="two-column service-detail-two-column"><article className="card stack"><p className="eyebrow">Объём работы</p><BulletList items={service.scope} /></article><article className="card stack"><p className="eyebrow">Ваш результат</p><h3>{service.result}</h3><p>{service.clarifications}</p><p><strong>Срок:</strong> {service.turnaround}</p></article></div></Section>
      <Section title="Когда этот формат подходит"><div className="two-column service-detail-two-column"><article className="card"><BulletList items={service.forWho} /></article><article className="card stack-sm"><p className="eyebrow">Если вы пока выбираете</p><p>Кратко опишите задачу и перечислите имеющиеся материалы. Организационный подбор бесплатный: полная медицинская анкета и просмотр снимков для него не нужны.</p><Link className="text-link" href={serviceQuestionnaireHref("service-selection")}>Подобрать формат бесплатно →</Link></article></div></Section>
      <Section title="Границы услуги"><article className="card stack"><BulletList items={service.exclusions} /><p className="muted">Формат предназначен для планового обращения. Не заменяет очный осмотр, когда он необходим.</p></article></Section>
      <Section id="service-process" title="Как проходит работа"><div className="service-detail-process-grid service-detail-process-grid--4">{[
        "Вы выбираете формат и передаёте сведения с согласия на обработку данных.",
        "До оплаты уточняются возможность работы, объём материалов, стоимость и срок.",
        "Врач изучает согласованный комплект и готовит персональный письменный результат.",
        "Вы получаете результат с перечнем материалов, ограничениями и дальнейшими вопросами."
      ].map((step, i) => <article key={step} className="service-detail-process-card"><p className="service-detail-process-card__number">{String(i + 1).padStart(2, "0")}</p><p className="service-detail-process-card__text">{step}</p></article>)}</div></Section>
      <Section title="Следующий шаг"><article className="card stack"><p className="eyebrow">{service.title}</p><p className="service-detail-price-card__value">{formatServicePrice(service)}</p><p>Срок отсчитывается после подтверждения формата, достаточности материалов и оплаты; согласованная дата начала сообщается заранее.</p><div className="hero-actions"><Link className="button" href={questionnaireHref}>Перейти к анкете</Link><Link className="button button--secondary" href="/services">Сравнить форматы</Link></div></article></Section>
    </main>
  );
}
