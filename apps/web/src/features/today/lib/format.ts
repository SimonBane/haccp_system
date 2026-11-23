import { addCalendarDays } from "@haccp/shared";

/** `completedAt` is a UTC instant — render it in the site's zone, not the browser's. */
export function formatTimeOfDay(
  timestamp: string,
  locale: string,
  timeZone: string,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).format(new Date(timestamp));
  } catch {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(timestamp));
  }
}

function calendarDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export type RelativeDay = "today" | "yesterday" | "tomorrow";

export function relativeDay(
  isoDate: string,
  todayDate: string,
): RelativeDay | null {
  if (isoDate === todayDate) return "today";
  if (isoDate === addCalendarDays(todayDate, -1)) return "yesterday";
  if (isoDate === addCalendarDays(todayDate, 1)) return "tomorrow";
  return null;
}

function dayMonthOptions(locale: string): Intl.DateTimeFormatOptions {
  // Bulgarian Intl prints a short month beside a day as digits ("23.11").
  return {
    day: "numeric",
    month: new Intl.Locale(locale).language === "bg" ? "long" : "short",
  };
}

export function formatDayMonth(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, dayMonthOptions(locale)).format(
    calendarDate(isoDate),
  );
}

export function formatWeekdayDayMonth(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    ...dayMonthOptions(locale),
    weekday: "short",
  }).format(calendarDate(isoDate));
}

export function formatLongDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(calendarDate(isoDate));
}
