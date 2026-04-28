import type { ReactNode } from "react";
import Link from "next/link";

type SectionProps = {
  children: ReactNode;
  id?: string;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
};

type PageHeroProps = {
  className?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  supportingContent?: ReactNode;
  actions?: ReactNode;
  afterActions?: ReactNode;
  aside?: ReactNode;
};

type BulletListProps = {
  items: string[];
  className?: string;
};

export function PublicHeader() {
  return (
    <>
      <div id="top" aria-hidden="true" />
      <header className="site-header">
      <div className="container site-header__inner">
        <div className="site-brand">
          <Link href="/" className="site-brand__eyebrow">
            POLIKARPOV MEDICAL CLARITY
          </Link>
          <div className="site-brand__title">
            ТРАВМАТОЛОГ-ОРТОПЕД ПОЛИКАРПОВ ЕВГЕНИЙ СЕРГЕЕВИЧ
          </div>
          <div className="site-brand__subtitle">ВРАЧ МАГНИТНО-РЕЗОНАНСНОЙ ТОМОГРАФИИ</div>
        </div>

        <nav className="site-nav" aria-label="Основная навигация">
          <Link href="/">Главная</Link>
          <Link href="/doctor">О враче</Link>
          <Link href="/services">Форматы помощи</Link>
          <Link href="/questionnaire">Анкета пациента</Link>
          <Link href="/documents">Документы</Link>
        </nav>
      </div>
      </header>
    </>
  );
}

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__frame">
        <div className="site-footer__top">
          <div className="site-footer__identity">
            <p className="site-footer__brand">POLIKARPOV MEDICAL CLARITY</p>
            <p className="site-footer__title">Частная практика травматолога-ортопеда</p>
            <p className="site-footer__copy">
              Цифровой формат для точного разбора сложной ситуации
            </p>
          </div>

          <nav className="footer-links footer-links--legal" aria-label="Юридическая информация">
            <Link href="/legal/offer">Оферта</Link>
            <span className="site-footer__divider">·</span>
            <Link href="/legal/privacy">Политика обработки данных</Link>
            <span className="site-footer__divider">·</span>
            <Link href="/legal/consent">Информированное согласие</Link>
          </nav>
        </div>

        <div className="site-footer__bottom">
          <div className="site-footer__legal-meta">
            <p className="site-footer__copyright">© Polikarpov Medical Clarity. Все права защищены</p>
            <p className="site-footer__legal-note">
              Дистанционный формат взаимодействия носит информационно-консультационный характер,
              не является экстренной медицинской помощью и не заменяет очный приём врача, когда
              он необходим.{" "}
              <Link href="/documents#legal-info" className="site-footer__legal-link">
                Юридическая информация и формат работы
              </Link>
            </p>
            <div className="site-footer__business">
              <p>Исполнитель: Поликарпов Евгений Сергеевич</p>
              <p>Форма деятельности: самозанятый (налог на профессиональный доход)</p>
              <p>ИНН: 771873883546</p>
              <p>
                Email: <a href="mailto:medicalclarity@proton.me">medicalclarity@proton.me</a>
              </p>
            </div>
          </div>
          <a className="site-footer__backtop" href="#top">
            Наверх
          </a>
        </div>
      </div>
    </footer>
  );
}

export function Section({ children, id, className = "", title, description }: SectionProps) {
  const sectionClassName = className ? `section ${className}` : "section";
  const containerClassName = title || description ? "container stack" : "container";

  return (
    <section id={id} className={sectionClassName}>
      <div className={containerClassName}>
        {title || description ? (
          <div className="section-heading stack-sm">
            {title ? <h2>{title}</h2> : null}
            {description ? <p className="lead">{description}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}

export function BulletList({ items, className = "" }: BulletListProps) {
  return (
    <ul className={className ? `list ${className}` : "list"}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PageHero({
  className = "",
  eyebrow,
  title,
  description,
  supportingContent,
  actions,
  afterActions,
  aside
}: PageHeroProps) {
  const sectionClassName = className ? `page-hero ${className}` : "page-hero";

  return (
    <section className={sectionClassName}>
      <div className="container page-hero__grid">
        <div className="page-hero__content stack">
          {eyebrow ? <div className="page-hero__eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          {description ? <div className="page-hero__description">{description}</div> : null}
          {supportingContent ? <div className="page-hero__supporting">{supportingContent}</div> : null}
          {actions ? <div className="hero-actions page-hero__actions">{actions}</div> : null}
          {afterActions ? <div className="page-hero__after-actions">{afterActions}</div> : null}
        </div>
        {aside ? <aside className="page-hero__aside">{aside}</aside> : null}
      </div>
    </section>
  );
}
