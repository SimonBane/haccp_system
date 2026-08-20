const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function addCalendarDays(date: string, days: number): string {
  const match = isoDatePattern.exec(date);
  if (!match) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  const [, yearS, monthS, dayS] = match;
  const shifted = new Date(
    Date.UTC(Number(yearS), Number(monthS) - 1, Number(dayS) + days),
  );

  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function calendarDateRange(
  startDate: string,
  numberOfDays: number,
): string[] {
  return Array.from({ length: numberOfDays }, (_, index) =>
    addCalendarDays(startDate, index),
  );
}
