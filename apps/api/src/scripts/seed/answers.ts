import {
  buildAnswerSchema,
  correctiveSettings,
  evaluateAnswers,
  FIELD_TYPE,
  MEASUREMENT_UNITS,
  NO_LIMITS,
  resolveCorrective,
  type ChoiceField,
  type EvaluatedAnswers,
  type FormDefinition,
  type FormField,
  type MeasurementField,
  type MeasurementLimits,
  type ParsedAnswer,
  type ParsedAnswers,
  type ResolvedCorrective,
  type ResolvedLimits,
} from "@haccp/shared";
import type { SeedForm } from "./catalog.js";

export type Rng = () => number;

/** Deterministic per seed string, so re-seeding an organization reproduces the same history. */
export function createRng(seed: string): Rng {
  let state = 2166136261;
  for (const char of seed) {
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export type AnswerContext = {
  form: SeedForm;
  definition: FormDefinition;
  resolvedLimits: ResolvedLimits;
  typicalTemperature?: [number, number];
  entryDate: string;
  staffNames: string[];
  /** The employee an entry is about, for forms filled once per person. */
  employeeName?: string;
  rng: Rng;
};

export type GeneratedEntry = EvaluatedAnswers & {
  corrective: ResolvedCorrective | null;
};

const CORRECTIVE_NOTES = [
  "Проверено отново след 30 минути – в норма.",
  "Отразено в дневника за несъответствия.",
  "Причината е отворена врата при зареждане.",
];

function hasLimits(limits: MeasurementLimits): boolean {
  return limits.min !== null || limits.max !== null;
}

function isFailable(field: FormField, limits: ResolvedLimits): boolean {
  if (field.type === FIELD_TYPE.MEASUREMENT) {
    return hasLimits(limits[field.id] ?? NO_LIMITS);
  }
  return field.type === FIELD_TYPE.CHOICE && field.options.some((o) => o.fails);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function typicalRange(
  field: MeasurementField,
  limits: MeasurementLimits,
  context: AnswerContext,
): [number, number] {
  if (field.parameter === "temperature" && context.typicalTemperature) {
    return context.typicalTemperature;
  }
  const fromForm = context.form.typicalMeasurements?.[field.id];
  if (fromForm) return fromForm;
  if (limits.min !== null && limits.max !== null) {
    const span = limits.max - limits.min;
    return [limits.min + span * 0.25, limits.max - span * 0.25];
  }
  if (limits.max !== null) return [limits.max - 6, limits.max - 1];
  if (limits.min !== null) return [limits.min + 1, limits.min + 6];
  return [0, 10];
}

function measurementAnswer(
  field: MeasurementField,
  context: AnswerContext,
  fail: boolean,
): number {
  const { rng } = context;
  const limits = context.resolvedLimits[field.id] ?? NO_LIMITS;
  const decimals = MEASUREMENT_UNITS[field.unit].decimals;

  if (fail) {
    const breachHigh =
      limits.max !== null && (limits.min === null || rng() < 0.6);
    const overshoot = 0.5 + rng() * 3;
    return round(
      breachHigh ? limits.max! + overshoot : limits.min! - overshoot,
      decimals,
    );
  }

  const [low, high] = typicalRange(field, limits, context);
  let value = round(low + rng() * (high - low), decimals);
  if (limits.max !== null) value = Math.min(value, limits.max);
  if (limits.min !== null) value = Math.max(value, limits.min);
  return value;
}

function choiceAnswer(
  field: ChoiceField,
  rng: Rng,
  fail: boolean,
): string | string[] | null {
  const passing = field.options.filter((option) => !option.fails);
  const failing = field.options.filter((option) => option.fails);

  if (field.multiple) {
    const chosen = passing.filter(() => rng() < 0.75).map((o) => o.id);
    if (fail) chosen.push(pick(rng, failing).id);
    if (chosen.length === 0 && field.required) chosen.push(passing[0]!.id);
    return chosen;
  }

  if (fail) return pick(rng, failing).id;
  if (!field.required && rng() < 0.15) return null;
  return rng() < 0.8 ? passing[0]!.id : pick(rng, passing).id;
}

function textAnswer(field: FormField, context: AnswerContext): string {
  const samples = context.form.textSamples?.[field.id];
  if (!samples) return "";
  const sample = pick(context.rng, samples);
  if (sample === "@staff") {
    return context.employeeName ?? pick(context.rng, context.staffNames);
  }
  if (sample === "@batch") {
    const [, month, day] = context.entryDate.split("-");
    return `${day}${month}-${String(randomInt(context.rng, 1, 12)).padStart(2, "0")}`;
  }
  return sample;
}

/** Answers are judged by the app's own `evaluateAnswers`, so a seeded fail is a fail the app agrees with. */
export function generateEntry(context: AnswerContext): GeneratedEntry {
  const { definition, rng } = context;
  const failable = definition.fields.filter((field) =>
    isFailable(field, context.resolvedLimits),
  );
  const failFieldId =
    failable.length > 0 && rng() < context.form.failRate
      ? pick(rng, failable).id
      : null;

  const answers: ParsedAnswers = {};
  for (const field of definition.fields) {
    const fail = field.id === failFieldId;
    let answer: ParsedAnswer;
    switch (field.type) {
      case FIELD_TYPE.CHECKBOX:
        answer = field.required || rng() < 0.85;
        break;
      case FIELD_TYPE.MEASUREMENT:
        answer = measurementAnswer(field, context, fail);
        break;
      case FIELD_TYPE.CHOICE:
        answer = choiceAnswer(field, rng, fail);
        break;
      case FIELD_TYPE.TEXT:
        answer = textAnswer(field, context);
        break;
      case FIELD_TYPE.DATE:
        answer = context.entryDate;
        break;
    }
    answers[field.id] = answer;
  }

  const parsed = buildAnswerSchema(definition).parse(answers);
  const evaluated = evaluateAnswers(definition, context.resolvedLimits, parsed);

  if (evaluated.result !== "fail") {
    return { ...evaluated, corrective: null };
  }

  const settings = correctiveSettings(definition);
  const count = settings.multiple && rng() < 0.35 ? 2 : 1;
  const answerIds = [...settings.answers]
    .sort(() => rng() - 0.5)
    .slice(0, count)
    .map((answer) => answer.id);
  const note =
    settings.allowNote && rng() < 0.3 ? pick(rng, CORRECTIVE_NOTES) : "";
  const corrective = resolveCorrective(definition, { answerIds, note });

  if (corrective.issue) {
    throw new Error(
      `Seed corrective for "${context.form.name}" is invalid: ${corrective.issue}`,
    );
  }

  return { ...evaluated, corrective };
}
