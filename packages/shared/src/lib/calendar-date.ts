const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(date: string): boolean {
  return isoDatePattern.test(date);
}

function assertCalendarDate(date: string): void {
  if (!isoDatePattern.test(date)) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
}

function calendarParts(date: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = isoDatePattern.exec(date);
  if (!match) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function formatCalendarDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addCalendarDays(date: string, days: number): string {
  const { year, month, day } = calendarParts(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return formatCalendarDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

export function calendarDateRange(
  startDate: string,
  numberOfDays: number,
): string[] {
  return Array.from({ length: numberOfDays }, (_, index) =>
    addCalendarDays(startDate, index),
  );
}

/** ISO calendar dates are lexicographically ordered, so string compare is the calendar compare. */
export function compareCalendarDates(a: string, b: string): number {
  assertCalendarDate(a);
  assertCalendarDate(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function startOfCalendarMonth(date: string): string {
  const { year, month } = calendarParts(date);
  return formatCalendarDate(year, month, 1);
}

export function endOfCalendarMonth(date: string): string {
  const { year, month } = calendarParts(date);
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(year, month, 0));
  return formatCalendarDate(year, month, last.getUTCDate());
}

/** Clamps to the last valid day, so 2026-03-31 minus one month is 2026-02-28. */
export function addCalendarMonths(date: string, months: number): string {
  const { year, month, day } = calendarParts(date);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  const shiftedYear = shifted.getUTCFullYear();
  const shiftedMonth = shifted.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(shiftedYear, shiftedMonth, 0)).getUTCDate();

  return formatCalendarDate(shiftedYear, shiftedMonth, Math.min(day, lastDay));
}
