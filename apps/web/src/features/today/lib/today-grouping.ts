import type { TodayResponse, TodayTaskItem } from "@haccp/shared";
import { zonedMinutesOfDay } from "@haccp/shared";

export const DUE_NOW_WINDOW_MINUTES = 30;

export function parseScheduledTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

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
  timeZone: string,
  windowMinutes: number = DUE_NOW_WINDOW_MINUTES,
): boolean {
  const nowMinutes = zonedMinutesOfDay(now, timeZone);
  const scheduledMinutes = parseScheduledTimeToMinutes(scheduledTime);
  const minutesSinceScheduled = nowMinutes - scheduledMinutes;
  return minutesSinceScheduled >= 0 && minutesSinceScheduled <= windowMinutes;
}

/** Signed minutes from now until `scheduledTime`. Negative means it has passed. */
export function minutesUntilScheduled(
  scheduledTime: string,
  now: Date,
  timeZone: string,
): number {
  return (
    parseScheduledTimeToMinutes(scheduledTime) - zonedMinutesOfDay(now, timeZone)
  );
}
