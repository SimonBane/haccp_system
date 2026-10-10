import {
  RECORD_RESULT,
  type RecordItem,
  type UserSummary,
} from "@haccp/shared";

export const EM_DASH = "—";

export function actorName(user: UserSummary | null): string | null {
  if (!user) return null;
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name === "" ? null : name;
}

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

/** Pass and fail are worth a badge; a record with nothing to judge is not. */
export function hasJudgedResult(item: RecordItem): boolean {
  return item.result !== RECORD_RESULT.NOT_EVALUATED;
}
