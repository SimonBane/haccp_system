import {
  evaluateAnswers,
  FIELD_TYPE,
  isCalendarDateString,
  isValidMeasurementValue,
  TEXT_ANSWER_MAX_LENGTH,
  type AnswersInput,
  type EvaluatedAnswers,
  type FormDefinition,
  type MeasurementField,
  type RecordValues,
  type ResolvedLimits,
} from "@haccp/shared";
import {
  composeSignedDraft,
  formatMeasurementDraft,
  inferMeasurementSign,
  parseMeasurementDraft,
  type MeasurementSign,
} from "./measurement";

export type MeasurementDraft = { sign: MeasurementSign; digits: string };

/** Typed by field so inputs can narrow; measurements keep the sign apart because an empty field has no minus to read back. */
export type FieldDraft =
  | { type: typeof FIELD_TYPE.CHECKBOX; value: boolean }
  | ({ type: typeof FIELD_TYPE.MEASUREMENT } & MeasurementDraft)
  | { type: typeof FIELD_TYPE.CHOICE; value: string[] }
  | { type: typeof FIELD_TYPE.TEXT; value: string }
  | { type: typeof FIELD_TYPE.DATE; value: string };

export type AnswerDraft = Record<string, FieldDraft>;

export type DraftIssue = "required" | "invalid";

export function createAnswerDraft(
  definition: FormDefinition,
  limits: ResolvedLimits,
  values: RecordValues | null,
  separator: string,
): AnswerDraft {
  const draft: AnswerDraft = {};

  for (const field of definition.fields) {
    const stored = values?.[field.id];
    const answer = stored?.type === field.type ? stored : null;

    switch (field.type) {
      case FIELD_TYPE.CHECKBOX:
        draft[field.id] = {
          type: field.type,
          value: answer?.type === FIELD_TYPE.CHECKBOX ? answer.value : false,
        };
        break;
      case FIELD_TYPE.MEASUREMENT: {
        const value =
          answer?.type === FIELD_TYPE.MEASUREMENT ? answer.value : null;
        draft[field.id] =
          value === null
            ? {
                type: field.type,
                sign: inferMeasurementSign(
                  limits[field.id] ?? field.limits,
                  field.unit,
                ),
                digits: "",
              }
            : {
                type: field.type,
                sign: value < 0 ? -1 : 1,
                digits: formatMeasurementDraft(
                  Math.abs(value),
                  separator,
                  field.unit,
                ),
              };
        break;
      }
      case FIELD_TYPE.CHOICE:
        draft[field.id] = {
          type: field.type,
          value: answer?.type === FIELD_TYPE.CHOICE ? answer.value : [],
        };
        break;
      case FIELD_TYPE.TEXT:
        draft[field.id] = {
          type: field.type,
          value: answer?.type === FIELD_TYPE.TEXT ? answer.value : "",
        };
        break;
      case FIELD_TYPE.DATE:
        draft[field.id] = {
          type: field.type,
          value: answer?.type === FIELD_TYPE.DATE ? (answer.value ?? "") : "",
        };
        break;
    }
  }

  return draft;
}

export function measurementDraftValue(draft: MeasurementDraft): number | null {
  return parseMeasurementDraft(composeSignedDraft(draft.sign, draft.digits));
}

