import { z } from "zod";
import {
  CORRECTIVE_ACTION_MODE,
  FIELD_TYPE,
  formElementIdSchema,
  isCalendarDateString,
  isValidMeasurementValue,
  measurementUnitSchema,
  NO_LIMITS,
  RECORD_RESULT,
  TEXT_ANSWER_MAX_LENGTH,
  type ChoiceField,
  type FormDefinition,
  type FormField,
  type LimitOverrides,
  type MeasurementField,
  type MeasurementLimits,
  type RecordResult,
  type ResolvedLimits,
} from "../schemas/form.js";

/** What a client may send for one field before the form version decides what is valid. */
export const answerInputValueSchema = z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.array(z.string()),
  z.null(),
]);

export const answersInputSchema = z.record(
  formElementIdSchema,
  answerInputValueSchema,
);

export type AnswersInput = z.infer<typeof answersInputSchema>;

export type ParsedAnswer = boolean | number | string | string[] | null;
export type ParsedAnswers = Record<string, ParsedAnswer>;

export const storedCheckboxAnswerSchema = z.object({
  type: z.literal(FIELD_TYPE.CHECKBOX),
  value: z.boolean(),
});

export const storedMeasurementAnswerSchema = z.object({
  type: z.literal(FIELD_TYPE.MEASUREMENT),
  value: z.number().nullable(),
  unit: measurementUnitSchema,
  min: z.number().nullable(),
  max: z.number().nullable(),
  fails: z.boolean(),
});

export const storedChoiceAnswerSchema = z.object({
  type: z.literal(FIELD_TYPE.CHOICE),
  value: z.array(formElementIdSchema),
  fails: z.boolean(),
});

export const storedTextAnswerSchema = z.object({
  type: z.literal(FIELD_TYPE.TEXT),
  value: z.string(),
});

export const storedDateAnswerSchema = z.object({
  type: z.literal(FIELD_TYPE.DATE),
  value: z.string().nullable(),
});

export const storedAnswerSchema = z.discriminatedUnion("type", [
  storedCheckboxAnswerSchema,
  storedMeasurementAnswerSchema,
  storedChoiceAnswerSchema,
  storedTextAnswerSchema,
  storedDateAnswerSchema,
]);

export type StoredAnswer = z.infer<typeof storedAnswerSchema>;
export type StoredMeasurementAnswer = z.infer<
  typeof storedMeasurementAnswerSchema
>;

/** Self-describing answers keyed by field id; measurements carry the unit and limits they were judged against. */
export const recordValuesSchema = z.record(
  formElementIdSchema,
  storedAnswerSchema,
);

export type RecordValues = z.infer<typeof recordValuesSchema>;

export function getMeasurementFields(
  definition: FormDefinition,
): MeasurementField[] {
  return definition.fields.filter(
    (field): field is MeasurementField => field.type === FIELD_TYPE.MEASUREMENT,
  );
}

export function resolveLimits(
  definition: FormDefinition,
  overrides: LimitOverrides | null | undefined,
): ResolvedLimits {
  const resolved: ResolvedLimits = {};

  for (const field of getMeasurementFields(definition)) {
    resolved[field.id] = overrides?.[field.id] ?? field.limits;
  }

  return resolved;
}

function measurementAnswerSchema(field: MeasurementField) {
  const value = z
    .number()
    .refine((n) => isValidMeasurementValue(n, field.unit), {
      error: "Value is outside the unit's range or precision",
    });

  return field.required ? value : value.nullable().default(null);
}

function choiceAnswerSchema(field: ChoiceField) {
  const optionIds = new Set(field.options.map((option) => option.id));
  const optionId = z
    .string()
    .refine((id) => optionIds.has(id), { error: "Unknown option" });

  if (field.multiple) {
    const list = z
      .array(optionId)
      .refine((ids) => new Set(ids).size === ids.length, {
        error: "Options must not repeat",
      });
    return field.required
      ? list.min(1, { error: "Select at least one option" })
      : list.default([]);
  }

  return field.required ? optionId : optionId.nullable().default(null);
}

function textAnswerSchema(field: FormField) {
  const text = z.string().trim().max(TEXT_ANSWER_MAX_LENGTH);
  return field.required ? text.min(1) : text.default("");
}

function dateAnswerSchema(field: FormField) {
  const date = z
    .string()
    .refine(isCalendarDateString, {
      error: "Date must be a real YYYY-MM-DD date",
    });
  return field.required ? date : date.nullable().default(null);
}

