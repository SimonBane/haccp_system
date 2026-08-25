import {
  addCalendarDays,
  addCalendarMonths,
  compareCalendarDates,
  defaultRecordsDateRange,
  endOfCalendarMonth,
  startOfCalendarMonth,
  validateRecordsDateRange,
  type RecordsDateRangeError,
} from "@haccp/shared";
import type { RecordsDateRange } from "./records-grid-config";

export const RECORDS_RANGE_PRESETS = [
  "last7",
  "last30",
  "last60",
  "last90",
  "thisMonth",
  "previousMonth",
] as const;

export type RecordsRangePreset = (typeof RECORDS_RANGE_PRESETS)[number];

export type RecordsRangeSelection = RecordsRangePreset | "custom";

/** Every preset is computed from the organization-local `today`, never a runtime `Date`. */
export function resolveRecordsPreset(
  preset: RecordsRangePreset,
  today: string,
): RecordsDateRange {
  switch (preset) {
    case "last7":
      return defaultRecordsDateRange(today);
    case "last30":
      return { dateFrom: addCalendarDays(today, -29), dateTo: today };
    case "last60":
      return { dateFrom: addCalendarDays(today, -59), dateTo: today };
    case "last90":
      return { dateFrom: addCalendarDays(today, -89), dateTo: today };
    case "thisMonth":
      // Clamped to today: the rest of the month has not happened yet.
      return { dateFrom: startOfCalendarMonth(today), dateTo: today };
    case "previousMonth": {
      const inPreviousMonth = addCalendarMonths(
        startOfCalendarMonth(today),
        -1,
      );
      return {
        dateFrom: startOfCalendarMonth(inPreviousMonth),
        dateTo: endOfCalendarMonth(inPreviousMonth),
      };
    }
  }
}

export function detectRecordsRangePreset(
  range: RecordsDateRange,
  today: string,
): RecordsRangeSelection {
  const match = RECORDS_RANGE_PRESETS.find((preset) => {
    const candidate = resolveRecordsPreset(preset, today);
    return (
      candidate.dateFrom === range.dateFrom && candidate.dateTo === range.dateTo
    );
  });

  return match ?? "custom";
}

export function recordsRangeError(
  range: RecordsDateRange,
  today: string,
): RecordsDateRangeError | null {
  return validateRecordsDateRange({ ...range, today });
}

export function isSameRecordsRange(
  a: RecordsDateRange,
  b: RecordsDateRange,
): boolean {
  return a.dateFrom === b.dateFrom && a.dateTo === b.dateTo;
}

export function isFutureCalendarDate(date: string, today: string): boolean {
  return compareCalendarDates(date, today) > 0;
}
