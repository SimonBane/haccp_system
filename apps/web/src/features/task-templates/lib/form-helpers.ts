import type {
  TaskTemplateFieldsInput,
  TaskTemplateResponse,
} from "@haccp/shared";

export type TargetSelection = { targetId: string };

export function buildDefaultTargets(
  task: TaskTemplateResponse | null | undefined,
  duplicateSource: TaskTemplateResponse | null | undefined,
): TargetSelection[] {
  const source = task ?? duplicateSource;
  if (!source) return [];
  return source.targets.map((target) => ({ targetId: target.targetId }));
}

export function applyTargetSelection(
  targetIds: readonly string[],
): TargetSelection[] {
  return targetIds.map((targetId) => ({ targetId }));
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
    !sameMembers(
      payload.targets.map((target) => target.targetId),
      task.targets.map((target) => target.targetId),
    ) ||
    payload.completionOpensBeforeMinutes !== task.completionOpensBeforeMinutes ||
    payload.completionDueAfterMinutes !== task.completionDueAfterMinutes
  );
}
