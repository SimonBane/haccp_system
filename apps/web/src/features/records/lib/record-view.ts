import {
  FIELD_TYPE,
  RECORD_DISPLAY_STATE,
  RECORD_KIND,
  RECORD_RESULT,
  RECORD_TIMING,
  type FormDefinition,
  type MeasurementLimits,
  type MeasurementUnit,
  type RecordItem,
  type UserSummary,
} from "@haccp/shared";
import { recordOutcome, RECORD_OUTCOME } from "./records-outcome";

export type RecordsDayGroup = {
  date: string;
  items: RecordItem[];
  attention: number;
  missed: number;
  open: number;
};

/** Rows arrive newest first; grouping keeps that order and only splits it at each new date. */
export function groupRecordsByDay(items: readonly RecordItem[]): RecordsDayGroup[] {
  const groups: RecordsDayGroup[] = [];

  for (const item of items) {
    let group = groups.at(-1);
    if (!group || group.date !== item.entryDate) {
      group = { date: item.entryDate, items: [], attention: 0, missed: 0, open: 0 };
      groups.push(group);
    }
    group.items.push(item);

    const outcome = recordOutcome(item);
    if (outcome === RECORD_OUTCOME.ATTENTION) group.attention += 1;
    if (outcome === RECORD_OUTCOME.MISSED) group.missed += 1;
    if (outcome === RECORD_OUTCOME.OPEN) group.open += 1;
  }

  return groups;
}

export type RecordReading = {
  fieldId: string;
  label: string;
  value: number;
  unit: MeasurementUnit;
  limits: MeasurementLimits;
  fails: boolean;
};

/** Measurement answers with a value, in the form's field order, with the limits they were judged against. */
export function recordReadings(
  item: RecordItem,
  definition: FormDefinition | null,
): RecordReading[] {
  const values = item.record?.values;
  if (!values) return [];

  const labelled = definition
    ? definition.fields.map((field) => [field.id, field.label] as const)
    : Object.keys(values).map((id) => [id, id] as const);

  return labelled.flatMap(([fieldId, label]) => {
    const answer = values[fieldId];
    if (answer?.type !== FIELD_TYPE.MEASUREMENT || answer.value === null) {
      return [];
    }
    return [
      {
        fieldId,
        label,
        value: answer.value,
        unit: answer.unit,
        limits: { min: answer.min, max: answer.max },
        fails: answer.fails,
      },
    ];
  });
}

export type ReadingScale = {
  /** Allowed band, as percentages of the bar. */
  bandStart: number;
  bandEnd: number;
  /** Where the reading sits, kept off the very ends so the marker stays visible. */
  marker: number;
  ticks: { value: number; position: number }[];
};

/** A bar wide enough to show the band, the reading and some room either side; null with no limits. */
export function readingScale(reading: {
  value: number;
  limits: MeasurementLimits;
}): ReadingScale | null {
  const { min, max } = reading.limits;
  if (min === null && max === null) return null;

  const anchors = [min, max, reading.value].filter(
    (value): value is number => value !== null,
  );
  const low = Math.min(...anchors);
  const high = Math.max(...anchors);
  const band = min !== null && max !== null ? max - min : 0;
  const pad = Math.max(high - low, band, 1) * 0.5;
  const start = low - pad;
  const end = high + pad;
  const position = (value: number) => ((value - start) / (end - start)) * 100;
  const clamp = (value: number) => Math.min(98, Math.max(2, value));

  return {
    bandStart: min === null ? 0 : position(min),
    bandEnd: max === null ? 100 : position(max),
    marker: clamp(position(reading.value)),
    ticks: [min, max]
      .filter((value): value is number => value !== null)
      .map((value) => ({ value, position: position(value) })),
  };
}

export const RECORD_EVENT = {
  SCHEDULED: "scheduled",
  RECORDED: "recorded",
  UPDATED: "updated",
  CORRECTIVE_ACTION: "correctiveAction",
  VOIDED: "voided",
  MISSED: "missed",
} as const;

export type RecordEventKind = (typeof RECORD_EVENT)[keyof typeof RECORD_EVENT];

export type RecordEvent = {
  kind: RecordEventKind;
  /** An instant, or null for the scheduled time, which is a wall-clock time on the entry date. */
  at: string | null;
  actor: UserSummary | null;
  /** On time or late, for a scheduled check's recording. */
  timing: typeof RECORD_TIMING.ON_TIME | typeof RECORD_TIMING.LATE | null;
};

/** A record edited this much later than it was first saved shows both steps. */
const UPDATE_GAP_MS = 60_000;