/** What the API takes; an unfinished measurement goes as null so the server, not the client, rejects it. */
export function draftToAnswers(
  definition: FormDefinition,
  draft: AnswerDraft,
): AnswersInput {
  const answers: AnswersInput = {};

  for (const field of definition.fields) {
    const entry = draft[field.id];

    switch (field.type) {
      case FIELD_TYPE.CHECKBOX:
        answers[field.id] =
          entry?.type === FIELD_TYPE.CHECKBOX ? entry.value : false;
        break;
      case FIELD_TYPE.MEASUREMENT:
        answers[field.id] =
          entry?.type === FIELD_TYPE.MEASUREMENT
            ? measurementDraftValue(entry)
            : null;
        break;
      case FIELD_TYPE.CHOICE: {
        const selected = entry?.type === FIELD_TYPE.CHOICE ? entry.value : [];
        answers[field.id] = field.multiple ? selected : (selected[0] ?? null);
        break;
      }
      case FIELD_TYPE.TEXT:
        answers[field.id] = entry?.type === FIELD_TYPE.TEXT ? entry.value : "";
        break;
      case FIELD_TYPE.DATE: {
        const value = entry?.type === FIELD_TYPE.DATE ? entry.value : "";
        answers[field.id] = value === "" ? null : value;
        break;
      }
    }
  }

  return answers;
}

function measurementIssue(
  field: MeasurementField,
  entry: FieldDraft | undefined,
): DraftIssue | null {
  if (entry?.type !== FIELD_TYPE.MEASUREMENT || entry.digits === "") {
    return field.required ? "required" : null;
  }

  const value = measurementDraftValue(entry);
  return value === null || !isValidMeasurementValue(value, field.unit)
    ? "invalid"
    : null;
}

/** Mirrors the server's answer schema so a submit it would reject is caught at the field. */
export function validateAnswerDraft(
  definition: FormDefinition,
  draft: AnswerDraft,
): Record<string, DraftIssue> {
  const issues: Record<string, DraftIssue> = {};

  for (const field of definition.fields) {
    const entry = draft[field.id];
    let issue: DraftIssue | null = null;

    switch (field.type) {
      case FIELD_TYPE.CHECKBOX:
        if (field.required && !(entry?.type === field.type && entry.value)) {
          issue = "required";
        }
        break;
      case FIELD_TYPE.MEASUREMENT:
        issue = measurementIssue(field, entry);
        break;
      case FIELD_TYPE.CHOICE:
        if (
          field.required &&
          !(entry?.type === field.type && entry.value.length > 0)
        ) {
          issue = "required";
        }
        break;
      case FIELD_TYPE.TEXT: {
        const value = entry?.type === field.type ? entry.value : "";
        if (field.required && value.trim() === "") issue = "required";
        else if (value.trim().length > TEXT_ANSWER_MAX_LENGTH)
          issue = "invalid";
        break;
      }
      case FIELD_TYPE.DATE: {
        const value = entry?.type === field.type ? entry.value : "";
        if (value === "") {
          if (field.required) issue = "required";
        } else if (!isCalendarDateString(value)) {
          issue = "invalid";
        }
        break;
      }
    }

    if (issue) issues[field.id] = issue;
  }

  return issues;
}

/** The verdict the server will reach, so the flow can ask for a corrective action before saving. */
export function evaluateAnswerDraft(
  definition: FormDefinition,
  limits: ResolvedLimits,
  draft: AnswerDraft,
): EvaluatedAnswers {
  return evaluateAnswers(definition, limits, draftToAnswers(definition, draft));
}

/** A lone required checkbox is answered by the tap itself, as cleaning ticks always were. */
export function isQuickCompleteForm(definition: FormDefinition): boolean {
  const [only] = definition.fields;
  return (
    definition.fields.length === 1 &&
    only?.type === FIELD_TYPE.CHECKBOX &&
    only.required
  );
}

export function quickCompleteAnswers(definition: FormDefinition): AnswersInput {
  return Object.fromEntries(definition.fields.map((field) => [field.id, true]));
}

/** A form that is just one measurement gets the large readout and gauge. */
export function featuredMeasurementField(
  definition: FormDefinition,
): MeasurementField | null {
  const [only] = definition.fields;
  return definition.fields.length === 1 && only?.type === FIELD_TYPE.MEASUREMENT
    ? only
    : null;
}

export function limitsFor(
  field: MeasurementField,
  limits: ResolvedLimits,
): ResolvedLimits[string] {
  return limits[field.id] ?? field.limits;
}
