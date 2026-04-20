type LoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const hasError = params.error === "auth" || params.error === "invalid";

  return (
    <main className="section">
      <div className="container" style={{ maxWidth: "520px" }}>
        <div className="card stack">
          <p className="eyebrow">Admin</p>
          <h1>Вход для врача и администратора</h1>
          <p className="muted">
            Этот контур предназначен только для разбора заявок, запросов материалов и подготовки персональных офферов.
          </p>

          {hasError ? (
            <div className="notice notice--danger">
              <p>Не удалось выполнить вход. Проверьте email и пароль.</p>
            </div>
          ) : null}

          <form action="/api/admin/login" className="stack" method="post">
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" required />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input name="password" type="password" required />
            </label>
            <div>
              <button className="button" type="submit">
                Войти
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
