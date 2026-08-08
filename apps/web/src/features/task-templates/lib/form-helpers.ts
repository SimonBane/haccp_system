import type {
  TaskTemplateResponse,
  TaskTemplateType,
  TaskTemplateWeekday,
} from "@haccp/shared";
import { TASK_TEMPLATE_ALL_WEEKDAYS } from "@haccp/shared";
import {
  isEveryDayWeekdays,
  isWeekdaysPreset,
} from "@/features/task-templates/lib/format-schedule";

/**
 * Pure helpers behind the task template form: preset detection, default value
 * construction, duplicate-time validation and the dirty check.
 *
 * Split out because the form was 814 lines with ~130 of them sitting above the
 * component — none of which needed React, and all of which are testable on
 * their own.
 */

export type WeekdayPreset = "everyDay" | "weekdays" | "custom" | "none";

export function getWeekdayPreset(weekdays: TaskTemplateWeekday[]): WeekdayPreset {
  if (weekdays.length === 0) {
    return "none";
  }

  if (isEveryDayWeekdays(weekdays)) {
    return "everyDay";
  }

  if (isWeekdaysPreset(weekdays)) {
    return "weekdays";
  }

  return "custom";
}

export const TASK_TYPES: TaskTemplateType[] = ["temperature", "cleaning"];

export const WEEKDAY_PRESET_OPTIONS: Array<Exclude<WeekdayPreset, "none">> = [
  "everyDay",
  "weekdays",
  "custom",
];

export function hasDuplicateScheduledTimes(times: string[]): boolean {
  const filledTimes = times.filter(Boolean);
  return new Set(filledTimes).size !== filledTimes.length;
}

export function getScheduledTimeRowsErrorMessage(
  error: unknown,
): string | undefined {
  if (!error || typeof error !== "object") return undefined;

  if ("message" in error && error.message) {
    return String(error.message);
  }

  if (
    "root" in error &&
    error.root &&
    typeof error.root === "object" &&
    "message" in error.root &&
    error.root.message
  ) {
    return String(error.root.message);
  }

  return undefined;
}

export type ScheduledTimeRowValue = {
  time: string;
};

export function buildDefaultTimeRows(
  task?: TaskTemplateResponse | null,
  duplicateSource?: TaskTemplateResponse | null,
): ScheduledTimeRowValue[] {
  const source = task ?? duplicateSource;
  if (source && source.scheduledTimes.length > 0) {
    return source.scheduledTimes.map((time) => ({ time }));
  }

  return [];
}

export function buildDefaultWeekdays(
  task?: TaskTemplateResponse | null,
  duplicateSource?: TaskTemplateResponse | null,
): TaskTemplateWeekday[] {
  const source = task ?? duplicateSource;
  if (source) {
    return source.weekdays;
  }

  return [];
}

export function hasTaskChanges(
  values: {
    title: string;
    type: TaskTemplateType | "";
    weekdays: TaskTemplateWeekday[];
    scheduledTimeRows: ScheduledTimeRowValue[];
    equipmentId: string | null;
  },
  task: TaskTemplateResponse,
): boolean {
  const nextTimes = values.scheduledTimeRows.map((row) => row.time);

  const weekdaysChanged =
    values.weekdays.length !== task.weekdays.length ||
    values.weekdays.some((weekday) => !task.weekdays.includes(weekday));

  const timesChanged =
    nextTimes.length !== task.scheduledTimes.length ||
    nextTimes.some((time) => !task.scheduledTimes.includes(time));

  return (
    values.title !== task.title ||
    values.type !== task.type ||
    weekdaysChanged ||
    timesChanged ||
    values.equipmentId !== task.equipmentId
  );
}
