import { AdminCalendarMonth } from "@/components/admin/calendar-month";
import { AdminCalendarOpenForm } from "@/components/admin/calendar-open-form";
import { AdminShell } from "@/components/admin/shell";
import { getAdminCalendarMonth } from "@/features/calendar/service";
import { requireManualStaff } from "@/features/manual-v21/access";
import { redirect } from "next/navigation";

type SearchParams = { month?: string; timezone?: string; notice?: string; error?: string };
type PageProps = { searchParams?: Promise<SearchParams> };

export default async function AdminCalendarPage({ searchParams }: PageProps) {
  try { await requireManualStaff(); }
  catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 401) redirect("/admin/login");
    return <AdminShell title="Расписание врача" description="Доступ к календарю ограничен">
      <p className="notice" role="alert">Требуется действующая учётная запись врача или администратора.</p>
    </AdminShell>;
  }
  const params = (await searchParams) ?? {};
  let calendar: Awaited<ReturnType<typeof getAdminCalendarMonth>>;
  try { calendar = await getAdminCalendarMonth({ month: params.month, timezone: params.timezone }); }
  catch {
    return <AdminShell title="Расписание врача" description="Календарь месяца">
      <p className="notice" role="alert">Не удалось показать расписание. Проверьте выбранный месяц и часовой пояс или обновите страницу.</p>
      <a className="button button--secondary" href="/admin/calendar">Открыть текущий месяц</a>
    </AdminShell>;
  }
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: calendar.timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = (type: string) => todayParts.find(item => item.type === type)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;

  return <AdminShell
    title={<span className="admin-page-title">Расписание врача</span>}
    description="Открывайте удобное время для предварительных бесед и смотрите все записи на одном календаре."
    actions={<a className="button button--secondary" href="#calendar-open-time">Открыть время</a>}
  >
    <div className="admin-calendar-page stack">
      {params.notice === "slot_created" || params.notice === "slot_updated" ? <p className="notice" role="status">Расписание обновлено.</p> : null}
      {params.error ? <p className="notice notice--danger" role="alert">Не удалось изменить расписание. Обновите страницу и проверьте состояние выбранного времени.</p> : null}
      <AdminCalendarMonth calendar={calendar} today={today}/>
      <AdminCalendarOpenForm key={`${calendar.month}-${calendar.timeZone}`} dates={calendar.days.filter(day => day.date >= today).map(day => day.date)} timeZone={calendar.timeZone}/>
    </div>
  </AdminShell>;
}
