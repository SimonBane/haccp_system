import {
  CHOICE_MAX_OPTIONS,
  CHOICE_MIN_OPTIONS,
  CORRECTIVE_ACTION_MODE,
  CORRECTIVE_MAX_ANSWERS,
  DEFAULT_MEASUREMENT_PARAMETER,
  correctiveSettings,
  FIELD_TYPE,
  FORM_MAX_FIELDS,
  isValidMeasurementValue,
  parameterUnit,
  type CorrectiveActionMode,
  type CorrectiveSettings,
  type FieldType,
  type FormAppliesTo,
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
  appliesTo: FormAppliesTo | "";
  /** Staff can log it from Today whenever it happens. */
  onDemand: boolean;
  correctiveAction: CorrectiveActionMode;
  /** Answer labels stay as typed until save, so one can be blank mid-edit. */
  corrective: CorrectiveSettings;
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
  appliesTo?: true;
  fields?: "empty";
  /** Indexes of corrective answers with an empty label. */
  correctiveLabels?: number[];
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
  prefix: "f" | "o" | "a",
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
    appliesTo: "",
    onDemand: false,
    correctiveAction: CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
    corrective: { answers: [], multiple: true, allowNote: true },
    fields: [],
  };
}

export function addCorrectiveAnswer(
  corrective: CorrectiveSettings,
  label: string,
): CorrectiveSettings {
  if (corrective.answers.length >= CORRECTIVE_MAX_ANSWERS) return corrective;
  const id = mintElementId(
    "a",
    new Set(corrective.answers.map((answer) => answer.id)),
  );
  return { ...corrective, answers: [...corrective.answers, { id, label }] };
}

/** A new form starts with its category's usual answers; one that already has some is left alone. */
export function seedCorrectiveAnswers(
  state: BuilderState,
  labels: readonly string[],
): BuilderState {
  if (state.corrective.answers.length > 0) return state;
  return {
    ...state,
    corrective: labels.reduce(addCorrectiveAnswer, state.corrective),
  };
}

/** The first category picked on a blank form brings its usual answers; switching later keeps the admin's. */
export function chooseCategory(
  state: BuilderState,
  category: FormCategory,
  seedLabels: readonly string[],
): BuilderState {
  const next = { ...state, category };
  return state.category === "" ? seedCorrectiveAnswers(next, seedLabels) : next;
}

export function correctiveOn(
  state: Pick<BuilderState, "correctiveAction">,
): boolean {
  return state.correctiveAction !== CORRECTIVE_ACTION_MODE.OFF;
}

/** With no answers the note is all there is to fill in, so it cannot be turned off. */
export function correctiveNoteShown(corrective: CorrectiveSettings): boolean {
  return corrective.allowNote || corrective.answers.length === 0;
}

export function toBuilderState(
  source: {
    name: string;
    category: FormCategory;
    appliesTo: FormAppliesTo;
    /** Starter forms leave it out: a new form is scheduled-only until the admin says otherwise. */
    onDemand?: boolean;
    definition: FormDefinition;
  },
  separator: string,
): BuilderState {
  return {
    name: source.name,
    category: source.category,
    appliesTo: source.appliesTo,
    onDemand: source.onDemand ?? false,
    correctiveAction:
      source.definition.correctiveAction === CORRECTIVE_ACTION_MODE.OFF
        ? CORRECTIVE_ACTION_MODE.OFF
        : CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL,
    corrective: correctiveSettings(source.definition),
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
        parameter: DEFAULT_MEASUREMENT_PARAMETER,
        unit: parameterUnit(DEFAULT_MEASUREMENT_PARAMETER),
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

/** Moves a field so it ends up at `toIndex`, as a dragged card lands where it was dropped. */
export function moveFieldTo(
  fields: readonly BuilderField[],
  fieldId: string,
  toIndex: number,
): BuilderField[] {
  const from = fields.findIndex((f) => f.id === fieldId);
  const next = [...fields];
  if (from === -1) return next;
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved!);
  return next;
}

/** Inserts at `index`, clamped to the list, where a field type dragged from the palette was dropped. */
export function insertFieldAt(
  fields: readonly BuilderField[],
  index: number,
  field: BuilderField,
): BuilderField[] {
  const next = [...fields];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, field);
  return next;
}

