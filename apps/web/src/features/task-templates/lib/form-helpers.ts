import {
  checkMeasurementLimits,
  getMeasurementFields,
  type FormDefinition,
  type LimitOverrides,
  type LimitsIssue,
  type TaskTemplateResponse,
  type TaskTemplateTargetInput,
  type TaskTemplateWeekday,
} from "@haccp/shared";
import { parseMeasurementDraft } from "@/features/forms/lib/measurement";

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

/** Limits stay as typed text; `enabled` keeps typed values around when the admin toggles back to the form's defaults. */
export type OverrideDraft = { enabled: boolean; min: string; max: string };

export type TargetSelection = {
  targetId: string;
  overrides: Record<string, OverrideDraft>;
};

function limitText(value: number | null, separator: string): string {
  return value === null ? "" : String(value).replace(".", separator);
}

export function buildDefaultTargets(
  task: TaskTemplateResponse | null | undefined,
  duplicateSource: TaskTemplateResponse | null | undefined,
  separator: string,
): TargetSelection[] {
  const source = task ?? duplicateSource;
  if (!source) return [];

  return source.targets.map((target) => ({
    targetId: target.targetId,
    overrides: Object.fromEntries(
      Object.entries(target.limitOverrides).map(([fieldId, limits]) => [
        fieldId,
        {
          enabled: true,
          min: limitText(limits.min, separator),
          max: limitText(limits.max, separator),
        },
      ]),
    ),
  }));
}

function parseLimitText(raw: string): number | null | "invalid" {
  if (raw.trim() === "") return null;
  return parseMeasurementDraft(raw) ?? "invalid";
}

export function overrideIssueKey(targetId: string, fieldId: string): string {
  return `${targetId}:${fieldId}`;
}

/**
 * The payload for the selected form: overrides for fields the form no longer measures
 * are dropped, and every enabled override is checked against its field's unit.
 */
export function toTargetInputs(
  selections: readonly TargetSelection[],
  definition: FormDefinition | null,
): { targets: TaskTemplateTargetInput[]; issues: Record<string, LimitsIssue> } {
  const fields = definition ? getMeasurementFields(definition) : [];
  const issues: Record<string, LimitsIssue> = {};

  const targets = selections.map((selection) => {
    const limitOverrides: LimitOverrides = {};

    for (const field of fields) {
      const draft = selection.overrides[field.id];
      if (!draft?.enabled) continue;

      const min = parseLimitText(draft.min);
      const max = parseLimitText(draft.max);
      const key = overrideIssueKey(selection.targetId, field.id);

      if (min === "invalid") {
        issues[key] = "min_out_of_range";
        continue;
      }
      if (max === "invalid") {
        issues[key] = "max_out_of_range";
        continue;
      }

      const limits = { min, max };
      const [issue] = checkMeasurementLimits(limits, field.unit);
      if (issue) {
        issues[key] = issue;
        continue;
      }
      limitOverrides[field.id] = limits;
    }

    return { targetId: selection.targetId, limitOverrides };
  });

  return { targets, issues };
}

function targetsKey(
  targets: readonly { targetId: string; limitOverrides: LimitOverrides }[],
): string {
  return JSON.stringify(
    [...targets]
      .sort((a, b) => a.targetId.localeCompare(b.targetId))
      .map((target) => [
        target.targetId,
        Object.entries(target.limitOverrides)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([fieldId, limits]) => [fieldId, limits.min, limits.max]),
      ]),
  );
}

export function hasTaskChanges(
  values: {
    title: string;
    formId: string;
    weekdays: TaskTemplateWeekday[];
    scheduledTimeRows: ScheduledTimeRowValue[];
    targets: readonly TaskTemplateTargetInput[];
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
    values.formId !== task.formId ||
    weekdaysChanged ||
    timesChanged ||
    targetsKey(values.targets) !== targetsKey(task.targets) ||
    Number(values.completionOpensBeforeMinutes) !==
      task.completionOpensBeforeMinutes ||
    nextDueAfter !== task.completionDueAfterMinutes
  );
}
