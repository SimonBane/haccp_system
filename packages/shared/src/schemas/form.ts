import { z } from "zod";
import { addCalendarDays, isCalendarDate } from "../lib/calendar-date.js";

export const MEASUREMENT_UNITS = {
  celsius: { decimals: 1, min: -99.9, max: 99.9 },
  ph: { decimals: 2, min: 0, max: 14 },
  percent: { decimals: 1, min: 0, max: 100 },
  ppm: { decimals: 0, min: 0, max: 1_000_000 },
  water_activity: { decimals: 3, min: 0, max: 1 },
  grams: { decimals: 0, min: 0, max: 1_000_000 },
  kilograms: { decimals: 2, min: 0, max: 100_000 },
  minutes: { decimals: 0, min: 0, max: 10_080 },
} as const;

export const MEASUREMENT_UNIT_VALUES = [
  "celsius",
  "ph",
  "percent",
  "ppm",
  "water_activity",
  "grams",
  "kilograms",
  "minutes",
] as const;

export const measurementUnitSchema = z.enum(MEASUREMENT_UNIT_VALUES);

export type MeasurementUnit = z.infer<typeof measurementUnitSchema>;

export const FORM_CATEGORY = {
  TEMPERATURE: "temperature",
  CLEANING: "cleaning",
  GOODS_IN: "goods_in",
  COOKING: "cooking",
  COOLING: "cooling",
  HYGIENE: "hygiene",
  PEST_CONTROL: "pest_control",
  OTHER: "other",
} as const;

export const FORM_CATEGORY_VALUES = [
  FORM_CATEGORY.TEMPERATURE,
  FORM_CATEGORY.CLEANING,
  FORM_CATEGORY.GOODS_IN,
  FORM_CATEGORY.COOKING,
  FORM_CATEGORY.COOLING,
  FORM_CATEGORY.HYGIENE,
  FORM_CATEGORY.PEST_CONTROL,
  FORM_CATEGORY.OTHER,
] as const;

export const formCategorySchema = z.enum(FORM_CATEGORY_VALUES);

export type FormCategory = z.infer<typeof formCategorySchema>;

export const FIELD_TYPE = {
  CHECKBOX: "checkbox",
  MEASUREMENT: "measurement",
  CHOICE: "choice",
  TEXT: "text",
  DATE: "date",
} as const;

export const fieldTypeSchema = z.enum([
  FIELD_TYPE.CHECKBOX,
  FIELD_TYPE.MEASUREMENT,
  FIELD_TYPE.CHOICE,
  FIELD_TYPE.TEXT,
  FIELD_TYPE.DATE,
]);

export type FieldType = z.infer<typeof fieldTypeSchema>;

export const CORRECTIVE_ACTION_MODE = {
  REQUIRED_ON_FAIL: "required_on_fail",
  OPTIONAL: "optional",
} as const;

export const correctiveActionModeSchema = z.enum([
  CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
  CORRECTIVE_ACTION_MODE.OPTIONAL,
]);

export type CorrectiveActionMode = z.infer<typeof correctiveActionModeSchema>;

export const RECORD_RESULT = {
  PASS: "pass",
  FAIL: "fail",
  NOT_EVALUATED: "not_evaluated",
} as const;

export const recordResultSchema = z.enum([
  RECORD_RESULT.PASS,
  RECORD_RESULT.FAIL,
  RECORD_RESULT.NOT_EVALUATED,
]);

export type RecordResult = z.infer<typeof recordResultSchema>;

export const FORM_MAX_FIELDS = 50;
export const CHOICE_MIN_OPTIONS = 2;
export const CHOICE_MAX_OPTIONS = 30;
export const TEXT_ANSWER_MAX_LENGTH = 2000;
export const CORRECTIVE_ACTION_MAX_LENGTH = 1000;

/** Builders mint these once and keep them across versions; answers and overrides are keyed by them. */
export const formElementIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, {
  error: "Ids may contain letters, digits, _ and - (at most 40)",
});

const fieldLabelSchema = z.string().trim().min(1).max(200);

export const measurementLimitsSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
});

export type MeasurementLimits = z.infer<typeof measurementLimitsSchema>;

