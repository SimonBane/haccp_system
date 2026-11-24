import {
  FORM_APPLIES_TO,
  TASK_TEMPLATE_ALL_WEEKDAYS,
  sortScheduledTimes,
  sortWeekdays,
  type FormAppliesTo,
  type TaskTemplateResponse,
  type TaskTemplateWeekday,
} from "@haccp/shared";
import {
  DEFAULT_WINDOW,
  NO_WINDOW,
  windowOf,
} from "./completion-window";
import { buildDefaultTargets, type TargetSelection } from "./form-helpers";

export type TaskDraft = {
  formId: string | null;
  targets: TargetSelection[];
  weekdays: TaskTemplateWeekday[];
  times: string[];
  windowOn: boolean;
  opensBefore: number;
  dueAfter: number | null;
};


export function emptyDraft(): TaskDraft {
  return {
    formId: null,
    targets: [],
    weekdays: [...TASK_TEMPLATE_ALL_WEEKDAYS],
    times: [],
    windowOn: false,
    opensBefore: DEFAULT_WINDOW.opensBefore,
    dueAfter: DEFAULT_WINDOW.dueAfter,
  };
}

/** Loads a saved task, or the source of a duplicate. */
export function draftFromTask(task: TaskTemplateResponse): TaskDraft {
  const window = windowOf(task);

  return {
    formId: task.formId,
    targets: buildDefaultTargets(task, null),
    weekdays: sortWeekdays(task.weekdays),
    times: sortScheduledTimes([...task.scheduledTimes]),
    windowOn: window !== null,
    opensBefore: window?.opensBefore ?? DEFAULT_WINDOW.opensBefore,
    dueAfter: window ? window.dueAfter : DEFAULT_WINDOW.dueAfter,
  };
}

export function draftTimes(draft: TaskDraft): string[] {
  return sortScheduledTimes([...draft.times]);
}

export function draftWindow(
  draft: TaskDraft,
): { opensBefore: number; dueAfter: number | null } | null {
  return draft.windowOn
    ? { opensBefore: draft.opensBefore, dueAfter: draft.dueAfter }
    : null;
}

export function draftWindowFields(draft: TaskDraft): {
  completionOpensBeforeMinutes: number;
  completionDueAfterMinutes: number | null;
} {
  return draft.windowOn
    ? {
        completionOpensBeforeMinutes: draft.opensBefore,
        completionDueAfterMinutes: draft.dueAfter,
      }
    : { ...NO_WINDOW };
}

export type MissingStep = "form" | "targets" | "days" | "times";

export type BuilderSection = "form" | "targets" | "when" | "window";

const ALL_SECTIONS: BuilderSection[] = ["form", "targets", "when", "window"];

/** The builder's steps for a form; one that checks nothing specific skips "targets". */
export function builderSections(appliesTo: FormAppliesTo | null): BuilderSection[] {
  return appliesTo === FORM_APPLIES_TO.LOCATION
    ? ALL_SECTIONS.filter((section) => section !== "targets")
    : ALL_SECTIONS;
}

export const SECTION_OF: Record<MissingStep, BuilderSection> = {
  form: "form",
  targets: "targets",
  days: "when",
  times: "when",
};

/** What still blocks saving, in the order the sections appear. */
export function missingSteps(
  draft: TaskDraft,
  appliesTo: FormAppliesTo | null,
  eligibleTargetIds: ReadonlySet<string>,
): MissingStep[] {
  const missing: MissingStep[] = [];
  if (!draft.formId || !appliesTo) missing.push("form");
  if (
    appliesTo &&
    builderSections(appliesTo).includes("targets") &&
    !draft.targets.some((selection) => eligibleTargetIds.has(selection.targetId))
  ) {
    missing.push("targets");
  }
  if (draft.weekdays.length === 0) missing.push("days");
  if (draftTimes(draft).length === 0) missing.push("times");
  return missing;
}
