/** Explicit IANA-zone conversion. A server-local datetime is never a booking instant. */
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let result = formatters.get(timeZone);
  if (!result) {
    result = new Intl.DateTimeFormat("en-GB", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    });
    if (formatters.size >= 64) formatters.clear();
    formatters.set(timeZone, result);
  }
  return result;
}

export function assertTimeZone(timeZone: string) {
  if (typeof timeZone !== "string" || !timeZone || timeZone.length > 100) throw new Error("CALENDAR_TIMEZONE_INVALID");
  try { formatter(timeZone).format(0); }
  catch { throw new Error("CALENDAR_TIMEZONE_INVALID"); }
  return timeZone;
}

function partsInZone(value: Date, timeZone: string) {
  const entries = formatter(timeZone).formatToParts(value);
  const get = (type: string) => Number(entries.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function dateParts(date: string) {
  const match = datePattern.exec(date);
  if (!match) throw new Error("CALENDAR_DATE_INVALID");
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1900 || year > 9998) throw new Error("CALENDAR_DATE_INVALID");
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (instant.getUTCFullYear() !== year || instant.getUTCMonth() + 1 !== month || instant.getUTCDate() !== day) {
    throw new Error("CALENDAR_DATE_INVALID");
  }
  return { year, month, day };
}

export function localDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  assertTimeZone(timeZone);
  const wanted = dateParts(date);
  const match = timePattern.exec(time);
  if (!match) throw new Error("CALENDAR_TIME_INVALID");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const wall = Date.UTC(wanted.year, wanted.month - 1, wanted.day, hour, minute);
  const offsets = new Set<number>();
  // Collect both offsets around transitions, including date-line changes.
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = wall + hours * 3_600_000;
    const p = partsInZone(new Date(sample), timeZone);
    offsets.add(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - sample);
  }
  const matches = [...offsets].map((offset) => new Date(wall - offset)).filter((candidate) => {
    const p = partsInZone(candidate, timeZone);
    return p.year === wanted.year && p.month === wanted.month && p.day === wanted.day && p.hour === hour && p.minute === minute && p.second === 0;
  });
  if (matches.length === 0) throw new Error("CALENDAR_LOCAL_TIME_NONEXISTENT");
  if (matches.length !== 1) throw new Error("CALENDAR_LOCAL_TIME_AMBIGUOUS");
  return matches[0];
}

export function dateKeyInZone(value: Date, timeZone: string) {
  assertTimeZone(timeZone);
  const p = partsInZone(value, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function nextDate(date: string) {
  const p = dateParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day + 1)).toISOString().slice(0, 10);
}

export function getMonthBounds(month?: string, timeZone = "Europe/Moscow") {
  assertTimeZone(timeZone);
  const selected = month ?? dateKeyInZone(new Date(), timeZone).slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selected)) throw new Error("CALENDAR_MONTH_INVALID");
  const first = `${selected}-01`;
  const p = dateParts(first);
  const after = new Date(Date.UTC(p.year, p.month, 1)).toISOString().slice(0, 10);
  const days: string[] = [];
  for (let day = first; day !== after; day = nextDate(day)) days.push(day);
  return {
    month: selected, timeZone,
    start: localDateTimeToUtc(first, "00:00", timeZone),
    end: localDateTimeToUtc(after, "00:00", timeZone), days
  };
}
