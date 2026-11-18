import { TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES } from "@haccp/shared";

/** "Opens" choices; 1440 (start of the day) keeps windows saved before the redesign editable. */
export const OPENS_OPTIONS = [0, 15, 30, 60, 120, 1440] as const;
/** "Overdue" choices; null is "Never". */
export const DUE_OPTIONS = [0, 15, 30, 60, 120, null] as const;

export const DEFAULT_WINDOW = { opensBefore: 30, dueAfter: 60 } as const;

/** No window is stored as opening at the start of the day with no deadline — the API's own "always available". */
export const NO_WINDOW = {
  completionOpensBeforeMinutes: TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES,
  completionDueAfterMinutes: null,
} as const;

export function isStartOfDay(opensBefore: number): boolean {
  return opensBefore >= TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES;
}

export function hasWindow(task: {
  completionOpensBeforeMinutes: number;
  completionDueAfterMinutes: number | null;
}): boolean {
  return !(
    isStartOfDay(task.completionOpensBeforeMinutes) &&
    task.completionDueAfterMinutes === null
  );
}

export type DurationLabels = {
  minutes: (count: number) => string;
  hours: (count: number) => string;
  hoursMinutes: (hours: number, minutes: number) => string;
};

export function formatDuration(minutes: number, labels: DurationLabels): string {
  if (minutes < 60) return labels.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? labels.hours(hours) : labels.hoursMinutes(hours, rest);
}

export type WindowLabels = {
  duration: DurationLabels;
  anyTime: string;
  startAtTime: string;
  startAtStartOfDay: string;
  startBefore: (duration: string) => string;
  endAtTime: string;
  endAfter: (duration: string) => string;
  range: (start: string, end: string) => string;
  rangeNoDeadline: (start: string) => string;
};

/** "Any time that day" or "From 30 min before to 1 h after" — one line for tables, cards and the preview. */
export function formatWindowRange(
  window: { opensBefore: number; dueAfter: number | null } | null,
  labels: WindowLabels,
): string {
  if (!window) return labels.anyTime;
  const start =
    window.opensBefore === 0
      ? labels.startAtTime
      : isStartOfDay(window.opensBefore)
        ? labels.startAtStartOfDay
        : labels.startBefore(formatDuration(window.opensBefore, labels.duration));
  if (window.dueAfter === null) return labels.rangeNoDeadline(start);
  const end =
    window.dueAfter === 0
      ? labels.endAtTime
      : labels.endAfter(formatDuration(window.dueAfter, labels.duration));
  return labels.range(start, end);
}

export function windowOf(task: {
  completionOpensBeforeMinutes: number;
  completionDueAfterMinutes: number | null;
}): { opensBefore: number; dueAfter: number | null } | null {
  return hasWindow(task)
    ? {
        opensBefore: task.completionOpensBeforeMinutes,
        dueAfter: task.completionDueAfterMinutes,
      }
    : null;
}