export const NO_LIMITS: MeasurementLimits = { min: null, max: null };

/** Field ids map to that target's limits, replacing the form field's defaults whole. */
export const limitOverridesSchema = z.record(
  formElementIdSchema,
  measurementLimitsSchema,
);

export type LimitOverrides = z.infer<typeof limitOverridesSchema>;

/** One entry per measurement field: the limits an occurrence was created with. */
export const resolvedLimitsSchema = z.record(
  formElementIdSchema,
  measurementLimitsSchema,
);

export type ResolvedLimits = z.infer<typeof resolvedLimitsSchema>;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

export function isValidMeasurementValue(
  value: number,
  unit: MeasurementUnit,
): boolean {
  const spec = MEASUREMENT_UNITS[unit];
  return (
    Number.isFinite(value) &&
    value >= spec.min &&
    value <= spec.max &&
    hasAtMostDecimals(value, spec.decimals)
  );
}

export type LimitsIssue = "min_out_of_range" | "max_out_of_range" | "order";

export function checkMeasurementLimits(
  limits: MeasurementLimits,
  unit: MeasurementUnit,
): LimitsIssue[] {
  const issues: LimitsIssue[] = [];

  if (limits.min !== null && !isValidMeasurementValue(limits.min, unit)) {
    issues.push("min_out_of_range");
  }
  if (limits.max !== null && !isValidMeasurementValue(limits.max, unit)) {
    issues.push("max_out_of_range");
  }
  if (limits.min !== null && limits.max !== null && limits.min >= limits.max) {
    issues.push("order");
  }

  return issues;
}

const LIMITS_ISSUE_MESSAGE: Record<LimitsIssue, string> = {
  min_out_of_range: "Minimum is outside the unit's range or precision",
  max_out_of_range: "Maximum is outside the unit's range or precision",
  order: "Minimum must be less than maximum",
};

export function limitsIssueMessage(issue: LimitsIssue): string {
  return LIMITS_ISSUE_MESSAGE[issue];
}

const fieldBaseShape = {
  id: formElementIdSchema,
  label: fieldLabelSchema,
  help: z.string().trim().max(500).optional(),
  required: z.boolean(),
};

export const checkboxFieldSchema = z.object({
  ...fieldBaseShape,
  type: z.literal(FIELD_TYPE.CHECKBOX),
});

export const measurementFieldSchema = z.object({
  ...fieldBaseShape,
  type: z.literal(FIELD_TYPE.MEASUREMENT),
  unit: measurementUnitSchema,
  limits: measurementLimitsSchema,
});

export const choiceOptionSchema = z.object({
  id: formElementIdSchema,
  label: fieldLabelSchema,
  fails: z.boolean(),
});

export const choiceFieldSchema = z.object({
  ...fieldBaseShape,
  type: z.literal(FIELD_TYPE.CHOICE),
  multiple: z.boolean(),
  options: z
    .array(choiceOptionSchema)
    .min(CHOICE_MIN_OPTIONS, {
      error: `A choice needs at least ${CHOICE_MIN_OPTIONS} options`,
    })
    .max(CHOICE_MAX_OPTIONS),
});

export const textFieldSchema = z.object({
  ...fieldBaseShape,
  type: z.literal(FIELD_TYPE.TEXT),
  multiline: z.boolean(),
});

export const dateFieldSchema = z.object({
  ...fieldBaseShape,
  type: z.literal(FIELD_TYPE.DATE),
});

export const formFieldSchema = z.discriminatedUnion("type", [
  checkboxFieldSchema,
  measurementFieldSchema,
  choiceFieldSchema,
  textFieldSchema,
  dateFieldSchema,
]);

export type FormField = z.infer<typeof formFieldSchema>;
export type CheckboxField = z.infer<typeof checkboxFieldSchema>;
export type MeasurementField = z.infer<typeof measurementFieldSchema>;
export type ChoiceField = z.infer<typeof choiceFieldSchema>;
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;
export type TextField = z.infer<typeof textFieldSchema>;
export type DateField = z.infer<typeof dateFieldSchema>;

