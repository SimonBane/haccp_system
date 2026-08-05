/**
 * Locale-aware formatting shared across the Today feature.
 *
 * These used to be copy-pasted inside the task card and the day overview, which
 * meant temperatures rendered with a dot separator even in Bulgarian.
 */

export function formatTimeOfDay(timestamp: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
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
