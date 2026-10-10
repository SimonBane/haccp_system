import type { MeasurementUnit } from "@haccp/shared";
import type { AnswerFormatters } from "./answer-summary";
import { formatMeasurementNumber } from "./measurement";

/** Dates are always `DD.MM.YYYY`, matching the rest of the records UI. */
export function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

/** Pure so server-rendered pages (the print report) format answers exactly as the client does. */
export function buildAnswerFormatters(input: {
  locale: string;
  symbol: (unit: MeasurementUnit) => string;
  yes: string;
  no: string;
}): AnswerFormatters {
  return {
    measurement: (value, unit) =>
      `${formatMeasurementNumber(value, unit, input.locale)} ${input.symbol(unit)}`,
    date: formatCalendarDate,
    yes: input.yes,
    no: input.no,
    empty: "—",
  };
}
