import type { TodayResponse, TodayTaskItem } from "@haccp/shared";

/** Minutes before/after scheduled time that count as "due now". Easy to tune. */
export const DUE_NOW_WINDOW_MINUTES = 30;

export function parseScheduledTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

export function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Stable identity for a single occurrence of a recurring template. */
export function occurrenceKey(task: TodayTaskItem): string {
  return `${task.templateId}:${task.scheduledTime}:${task.date}`;
}

export function flatTodayTasks(response: TodayResponse): TodayTaskItem[] {
  return [
    ...response.sections.morning,
    ...response.sections.afternoon,
    ...response.sections.evening,
  ];
}

export function isDueNow(
  scheduledTime: string,
  now: Date,
  windowMinutes: number = DUE_NOW_WINDOW_MINUTES,
): boolean {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const scheduledMinutes = parseScheduledTimeToMinutes(scheduledTime);
  return Math.abs(nowMinutes - scheduledMinutes) <= windowMinutes;
}

/** Signed minutes from now until `scheduledTime`. Negative means it has passed. */
export function minutesUntilScheduled(
  scheduledTime: string,
  now: Date,
): number {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return parseScheduledTimeToMinutes(scheduledTime) - nowMinutes;
}
