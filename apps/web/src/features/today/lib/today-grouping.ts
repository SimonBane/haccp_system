import type { TodayResponse, TodayTaskItem } from "@haccp/shared";

export function parseScheduledTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

export function occurrenceKey(task: TodayTaskItem): string {
  return task.occurrenceId;
}

export function flatTodayTasks(response: TodayResponse): TodayTaskItem[] {
  return [
    ...response.sections.morning,
    ...response.sections.afternoon,
    ...response.sections.evening,
  ];
}