export const formDefinitionSchema = z
  .object({
    fields: z.array(formFieldSchema).max(FORM_MAX_FIELDS),
    correctiveAction: correctiveActionModeSchema,
  })
  .superRefine((definition, ctx) => {
    const seenFieldIds = new Set<string>();

    definition.fields.forEach((field, index) => {
      if (seenFieldIds.has(field.id)) {
        ctx.addIssue({
          code: "custom",
          message: "Field ids must be unique",
          path: ["fields", index, "id"],
        });
      }
      seenFieldIds.add(field.id);

      if (field.type === FIELD_TYPE.MEASUREMENT) {
        for (const issue of checkMeasurementLimits(field.limits, field.unit)) {
          ctx.addIssue({
            code: "custom",
            message: limitsIssueMessage(issue),
            path: [
              "fields",
              index,
              "limits",
              issue === "max_out_of_range" ? "max" : "min",
            ],
          });
        }
      }

      if (field.type === FIELD_TYPE.CHOICE) {
        const seenOptionIds = new Set<string>();
        field.options.forEach((option, optionIndex) => {
          if (seenOptionIds.has(option.id)) {
            ctx.addIssue({
              code: "custom",
              message: "Option ids must be unique within a field",
              path: ["fields", index, "options", optionIndex, "id"],
            });
          }
          seenOptionIds.add(option.id);
        });
      }
    });
  });

export type FormDefinition = z.infer<typeof formDefinitionSchema>;

export function isCalendarDateString(value: string): boolean {
  return isCalendarDate(value) && addCalendarDays(value, 0) === value;
}

const formNameSchema = z.string().trim().min(1).max(200);

export const createFormSchema = z.object({
  name: formNameSchema,
  category: formCategorySchema,
  definition: formDefinitionSchema,
});

export type CreateFormInput = z.infer<typeof createFormSchema>;

export const updateFormSchema = z.object({
  name: formNameSchema,
  category: formCategorySchema,
});

export type UpdateFormInput = z.infer<typeof updateFormSchema>;

export const createFormVersionSchema = z.object({
  definition: formDefinitionSchema,
  /** Without it, a version that would drop template overrides is refused with their list. */
  confirmDroppedOverrides: z.boolean().default(false),
});

export type CreateFormVersionInput = z.infer<typeof createFormVersionSchema>;

export const formIdParamSchema = z.object({
  formId: z.uuid(),
});

export const formVersionResponseSchema = z.object({
  id: z.uuid(),
  formId: z.uuid(),
  version: z.int().positive(),
  definition: formDefinitionSchema,
  createdAt: z.iso.datetime(),
});

export type FormVersionResponse = z.infer<typeof formVersionResponseSchema>;

export const formResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  category: formCategorySchema,
  latestVersion: formVersionResponseSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type FormResponse = z.infer<typeof formResponseSchema>;

export const formListResponseSchema = z.object({
  items: z.array(formResponseSchema),
});

export type FormListResponse = z.infer<typeof formListResponseSchema>;

/** What a Today or Records page needs to render answers recorded against one version. */
export const formVersionSummarySchema = z.object({
  id: z.uuid(),
  formId: z.uuid(),
  formName: z.string(),
  category: formCategorySchema,
  version: z.int().positive(),
  definition: formDefinitionSchema,
});

export type FormVersionSummary = z.infer<typeof formVersionSummarySchema>;

export const formVersionSummaryMapSchema = z.record(
  z.uuid(),
  formVersionSummarySchema,
);

export type FormVersionSummaryMap = z.infer<typeof formVersionSummaryMapSchema>;

export const droppedOverrideSchema = z.object({
  templateId: z.uuid(),
  templateTitle: z.string(),
  locationId: z.uuid(),
  locationName: z.string(),
  targetId: z.uuid(),
  targetName: z.string(),
  fieldId: formElementIdSchema,
  fieldLabel: z.string(),
  limits: measurementLimitsSchema,
});

export type DroppedOverride = z.infer<typeof droppedOverrideSchema>;

export const droppedOverridesDetailsSchema = z.object({
  droppedOverrides: z.array(droppedOverrideSchema),
});

export type DroppedOverridesDetails = z.infer<
  typeof droppedOverridesDetailsSchema
>;
