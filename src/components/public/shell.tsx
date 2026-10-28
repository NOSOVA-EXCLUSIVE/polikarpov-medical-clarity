import type { ReactNode } from "react";
import Link from "next/link";
import { PRACTICE_LEGAL_LINES } from "@/features/legal/practice";

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
  actionsBeforeDescription?: boolean;
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
          <Link href="/services">Услуги и стоимость</Link>
          <Link href="/questionnaire">Анкета пациента</Link>
          <Link href="/documents">Документы</Link>
          <details className="site-contact-menu">
            <summary>Связаться</summary>
            <nav className="site-contact-menu__links" aria-label="Организационная связь">
              <a href="https://t.me/EvgeniyPolikarpov">Telegram</a>
              <a href="https://wa.me/79165821523">WhatsApp</a>
              <a href="mailto:medicalclarity@proton.me">medicalclarity@proton.me</a>
            </nav>
          </details>
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
              он необходим. Polikarpov Medical Clarity не проводит судебно-медицинские экспертизы и
              не оформляет процессуальные экспертные заключения; материалы сервиса носят
              дистанционный информационно-аналитический характер.{" "}
              <Link href="/documents#legal-info" className="site-footer__legal-link">
                Юридическая информация и формат работы
              </Link>
            </p>
            <div className="site-footer__business">
              <p>{PRACTICE_LEGAL_LINES[0]}</p>
              <p>Аккредитация 7723 030707278 / 7524 032299059</p>
              <nav className="site-footer__contacts" aria-label="Контакты">
                <a
                  className="site-footer__contact"
                  href="https://wa.me/79165821523"
                  aria-label="Написать в WhatsApp"
                  title="WhatsApp"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.5L3 20.7l1.4-4.8A8.5 8.5 0 1 1 20.5 11.8Z" />
                    <path d="m8 7 2 1-1 2a9 9 0 0 0 5 5l2-1 1 2c-1 2-3 2-6-1s-5-6-3-8Z" />
                  </svg>
                </a>
                <a
                  className="site-footer__contact"
                  href="https://t.me/EvgeniyPolikarpov"
                  aria-label="Написать в Telegram"
                  title="Telegram"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="m21 3-6.5 18-4-7.5L3 10Z" />
                    <path d="m10.5 13.5 5-5" />
                  </svg>
                </a>
                <a
                  className="site-footer__contact"
                  href="mailto:medicalclarity@proton.me"
                  aria-label="Написать на medicalclarity@proton.me"
                  title="Email"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </a>
                <a
                  className="site-footer__contact"
                  href="https://www.instagram.com/polikarpovclarity/"
                  aria-label="Instagram Polikarpov Medical Clarity"
                  title="Instagram"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
                  </svg>
                </a>
              </nav>
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
  aside,
  actionsBeforeDescription = false
}: PageHeroProps) {
  const sectionClassName = ["page-hero", className, !aside ? "page-hero--single-column" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <div className="container page-hero__grid">
        <div className="page-hero__content stack">
          {eyebrow ? <div className="page-hero__eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
          {actionsBeforeDescription && actions ? <div className="hero-actions page-hero__actions">{actions}</div> : null}
          {description ? <div className="page-hero__description">{description}</div> : null}
          {supportingContent ? <div className="page-hero__supporting">{supportingContent}</div> : null}
          {!actionsBeforeDescription && actions ? <div className="hero-actions page-hero__actions">{actions}</div> : null}
          {afterActions ? <div className="page-hero__after-actions">{afterActions}</div> : null}
        </div>
        {aside ? <aside className="page-hero__aside">{aside}</aside> : null}
      </div>
    </section>
  );
}
