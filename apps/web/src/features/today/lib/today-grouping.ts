import type { TodayResponse, TodayTaskItem } from "@haccp/shared";

export function parseScheduledTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

/** A scheduled check is keyed by its occurrence; an on-demand entry by its record. */
export function todayItemKey(task: TodayTaskItem): string {
  return task.occurrenceId ?? task.recordId ?? "";
}

export function flatTodayTasks(response: TodayResponse): TodayTaskItem[] {
  return [
    ...response.sections.morning,
    ...response.sections.afternoon,
    ...response.sections.evening,
  ];
}
