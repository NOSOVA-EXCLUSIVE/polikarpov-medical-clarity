import Link from "next/link";
import type { ReactNode } from "react";

export function AdminShell({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="section">
      <div className="container stack">
        <div className="card stack-sm">
          <p className="eyebrow">Админ-панель</p>
          <div className="card-meta">
            <div className="stack-sm">
              <h1>{title}</h1>
              {description ? <p className="muted">{description}</p> : null}
            </div>
            <nav className="site-nav" aria-label="Навигация по админ-панели">
              <Link href="/admin/dashboard">Обзор</Link>
              <Link href="/admin/applications">Заявки</Link>
              <Link href="/admin/calendar">Календарь</Link>
              <Link href="/admin/booking-links">Ссылки на запись</Link>
            </nav>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

export function StatCard({
  label,
  value,
  href
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <article className="card stack-sm">
      <p className="muted">{label}</p>
      <h2>{value}</h2>
    </article>
  );

  if (!href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

export function DefinitionList({
  items
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <div className="stack-sm">
      {items.map((item) => (
        <div key={item.label} className="card-meta">
          <strong>{item.label}</strong>
          <span className="muted">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
