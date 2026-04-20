import Link from "next/link";

import { BulletList, PageHero, Section } from "@/components/public/shell";
import type { ServiceDetailContent } from "@/features/products/service-detail-content";

type ServiceDetailPageProps = {
  service: ServiceDetailContent;
};

export function ServiceDetailPage({ service }: ServiceDetailPageProps) {
  return (
    <main className="service-detail-page">
      <PageHero
        className="service-detail-hero"
        eyebrow={
          <Link className="service-detail-hero__back" href="/services">
            ← Вернуться к форматам помощи
          </Link>
        }
        title={service.title}
        description={
          <div className="stack-sm">
            <p className="lead">{service.subtitle}</p>
            <p>{service.description}</p>
          </div>
        }
        actions={
          <>
            <Link className="button" href="/questionnaire">
              Заполнить анкету
            </Link>
            <Link className="button button--secondary" href="#service-process">
              Как проходит работа
            </Link>
          </>
        }
        afterActions={
          <p className="service-detail-hero__note">
            Оплата производится после подтверждения формата врачом.
          </p>
        }
        aside={
          <div className="card card--price service-detail-price-aside stack-sm">
            <p className="eyebrow">Стоимость</p>
            {service.referencePrice ? (
              <p className="service-detail-price-aside__old">{service.referencePrice}</p>
            ) : null}
            <p className="product-card__price service-detail-price-aside__value">{service.price}</p>
            {service.euroPrice ? <p className="service-detail-price-aside__euro">{service.euroPrice}</p> : null}
            <p className="muted">Начало работы — через анкету пациента и просмотр материалов.</p>
          </div>
        }
      />

      <div className="container service-detail-context">
        <p className="service-detail-context__text">Вы выбрали формат: {service.title}</p>
      </div>

      <Section title="Для кого">
        <div className="two-column service-detail-two-column">
          <article className="card stack-sm">
            <BulletList items={service.forWho} />
          </article>
        </div>
      </Section>

      <Section title="Что делает врач">
        <div className="two-column service-detail-two-column">
          <article className="card stack-sm">
            <BulletList items={service.doctorDoes} />
          </article>
        </div>
      </Section>

      <Section id="service-outcomes" title="Что вы получите">
        <div className="two-column service-detail-two-column">
          <article className="card stack-sm">
            <BulletList items={service.outcomes} />
          </article>
          <article className="card service-detail-inline-cta stack-sm">
            <p className="eyebrow">Следующий шаг</p>
            <p>
              Если этот формат соответствует вашей задаче, начать можно с анкеты пациента.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/questionnaire">
                Заполнить анкету
              </Link>
            </div>
          </article>
        </div>
      </Section>

      <Section id="service-process" title="Как проходит работа">
        <div className={`service-detail-process-grid service-detail-process-grid--${service.process.length}`}>
          {service.process.map((step, index) => (
            <article key={`${service.slug}-${step}`} className="service-detail-process-card">
              <p className="service-detail-process-card__number">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="service-detail-process-card__text">{step}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Когда не подходит">
        <div className="two-column service-detail-two-column">
          <article className="card stack-sm">
            <BulletList items={service.notSuitable} />
          </article>
        </div>
      </Section>

      <Section id="service-price" title="Стоимость">
        <div className="two-column service-detail-two-column">
          <article className="card service-detail-price-card stack-sm">
            <p className="eyebrow">Стоимость формата</p>
            {service.referencePrice ? (
              <p className="service-detail-price-card__old">{service.referencePrice}</p>
            ) : null}
            <p className="service-detail-price-card__value">{service.price}</p>
            {service.euroPrice ? <p className="service-detail-price-card__euro">{service.euroPrice}</p> : null}
            <p>Оплата осуществляется после первичного разбора и подтверждения формата.</p>
          </article>
          <article className="card service-detail-inline-cta stack-sm">
            <p>
              Анкета позволяет врачу понять ситуацию и подтвердить, что именно этот формат действительно уместен.
            </p>
            <div className="hero-actions">
              <Link className="button" href="/questionnaire">
                Заполнить анкету
              </Link>
            </div>
          </article>
        </div>
      </Section>

      <div className="container service-detail-choice-note">
        <p className="service-detail-choice-note__text">
          Если вы не уверены в выборе формата —<br />
          врач уточнит его после анализа анкеты.
        </p>
      </div>

      <section id="service-cta" className="services-final-cta service-detail-final-cta">
        <div className="container">
          <div className="services-final-cta__card stack">
            <div className="services-final-cta__copy stack-sm">
              <h2>
                <span className="services-final-cta__line">Если этот формат соответствует вашей ситуации,</span>
                <span className="services-final-cta__line">
                  начать можно с анкеты пациента — это первый спокойный шаг к решению.
                </span>
              </h2>
              <p className="services-final-cta__lead">
                Врач сначала изучит ситуацию и материалы, затем подтвердит, подходит ли этот формат в вашем случае.
              </p>
            </div>

            <div className="services-final-cta__actions stack-sm">
              <div className="hero-actions">
                <Link className="button" href="/questionnaire">
                  Заполнить анкету
                </Link>
              </div>
              <p className="services-final-cta__micro-note">
                Конфиденциально. Спокойно. По существу.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
