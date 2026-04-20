import Link from "next/link";

import { BulletList, PageHero, Section } from "@/components/public/shell";
import type { PublicProduct } from "@/features/products/catalog";

type ProductPageTemplateProps = {
  product: PublicProduct;
};

export function ProductPageTemplate({ product }: ProductPageTemplateProps) {
  const [price, ...priceDetailsParts] = product.priceModel.split(" · ");
  const priceDetails = priceDetailsParts.join(" · ");

  return (
    <main>
      <PageHero
        eyebrow={`${product.shortLabel} · ${product.entryLabel}`}
        title={product.name}
        description={product.heroSummary}
        actions={
          <div className="stack-sm">
            <Link className="button" href={`/questionnaire?product=${product.slug}`}>
              {product.ctaLabel}
            </Link>
            <p className="muted">{product.ctaNote}</p>
          </div>
        }
        aside={
          <div className="card card--price stack-sm">
            <p className="eyebrow">Стоимость</p>
            <p className="product-card__price">{price}</p>
            {priceDetails ? <p className="muted">{priceDetails}</p> : null}
            <p className="muted">{product.duration}</p>
            <div className="notice">
              <p>{product.routeNote}</p>
            </div>
          </div>
        }
      />

      <Section
        title="Когда этот формат действительно подходит"
        description="На сайте открыто показаны все форматы помощи, но у каждого из них своя задача, глубина разбора и уровень сопровождения."
      >
        <BulletList items={product.forWho} />
      </Section>

      <Section
        title="Почему здесь нужен именно такой формат"
        description={product.positioningNote}
      >
        <BulletList items={product.whyThisFormat} />
      </Section>

      <Section title="Что входит в этот формат">
        <BulletList items={product.includes} />
      </Section>

      <Section title="Что важно понимать заранее">
        <BulletList items={product.excludes} />
      </Section>

      <Section title="Что это даст и каким может быть следующий шаг">
        <div className="two-column">
          <article className="card stack-sm">
            <h3>Что пациент получает на этом этапе</h3>
            <BulletList items={product.outcomes} />
          </article>
          <article className="card stack-sm">
            <h3>Что может быть дальше</h3>
            <BulletList items={product.nextSteps} />
          </article>
        </div>
      </Section>
    </main>
  );
}
