import type {
  TaskTemplateResponse,
  TaskTemplateType,
  TaskTemplateWeekday,
} from "@haccp/shared";
import { TASK_TEMPLATE_TYPE } from "@haccp/shared";

export const TASK_TYPES: TaskTemplateType[] = [
  TASK_TEMPLATE_TYPE.TEMPERATURE,
  TASK_TEMPLATE_TYPE.CLEANING,
];

export function findDuplicateScheduledTimeIndices(
  times: string[],
): Set<number> {
  const countsByTime = new Map<string, number>();
  for (const time of times) {
    if (!time) continue;
    countsByTime.set(time, (countsByTime.get(time) ?? 0) + 1);
  }

  const duplicateIndices = new Set<number>();
  times.forEach((time, index) => {
    if (time && (countsByTime.get(time) ?? 0) > 1) {
      duplicateIndices.add(index);
    }
  });

  return duplicateIndices;
}

export function getNextDefaultScheduledTime(existingTimes: string[]): string {
  const lastTime = existingTimes.at(-1);
  if (!lastTime) return "08:00";

  const [hourString] = lastTime.split(":");
  const nextHour = ((Number(hourString) + 1) % 24).toString().padStart(2, "0");
  return `${nextHour}:00`;
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

  if (Array.isArray(error)) {
    for (const item of error) {
      const message = (item as { time?: { message?: string } } | undefined)
        ?.time?.message;
      if (message) return message;
    }
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

export type CompletionWindowValues = {
  completionOpensBeforeMinutes: string;
  completionDueAfterMinutes: string;
  neverOverdue: boolean;
};

export function buildDefaultCompletionWindow(
  task?: TaskTemplateResponse | null,
  duplicateSource?: TaskTemplateResponse | null,
): CompletionWindowValues {
  const source = task ?? duplicateSource;

  if (source) {
    return {
      completionOpensBeforeMinutes: String(source.completionOpensBeforeMinutes),
      completionDueAfterMinutes:
        source.completionDueAfterMinutes === null
          ? ""
          : String(source.completionDueAfterMinutes),
      neverOverdue: source.completionDueAfterMinutes === null,
    };
  }

  return {
    completionOpensBeforeMinutes: "",
    completionDueAfterMinutes: "",
    neverOverdue: false,
  };
}

export function hasTaskChanges(
  values: {
    title: string;
    type: TaskTemplateType | "";
    weekdays: TaskTemplateWeekday[];
    scheduledTimeRows: ScheduledTimeRowValue[];
    equipmentId: string | null;
    completionOpensBeforeMinutes: string;
    completionDueAfterMinutes: string;
    neverOverdue: boolean;
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

  const nextDueAfter = values.neverOverdue
    ? null
    : Number(values.completionDueAfterMinutes);

  return (
    values.title !== task.title ||
    values.type !== task.type ||
    weekdaysChanged ||
    timesChanged ||
    values.equipmentId !== task.equipmentId ||
    Number(values.completionOpensBeforeMinutes) !==
      task.completionOpensBeforeMinutes ||
    nextDueAfter !== task.completionDueAfterMinutes
  );
}
