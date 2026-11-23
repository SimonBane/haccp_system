import {
  FIELD_TYPE,
  type AnswersInput,
  type FormDefinition,
  type FormField,
} from "@haccp/shared";
import {
  createAnswerDraft,
  draftToAnswers,
  evaluateAnswerDraft,
  validateAnswerDraft,
  type DraftIssue,
  type FieldDraft,
} from "@/features/forms/lib/answer-draft";
import type { TodayCheck } from "./today-day";

/** More buttons than this no longer fit beside the item's name on a phone, so a single choice becomes a select. */
export const INLINE_MAX_BUTTONS = 3;

/** The id a lone checkbox answers with, since it has no options of its own. */
export const TICK_OPTION_ID = "tick";

export type InlineOption = { id: string; label: string; fails: boolean };

/** What the user has changed on a row and not saved yet. */
export type InlineDraft = {
  value: FieldDraft;
  answerIds: string[];
  note: string;
};

/** Keyed by check, so switching to another task and back keeps what was typed. */
export type InlineDrafts = Record<string, InlineDraft>;

export type InlineRow = {
  check: TodayCheck;
  /** The draft when there is one, else what is saved. */
  value: FieldDraft;
  answerIds: string[];
  note: string;
  hasDraft: boolean;
  isEmpty: boolean;
  /** Changed, complete and valid: Done would save it. */
  isReady: boolean;
  /** Changed but not something the server would take, such as "4," mid-typing. */
  issue: DraftIssue | null;
  fails: boolean;
};

/** A form with one control is answered on each item's row, without opening it. */
export function inlineField(definition: FormDefinition): FormField | null {
  return definition.fields.length === 1 ? (definition.fields[0] ?? null) : null;
}

/** Ticks and short choices answer with buttons; null when the row needs an input or a select. */
export function inlineOptions(field: FormField): InlineOption[] | null {
  if (field.type === FIELD_TYPE.CHECKBOX) {
    return [{ id: TICK_OPTION_ID, label: field.label, fails: false }];
  }
  if (
    field.type === FIELD_TYPE.CHOICE &&
    (field.multiple || field.options.length <= INLINE_MAX_BUTTONS)
  ) {
    return field.options;
  }
  return null;
}

/** What "Complete all" fills in; null when there is no obvious passing answer. */
export function passingDraft(field: FormField): FieldDraft | null {
  if (field.type === FIELD_TYPE.CHECKBOX) {
    return { type: FIELD_TYPE.CHECKBOX, value: true };
  }
  if (field.type === FIELD_TYPE.CHOICE && !field.multiple) {
    const pass = field.options.find((option) => !option.fails);
    return pass ? { type: FIELD_TYPE.CHOICE, value: [pass.id] } : null;
  }
  return null;
}

export function isOptionSelected(value: FieldDraft, optionId: string): boolean {
  if (value.type === FIELD_TYPE.CHECKBOX) {
    return optionId === TICK_OPTION_ID && value.value;
  }
  return value.type === FIELD_TYPE.CHOICE && value.value.includes(optionId);
}

/** A second tap on the chosen option takes it back. */
export function toggleOption(
  field: FormField,
  value: FieldDraft,
  optionId: string,
): FieldDraft {
  if (field.type === FIELD_TYPE.CHECKBOX) {
    return {
      type: FIELD_TYPE.CHECKBOX,
      value: value.type === FIELD_TYPE.CHECKBOX ? !value.value : true,
    };
  }
  const selected = value.type === FIELD_TYPE.CHOICE ? value.value : [];
  if (selected.includes(optionId)) {
    return {
      type: FIELD_TYPE.CHOICE,
      value: selected.filter((id) => id !== optionId),
    };
  }
  return {
    type: FIELD_TYPE.CHOICE,
    value:
      field.type === FIELD_TYPE.CHOICE && field.multiple
        ? [...selected, optionId]
        : [optionId],
  };
}

export function isEmptyDraft(value: FieldDraft): boolean {
  switch (value.type) {
    case FIELD_TYPE.CHECKBOX:
      return !value.value;
    case FIELD_TYPE.MEASUREMENT:
      return value.digits === "";
    case FIELD_TYPE.CHOICE:
      return value.value.length === 0;
    default:
      return value.value.trim() === "";
  }
}

export function savedDraft(
  definition: FormDefinition,
  field: FormField,
  check: TodayCheck,
  separator: string,
): FieldDraft {
  const saved = createAnswerDraft(
    definition,
    check.task.resolvedLimits,
    check.task.values,
    separator,
  )[field.id];
  if (!saved) throw new Error(`No draft for field ${field.id}`);
  return saved;
}

export function inlineAnswers(
  definition: FormDefinition,
  field: FormField,
  value: FieldDraft,
): AnswersInput {
  return draftToAnswers(definition, { [field.id]: value });
}

export function sameAnswer(
  definition: FormDefinition,
  field: FormField,
  a: FieldDraft,
  b: FieldDraft,
): boolean {
  // "-" or "4," sends the same null as an empty field, but is not the same as one.
  return (
    isEmptyDraft(a) === isEmptyDraft(b) &&
    JSON.stringify(inlineAnswers(definition, field, a)) ===
      JSON.stringify(inlineAnswers(definition, field, b))
  );
}

export function inlineRows(
  definition: FormDefinition,
  field: FormField,
  checks: readonly TodayCheck[],
  drafts: InlineDrafts,
  separator: string,
): InlineRow[] {
  return checks.map((check) => {
    const own = drafts[check.key];
    const saved = savedDraft(definition, field, check, separator);
    const value = own?.value ?? saved;
    const isEmpty = isEmptyDraft(value);
    const issue = isEmpty
      ? null
      : (validateAnswerDraft(definition, { [field.id]: value })[field.id] ??
        null);
    const isChanged =
      own !== undefined && !sameAnswer(definition, field, own.value, saved);
    const fails =
      !isEmpty &&
      issue === null &&
      evaluateAnswerDraft(definition, check.task.resolvedLimits, {
        [field.id]: value,
      }).failedFieldIds.includes(field.id);

    return {
      check,
      value,
      answerIds: own?.answerIds ?? [],
      note: own?.note ?? "",
      hasDraft: own !== undefined,
      isEmpty,
      isReady: isChanged && !isEmpty && issue === null,
      issue: isChanged ? issue : null,
      fails,
    };
  });
}

/** Store a row's new value, dropping the draft once it is back to what is saved. */
export function withValue(
  drafts: InlineDrafts,
  key: string,
  next: FieldDraft,
  sameAsSaved: boolean,
): InlineDrafts {
  const { [key]: own, ...rest } = drafts;
  // An emptied tap row shows what is saved again; an emptied input stays empty so it can be retyped.
  const isTap =
    next.type === FIELD_TYPE.CHECKBOX || next.type === FIELD_TYPE.CHOICE;
  if (sameAsSaved || (isTap && isEmptyDraft(next))) return rest;
  return {
    ...rest,
    [key]: {
      value: next,
      answerIds: own?.answerIds ?? [],
      note: own?.note ?? "",
    },
  };
}
