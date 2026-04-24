import type { ReactNode } from "react";

type AdminShellProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  href?: string;
};

type DefinitionListProps = {
  items: Array<{
    label: ReactNode;
    value: ReactNode;
  }>;
};

export function AdminShell({
  title,
  description,
  actions,
  children
}: AdminShellProps) {
  return (
    <main className="section">
      <div className="container stack">
        <section className="card stack-sm">
          <p className="eyebrow">Admin</p>
          <h1>{title}</h1>
          {description ? <p className="muted">{description}</p> : null}
          {actions ? <div className="hero-actions">{actions}</div> : null}
        </section>
        {children}
      </div>
    </main>
  );
}

export function StatCard({ label, value, href }: StatCardProps) {
  const content = (
    <>
      <p className="muted">{label}</p>
      <strong>{value}</strong>
    </>
  );

  if (href) {
    return (
      <a className="card stack-sm" href={href}>
        {content}
      </a>
    );
  }

  return <div className="card stack-sm">{content}</div>;
}

export function DefinitionList({ items }: DefinitionListProps) {
  return (
    <dl className="stack-sm">
      {items.map((item, index) => (
        <div key={index} className="stack-sm">
          <dt className="muted">{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