function fieldAnswerSchema(field: FormField): z.ZodType<ParsedAnswer> {
  switch (field.type) {
    case FIELD_TYPE.CHECKBOX:
      return field.required
        ? z.literal(true, { error: "Must be ticked" })
        : z.boolean().default(false);
    case FIELD_TYPE.MEASUREMENT:
      return measurementAnswerSchema(field);
    case FIELD_TYPE.CHOICE:
      return choiceAnswerSchema(field);
    case FIELD_TYPE.TEXT:
      return textAnswerSchema(field);
    case FIELD_TYPE.DATE:
      return dateAnswerSchema(field);
  }
}

/** Validity only: an out-of-limits reading is a valid answer that fails, never a rejected one. */
export function buildAnswerSchema(
  definition: FormDefinition,
): z.ZodType<ParsedAnswers> {
  const shape: Record<string, z.ZodType<ParsedAnswer>> = {};

  for (const field of definition.fields) {
    shape[field.id] = fieldAnswerSchema(field);
  }

  return z.strictObject(shape) as unknown as z.ZodType<ParsedAnswers>;
}

export function measurementFails(
  value: number | null,
  limits: MeasurementLimits,
): boolean {
  if (value === null) return false;
  if (limits.min !== null && value < limits.min) return true;
  if (limits.max !== null && value > limits.max) return true;
  return false;
}

function canFail(field: FormField, limits: MeasurementLimits): boolean {
  if (field.type === FIELD_TYPE.MEASUREMENT) {
    return limits.min !== null || limits.max !== null;
  }
  if (field.type === FIELD_TYPE.CHOICE) {
    return field.options.some((option) => option.fails);
  }
  return false;
}

export type EvaluatedAnswers = {
  values: RecordValues;
  result: RecordResult;
  failedFieldIds: string[];
};

export function evaluateAnswers(
  definition: FormDefinition,
  resolvedLimits: ResolvedLimits,
  answers: ParsedAnswers,
): EvaluatedAnswers {
  const values: RecordValues = {};
  const failedFieldIds: string[] = [];
  let evaluable = false;

  for (const field of definition.fields) {
    const answer = answers[field.id] ?? null;
    const limits = resolvedLimits[field.id] ?? NO_LIMITS;

    if (canFail(field, limits)) evaluable = true;

    switch (field.type) {
      case FIELD_TYPE.CHECKBOX:
        values[field.id] = { type: field.type, value: answer === true };
        break;
      case FIELD_TYPE.MEASUREMENT: {
        const value = typeof answer === "number" ? answer : null;
        const fails = measurementFails(value, limits);
        values[field.id] = {
          type: field.type,
          value,
          unit: field.unit,
          min: limits.min,
          max: limits.max,
          fails,
        };
        if (fails) failedFieldIds.push(field.id);
        break;
      }
      case FIELD_TYPE.CHOICE: {
        const selected =
          answer === null
            ? []
            : Array.isArray(answer)
              ? answer
              : [String(answer)];
        const fails = field.options.some(
          (option) => option.fails && selected.includes(option.id),
        );
        values[field.id] = { type: field.type, value: selected, fails };
        if (fails) failedFieldIds.push(field.id);
        break;
      }
      case FIELD_TYPE.TEXT:
        values[field.id] = {
          type: field.type,
          value: typeof answer === "string" ? answer : "",
        };
        break;
      case FIELD_TYPE.DATE:
        values[field.id] = {
          type: field.type,
          value: typeof answer === "string" ? answer : null,
        };
        break;
    }
  }

  const result: RecordResult =
    failedFieldIds.length > 0
      ? RECORD_RESULT.FAIL
      : evaluable
        ? RECORD_RESULT.PASS
        : RECORD_RESULT.NOT_EVALUATED;

  return { values, result, failedFieldIds };
}

export function requiresCorrectiveAction(
  definition: FormDefinition,
  result: RecordResult,
): boolean {
  return (
    result === RECORD_RESULT.FAIL &&
    definition.correctiveAction === CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL
  );
}

/**
 * Override keys a new version can no longer honour: the field is gone, is no longer a
 * measurement, or changed unit (a limit in the old unit means nothing in the new one).
 */
export function findUnusableOverrideFieldIds(
  previous: FormDefinition,
  next: FormDefinition,
  overrides: LimitOverrides,
): string[] {
  const previousUnits = new Map(
    getMeasurementFields(previous).map((field) => [field.id, field.unit]),
  );
  const nextUnits = new Map(
    getMeasurementFields(next).map((field) => [field.id, field.unit]),
  );

  return Object.keys(overrides).filter((fieldId) => {
    const nextUnit = nextUnits.get(fieldId);
    if (nextUnit === undefined) return true;
    const previousUnit = previousUnits.get(fieldId);
    return previousUnit !== undefined && previousUnit !== nextUnit;
  });
}