/** What happened to a row, oldest first, from the fields the API already returns. */
export function recordHistory(item: RecordItem): RecordEvent[] {
  const events: RecordEvent[] = [];
  const record = item.record;

  if (item.kind === RECORD_KIND.SCHEDULED) {
    events.push({ kind: RECORD_EVENT.SCHEDULED, at: null, actor: null, timing: null });
  }

  if (!record) {
    if (item.displayState === RECORD_DISPLAY_STATE.MISSED && item.dueAt) {
      events.push({ kind: RECORD_EVENT.MISSED, at: item.dueAt, actor: null, timing: null });
    }
    return events;
  }

  const timing =
    item.kind === RECORD_KIND.SCHEDULED && item.dueAt
      ? new Date(record.recordedAt).getTime() <= new Date(item.dueAt).getTime()
        ? RECORD_TIMING.ON_TIME
        : RECORD_TIMING.LATE
      : null;
  const edited =
    new Date(record.recordedAt).getTime() -
      new Date(record.createdAt).getTime() >
    UPDATE_GAP_MS;

  if (edited) {
    events.push({ kind: RECORD_EVENT.RECORDED, at: record.createdAt, actor: record.createdBy, timing: null });
    events.push({ kind: RECORD_EVENT.UPDATED, at: record.recordedAt, actor: record.recordedBy, timing });
  } else {
    events.push({ kind: RECORD_EVENT.RECORDED, at: record.recordedAt, actor: record.recordedBy, timing });
  }

  if (record.correctiveAction) {
    events.push({ kind: RECORD_EVENT.CORRECTIVE_ACTION, at: record.recordedAt, actor: record.recordedBy, timing: null });
  }

  if (record.voidedAt) {
    events.push({ kind: RECORD_EVENT.VOIDED, at: record.voidedAt, actor: record.voidedBy, timing: null });
  }

  return events;
}

/** Minutes past the deadline for a late scheduled record; null when it was not late. */
export function lateByMinutes(item: RecordItem): number | null {
  if (
    item.timing !== RECORD_TIMING.LATE ||
    !item.record ||
    !item.dueAt ||
    item.displayState !== RECORD_DISPLAY_STATE.SUBMITTED
  ) {
    return null;
  }
  return Math.max(
    1,
    Math.round(
      (new Date(item.record.recordedAt).getTime() -
        new Date(item.dueAt).getTime()) /
        60_000,
    ),
  );
}

export const RECORD_CAPTION = {
  WAS_DUE: "wasDue",
  CORRECTIVE_ACTION: "correctiveAction",
  LATE: "late",
} as const;

export type RecordCaption =
  | { kind: typeof RECORD_CAPTION.WAS_DUE; at: string }
  | { kind: typeof RECORD_CAPTION.CORRECTIVE_ACTION }
  | { kind: typeof RECORD_CAPTION.LATE; minutes: number };

/** The one extra line a phone row has room for, most important first. */
export function recordCaption(item: RecordItem): RecordCaption | null {
  if (item.displayState === RECORD_DISPLAY_STATE.MISSED && item.dueAt) {
    return { kind: RECORD_CAPTION.WAS_DUE, at: item.dueAt };
  }
  if (
    item.displayState === RECORD_DISPLAY_STATE.SUBMITTED &&
    item.result === RECORD_RESULT.FAIL &&
    item.record?.correctiveAction
  ) {
    return { kind: RECORD_CAPTION.CORRECTIVE_ACTION };
  }
  const minutes = lateByMinutes(item);
  return minutes === null ? null : { kind: RECORD_CAPTION.LATE, minutes };
}

export type ShortAnswer =
  | { kind: "reading"; value: number; unit: MeasurementUnit }
  | { kind: "checklist"; done: number; total: number }
  | null;

/** The reading when there is one, else how much of a checklist was done; a phone row shows only this. */
export function shortAnswer(item: RecordItem): ShortAnswer {
  const answers = Object.values(item.record?.values ?? {});
  if (answers.length === 0) return null;

  const reading = answers.find(
    (answer) => answer.type === FIELD_TYPE.MEASUREMENT && answer.value !== null,
  );
  if (reading?.type === FIELD_TYPE.MEASUREMENT && reading.value !== null) {
    return { kind: "reading", value: reading.value, unit: reading.unit };
  }

  if (answers.every((answer) => answer.type === FIELD_TYPE.CHECKBOX)) {
    return {
      kind: "checklist",
      done: answers.filter((answer) => answer.value === true).length,
      total: answers.length,
    };
  }

  return null;
}
