import {
  checkMeasurementLimits,
  getMeasurementFields,
  type FormDefinition,
  type LimitOverrides,
  type LimitsIssue,
  type MeasurementField,
  type TaskTemplateFieldsInput,
  type TaskTemplateResponse,
  type TaskTemplateTargetInput,
} from "@haccp/shared";
import { parseMeasurementDraft } from "@/features/forms/lib/measurement";

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

/** Keeps each still-selected target's override drafts, so deselecting another loses nothing. */
export function applyTargetSelection(
  selections: readonly TargetSelection[],
  targetIds: readonly string[],
): TargetSelection[] {
  const byId = new Map(
    selections.map((selection) => [selection.targetId, selection]),
  );
  return targetIds.map(
    (targetId) => byId.get(targetId) ?? { targetId, overrides: {} },
  );
}

export function countTargetsWithCustomLimits(
  selections: readonly TargetSelection[],
  fieldIds: readonly string[],
): number {
  return selections.filter((selection) =>
    fieldIds.some((fieldId) => selection.overrides[fieldId]?.enabled),
  ).length;
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

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

/** Whether saving would change anything; editing without changes just goes back to the list. */
export function hasTaskChanges(
  payload: TaskTemplateFieldsInput,
  task: TaskTemplateResponse,
): boolean {
  return (
    payload.formId !== task.formId ||
    !sameMembers(payload.weekdays, task.weekdays) ||
    !sameMembers(payload.scheduledTimes, task.scheduledTimes) ||
    targetsKey(payload.targets) !== targetsKey(task.targets) ||
    payload.completionOpensBeforeMinutes !== task.completionOpensBeforeMinutes ||
    payload.completionDueAfterMinutes !== task.completionDueAfterMinutes
  );
}

/** One switch per target: turning it on starts every measured field from the form's own limits. */
export function setOwnLimits(
  selections: readonly TargetSelection[],
  targetId: string,
  fields: readonly MeasurementField[],
  enabled: boolean,
  separator: string,
): TargetSelection[] {
  return selections.map((selection) => {
    if (selection.targetId !== targetId) return selection;
    const overrides = { ...selection.overrides };
    for (const field of fields) {
      const current = overrides[field.id] ?? {
        enabled: false,
        min: limitText(field.limits.min, separator),
        max: limitText(field.limits.max, separator),
      };
      overrides[field.id] = { ...current, enabled };
    }
    return { ...selection, overrides };
  });
}

export function patchOwnLimit(
  selections: readonly TargetSelection[],
  targetId: string,
  fieldId: string,
  patch: Partial<Pick<OverrideDraft, "min" | "max">>,
): TargetSelection[] {
  return selections.map((selection) => {
    const draft = selection.overrides[fieldId];
    if (selection.targetId !== targetId || !draft) return selection;
    return {
      ...selection,
      overrides: { ...selection.overrides, [fieldId]: { ...draft, ...patch } },
    };
  });
}
