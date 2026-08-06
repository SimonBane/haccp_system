/**
 * Locale-aware formatting shared across the Today feature.
 *
 * These used to be copy-pasted inside the task card and the day overview, which
 * meant temperatures rendered with a dot separator even in Bulgarian.
 */

/**
 * `completedAt` is a real UTC instant, so it must be rendered in the site's zone
 * — otherwise a reading taken at 08:00 in Sofia reads "06:00" to a UTC browser.
 */
export function formatTimeOfDay(
  timestamp: string,
  locale: string,
  timeZone: string,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(timestamp));
  } catch {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  }
}

/** Wall-clock label, "15:12", for minutes since midnight. */
export function formatMinutesOfDay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatTemperature(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(value);
}

/** Compact day label for the page title — "Mon, 4 Aug". */
export function formatShortDate(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(year, month - 1, day));
}

/** The decimal separator for the active locale — "," in bg, "." in en. */
export function decimalSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((part) => part.type === "decimal")?.value ?? ".";
}
