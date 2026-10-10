import {
  CHOICE_MAX_OPTIONS,
  CHOICE_MIN_OPTIONS,
  CORRECTIVE_ACTION_MODE,
  FIELD_TYPE,
  FORM_MAX_FIELDS,
  isValidMeasurementValue,
  type CorrectiveActionMode,
  type FieldType,
  type FormCategory,
  type FormDefinition,
  type FormField,
  type MeasurementField,
  type MeasurementUnit,
} from "@haccp/shared";
import { formatMeasurementDraft, parseMeasurementDraft } from "./measurement";

/** Limits stay as typed text until save, so "-" or "4," can sit in the input mid-edit. */
export type LimitsDraft = { min: string; max: string };

export type BuilderMeasurementField = Omit<MeasurementField, "limits"> & {
  limits: LimitsDraft;
};

export type BuilderField =
  Exclude<FormField, MeasurementField> | BuilderMeasurementField;

export type BuilderState = {
  name: string;
  category: FormCategory | "";
  correctiveAction: CorrectiveActionMode;
  fields: BuilderField[];
};

export type FieldIssues = {
  label?: true;
  /** Indexes of options with an empty label. */
  optionLabels?: number[];
  options?: "too_few";
  limits?: "min" | "max" | "order";
};

export type BuilderIssues = {
  name?: true;
  category?: true;
  fields?: "empty";
  byField: Record<string, FieldIssues>;
};

const ELEMENT_ID_RANDOM_LENGTH = 8;

function randomSuffix(): string {
  return crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, ELEMENT_ID_RANDOM_LENGTH);
}

/** Ids are minted once and never derived from labels, so renaming a field keeps its answers and overrides. */
export function mintElementId(
  prefix: "f" | "o",
  taken: ReadonlySet<string>,
): string {
  let id = `${prefix}_${randomSuffix()}`;
  while (taken.has(id)) id = `${prefix}_${randomSuffix()}`;
  return id;
}

function limitsToDraft(
  field: MeasurementField,
  separator: string,
): LimitsDraft {
  const format = (value: number | null) =>
    value === null ? "" : formatMeasurementDraft(value, separator, field.unit);
  return { min: format(field.limits.min), max: format(field.limits.max) };
}

export function emptyBuilderState(): BuilderState {
  return {
    name: "",
    category: "",
    correctiveAction: CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
    fields: [],
  };
}

export function toBuilderState(
  source: { name: string; category: FormCategory; definition: FormDefinition },
  separator: string,
): BuilderState {
  return {
    name: source.name,
    category: source.category,
    correctiveAction: source.definition.correctiveAction,
    fields: source.definition.fields.map((field) =>
      field.type === FIELD_TYPE.MEASUREMENT
        ? { ...field, limits: limitsToDraft(field, separator) }
        : field,
    ),
  };
}

export function createBuilderField(
  type: FieldType,
  taken: ReadonlySet<string>,
  defaults: { optionLabels: [string, string] },
): BuilderField {
  const base = { id: mintElementId("f", taken), label: "", required: true };

  switch (type) {
    case FIELD_TYPE.CHECKBOX:
      return { ...base, type };
    case FIELD_TYPE.MEASUREMENT:
      return {
        ...base,
        type,
        unit: "celsius",
        limits: { min: "", max: "" },
      };
    case FIELD_TYPE.CHOICE: {
      const first = mintElementId("o", new Set());
      return {
        ...base,
        type,
        multiple: false,
        options: [
          { id: first, label: defaults.optionLabels[0], fails: false },
          {
            id: mintElementId("o", new Set([first])),
            label: defaults.optionLabels[1],
            fails: true,
          },
        ],
      };
    }
    case FIELD_TYPE.TEXT:
      return { ...base, type, required: false, multiline: false };
    case FIELD_TYPE.DATE:
      return { ...base, type, required: false };
  }
}

export function moveField(
  fields: readonly BuilderField[],
  index: number,
  delta: -1 | 1,
): BuilderField[] {
  const target = index + delta;
  if (target < 0 || target >= fields.length) return [...fields];

  const next = [...fields];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved!);
  return next;
}

function parseLimit(raw: string): number | null | "invalid" {
  if (raw.trim() === "") return null;
  return parseMeasurementDraft(raw) ?? "invalid";
}

function limitsIssue(
  limits: LimitsDraft,
  unit: MeasurementUnit,
): FieldIssues["limits"] {
  const min = parseLimit(limits.min);
  const max = parseLimit(limits.max);

  if (
    min === "invalid" ||
    (min !== null && !isValidMeasurementValue(min, unit))
  ) {
    return "min";
  }
  if (
    max === "invalid" ||
    (max !== null && !isValidMeasurementValue(max, unit))
  ) {
    return "max";
  }
  if (min !== null && max !== null && min >= max) return "order";
  return undefined;
}

function fieldIssues(field: BuilderField): FieldIssues {
  const issues: FieldIssues = {};

  if (field.label.trim() === "") issues.label = true;

  if (field.type === FIELD_TYPE.MEASUREMENT) {
    const limits = limitsIssue(field.limits, field.unit);
    if (limits) issues.limits = limits;
  }

  if (field.type === FIELD_TYPE.CHOICE) {
    if (field.options.length < CHOICE_MIN_OPTIONS) issues.options = "too_few";
    const blank = field.options.flatMap((option, index) =>
      option.label.trim() === "" ? [index] : [],
    );
    if (blank.length > 0) issues.optionLabels = blank;
  }

  return issues;
}

/** Mirrors formDefinitionSchema so the builder can point at the field to fix instead of failing on save. */
export function validateBuilder(state: BuilderState): BuilderIssues {
  const issues: BuilderIssues = { byField: {} };

  if (state.name.trim() === "") issues.name = true;
  if (state.category === "") issues.category = true;
  if (state.fields.length === 0) issues.fields = "empty";

  for (const field of state.fields) {
    const found = fieldIssues(field);
    if (Object.keys(found).length > 0) issues.byField[field.id] = found;
  }

  return issues;
}

export function hasBuilderIssues(issues: BuilderIssues): boolean {
  return (
    Boolean(issues.name || issues.category || issues.fields) ||
    Object.keys(issues.byField).length > 0
  );
}

function withLabelAndHelp<T extends BuilderField>(field: T): T {
  const next = { ...field, label: field.label.trim() };
  const help = field.help?.trim();
  if (help) next.help = help;
  else delete next.help;
  return next;
}

/** Only call on a state that passed validateBuilder. */
export function toDefinition(state: BuilderState): FormDefinition {
  return {
    correctiveAction: state.correctiveAction,
    fields: state.fields.map((field): FormField => {
      const tidy = withLabelAndHelp(field);

      if (tidy.type === FIELD_TYPE.MEASUREMENT) {
        const min = parseLimit(tidy.limits.min);
        const max = parseLimit(tidy.limits.max);
        return {
          ...tidy,
          limits: {
            min: min === "invalid" ? null : min,
            max: max === "invalid" ? null : max,
          },
        };
      }

      if (tidy.type === FIELD_TYPE.CHOICE) {
        return {
          ...tidy,
          options: tidy.options.map((option) => ({
            ...option,
            label: option.label.trim(),
          })),
        };
      }

      return tidy;
    }),
  };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

/** Same rule as the API's: an unchanged definition publishes no new version. */
export function sameDefinition(a: FormDefinition, b: FormDefinition): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export const BUILDER_LIMITS = {
  maxFields: FORM_MAX_FIELDS,
  maxOptions: CHOICE_MAX_OPTIONS,
  minOptions: CHOICE_MIN_OPTIONS,
} as const;
