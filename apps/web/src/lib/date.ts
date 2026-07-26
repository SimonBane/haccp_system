export function localTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftLocalDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map((value) => Number(value));
  const shifted = new Date(year, month - 1, day);
  shifted.setDate(shifted.getDate() + days);
  return localTodayDateFromDate(shifted);
}

export function localTodayDateFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLocalDate(dateStr: string, locale: string): string {
  const [year, month, day] = dateStr.split("-").map((value) => Number(value));
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}