/** Inserts after `afterId`, or at the end when it is null or no longer present. */
export function insertField(
  fields: readonly BuilderField[],
  afterId: string | null,
  field: BuilderField,
): BuilderField[] {
  const index =
    afterId === null ? -1 : fields.findIndex((f) => f.id === afterId);
  const next = [...fields];
  next.splice(index === -1 ? next.length : index + 1, 0, field);
  return next;
}

/** A copy gets fresh field and option ids: reusing them would merge its answers with the original's. */
export function duplicateField(
  field: BuilderField,
  taken: ReadonlySet<string>,
  label: string,
): BuilderField {
  const copy = { ...field, id: mintElementId("f", taken), label };
  if (copy.type !== FIELD_TYPE.CHOICE) return copy;

  const optionIds = new Set<string>();
  return {
    ...copy,
    options: copy.options.map((option) => {
      const id = mintElementId("o", optionIds);
      optionIds.add(id);
      return { ...option, id };
    }),
  };
}

export type FailRule =
  | {
      kind: "limits";
      fieldId: string;
      label: string;
      unit: MeasurementUnit;
      limits: { min: number | null; max: number | null };
    }
  | { kind: "options"; fieldId: string; label: string; options: string[] };

/** What makes a record fail, in field order; fields still being fixed are left out. */
export function failRules(fields: readonly BuilderField[]): FailRule[] {
  return fields.flatMap((field): FailRule[] => {
    const label = field.label.trim();
    if (!label) return [];

    if (field.type === FIELD_TYPE.MEASUREMENT) {
      if (limitsIssue(field.limits, field.unit)) return [];
      const min = parseLimit(field.limits.min);
      const max = parseLimit(field.limits.max);
      if (min === "invalid" || max === "invalid") return [];
      if (min === null && max === null) return [];
      return [
        {
          kind: "limits",
          fieldId: field.id,
          label,
          unit: field.unit,
          limits: { min, max },
        },
      ];
    }

    if (field.type === FIELD_TYPE.CHOICE) {
      const options = field.options
        .filter((option) => option.fails && option.label.trim())
        .map((option) => option.label.trim());
      return options.length > 0
        ? [{ kind: "options", fieldId: field.id, label, options }]
        : [];
    }

    return [];
  });
}

/** Unsaved-changes check: any edit, including retyping a value back, counts once it differs. */
export function sameBuilderState(a: BuilderState, b: BuilderState): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
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
  if (state.appliesTo === "") issues.appliesTo = true;
  if (state.fields.length === 0) issues.fields = "empty";

  if (correctiveOn(state)) {
    const blankAnswers = state.corrective.answers.flatMap((answer, index) =>
      answer.label.trim() === "" ? [index] : [],
    );
    if (blankAnswers.length > 0) issues.correctiveLabels = blankAnswers;
  }

  for (const field of state.fields) {
    const found = fieldIssues(field);
    if (Object.keys(found).length > 0) issues.byField[field.id] = found;
  }

  return issues;
}

export function hasBuilderIssues(issues: BuilderIssues): boolean {
  return (
    Boolean(
      issues.name ||
      issues.category ||
      issues.appliesTo ||
      issues.fields ||
      issues.correctiveLabels,
    ) || Object.keys(issues.byField).length > 0
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
    corrective: {
      // Blank answers can only be left behind while corrective action is off.
      answers: state.corrective.answers.flatMap((answer) => {
        const label = answer.label.trim();
        return label ? [{ ...answer, label }] : [];
      }),
      multiple: state.corrective.multiple,
      allowNote: correctiveNoteShown(state.corrective),
    },
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
  maxCorrectiveAnswers: CORRECTIVE_MAX_ANSWERS,
} as const;
