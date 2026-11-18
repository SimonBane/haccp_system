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
import { detectRepeatInterval, generateRepeatTimes } from "./schedule";

export type TimeMode = "times" | "repeat";

export type TaskDraft = {
  formId: string | null;
  title: string;
  /** Once the admin types a name, picking another form no longer replaces it. */
  titleTouched: boolean;
  targets: TargetSelection[];
  weekdays: TaskTemplateWeekday[];
  timeMode: TimeMode;
  times: string[];
  repeat: { every: number; from: string; until: string };
  windowOn: boolean;
  opensBefore: number;
  dueAfter: number | null;
};

export const DEFAULT_REPEAT = { every: 120, from: "08:00", until: "22:00" } as const;

export function emptyDraft(): TaskDraft {
  return {
    formId: null,
    title: "",
    titleTouched: false,
    targets: [],
    weekdays: [...TASK_TEMPLATE_ALL_WEEKDAYS],
    timeMode: "times",
    times: [],
    repeat: { ...DEFAULT_REPEAT },
    windowOn: false,
    opensBefore: DEFAULT_WINDOW.opensBefore,
    dueAfter: DEFAULT_WINDOW.dueAfter,
  };
}

/** Loads a saved task (or the source of a duplicate); evenly spaced times reopen as "Repeat every". */
export function draftFromTask(
  task: TaskTemplateResponse,
  separator: string,
  title = task.title,
): TaskDraft {
  const times = sortScheduledTimes([...task.scheduledTimes]);
  const every = detectRepeatInterval(times);
  const window = windowOf(task);

  return {
    formId: task.formId,
    title,
    titleTouched: true,
    targets: buildDefaultTargets(task, null, separator),
    weekdays: sortWeekdays(task.weekdays),
    timeMode: every ? "repeat" : "times",
    times,
    repeat: every
      ? { every, from: times[0]!, until: times.at(-1)! }
      : { ...DEFAULT_REPEAT },
    windowOn: window !== null,
    opensBefore: window?.opensBefore ?? DEFAULT_WINDOW.opensBefore,
    dueAfter: window ? window.dueAfter : DEFAULT_WINDOW.dueAfter,
  };
}

export function draftTimes(draft: TaskDraft): string[] {
  return draft.timeMode === "repeat"
    ? generateRepeatTimes(draft.repeat.every, draft.repeat.from, draft.repeat.until)
    : sortScheduledTimes([...draft.times]);
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

export type MissingStep = "form" | "title" | "targets" | "days" | "times";

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
  title: "form",
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
  if (!draft.title.trim()) missing.push("title");
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
