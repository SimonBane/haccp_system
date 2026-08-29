import type { RecordItem } from "@haccp/shared";

export const EM_DASH = "—";

/** Always rendered as `DD.MM.YYYY`, independent of locale, per product decision. */
export function formatOccurrenceDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * `recordedAt`/`createdAt`/`voidedAt` are instants — render them in the site's zone.
 * The date is always `DD.MM.YYYY`, independent of locale, per product decision.
 */
export function formatRecordInstant(
  timestamp: string,
  locale: string,
  timeZone: string,
): string {
  const date = new Date(timestamp);

  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).formatToParts(date);
  const part = (type: "day" | "month" | "year") =>
    parts.find((p) => p.type === type)?.value ?? "";
  const datePart = `${part("day")}.${part("month")}.${part("year")}`;

  const timePart = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);

  return `${datePart}, ${timePart}`;
}

export function formatRecordTimeOfDay(
  timestamp: string,
  locale: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(timestamp));
}

export function formatTemperatureValue(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} °C`;
}

export function formatTemperatureRange(
  minTempC: number | null,
  maxTempC: number | null,
  locale: string,
): string | null {
  if (minTempC === null || maxTempC === null) return null;
  return `${formatTemperatureValue(minTempC, locale)} – ${formatTemperatureValue(maxTempC, locale)}`;
}

export function recordReading(item: RecordItem): number | null {
  return item.record?.temperature?.recordedC ?? null;
}

/** Non-temperature rows have no temperature outcome to report in the grid. */
export function hasTemperatureOutcome(item: RecordItem): boolean {
  return item.type === "temperature";
}
