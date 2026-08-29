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

export function formatMinutesOfDay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatTemperature(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatShortDate(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(year, month - 1, day));
}

export function decimalSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((part) => part.type === "decimal")?.value ?? ".";
}
