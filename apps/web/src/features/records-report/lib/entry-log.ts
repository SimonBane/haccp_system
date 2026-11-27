import {
  FIELD_TYPE,
  RECORD_TIMING,
  type FormVersionSummary,
  type FormVersionSummaryMap,
  type MeasurementLimits,
  type MeasurementUnit,
  type RecordItem,
} from "@haccp/shared";
import {
  describeAnswers,
  type AnswerFormatters,
} from "@/features/forms/lib/answer-summary";
import { actorName, formatOccurrenceDate } from "@/features/records/lib/format";
import {
  isOnDemand,
  resolvedTiming,
  showsTiming,
} from "@/features/records/lib/labels";
import { reportStatus, type ReportStatus } from "./report-rows";

/** Above this many field columns the journal prints on a landscape page. */
export const ENTRY_LOG_PORTRAIT_MAX_FIELDS = 6;

export type EntryLogColumn = {
  fieldId: string;
  label: string;
  /** A reading, aligned right so its digits line up down the column. */
  numeric: boolean;
};

export type EntryLogCell = { text: string; fails: boolean };

export type EntryLogRow = {
  id: string;
  targetId: string | null;
  date: string;
  time: string;
  targetName: string | null;
  status: ReportStatus;
  late: boolean;
  onDemand: boolean;
  /** Aligned with the columns; null where the record has no answer for that field. */
  cells: (EntryLogCell | null)[];
  correctiveAction: string | null;
  /** Undefined when there is no record; null when the record's author is unknown. */
  recordedBy?: string | null;
};

/** A day's checks, so the date prints once beside them. */
export type EntryLogDay = { date: string; rows: EntryLogRow[] };

/** One item's rows; a form logged for the whole location has a single group with no item. */
export type EntryLogGroup = {
  key: string;
  targetName: string | null;
  /** Aligned with the columns: the limit or passing answers in force for this item, else null. */
  norms: (string | null)[];
  rows: EntryLogRow[];
  days: EntryLogDay[];
};

export type EntryLogContext = {
  formVersions: FormVersionSummaryMap;
  format: AnswerFormatters;
  limits?: (limits: MeasurementLimits, unit: MeasurementUnit) => string | null;
};

export type EntryLog = {
  columns: EntryLogColumn[];
  rows: EntryLogRow[];
  groups: EntryLogGroup[];
  wide: boolean;
};

/** Field ids are stable across versions, so one column per id holds the same question all period. */
export function entryLogColumns(
  versions: readonly FormVersionSummary[],
): EntryLogColumn[] {
  const newestFirst = [...versions].sort((a, b) => b.version - a.version);
  const columns = new Map<string, EntryLogColumn>();

  for (const version of newestFirst) {
    for (const field of version.definition.fields) {
      if (!columns.has(field.id)) {
        columns.set(field.id, {
          fieldId: field.id,
          label: field.label,
          numeric: field.type === FIELD_TYPE.MEASUREMENT,
        });
      }
    }
  }

  return [...columns.values()];
}

function versionsOf(
  items: readonly RecordItem[],
  formVersions: FormVersionSummaryMap,
): FormVersionSummary[] {
  return [...new Set(items.map((item) => item.formVersionId))]
    .flatMap((id) => {
      const version = formVersions[id];
      return version ? [version] : [];
    })
    .sort((a, b) => b.version - a.version);
}

function newestFirst(a: RecordItem, b: RecordItem): number {
  return (
    b.entryDate.localeCompare(a.entryDate) ||
    b.entryTime.localeCompare(a.entryTime)
  );
}

/** The newest definition of each column's field, so a norm reads as the form asks it today. */
function fieldsById(versions: readonly FormVersionSummary[]) {
  const fields = new Map<string, FormVersionSummary["definition"]["fields"][number]>();
  for (const version of versions) {
    for (const field of version.definition.fields) {
      if (!fields.has(field.id)) fields.set(field.id, field);
    }
  }
  return fields;
}

/** An item's own limits win over the form's, as they did when its newest check was created. */
export function entryLogNorms(
  columns: readonly EntryLogColumn[],
  items: readonly RecordItem[],
  context: EntryLogContext,
): (string | null)[] {
  const fields = fieldsById(versionsOf(items, context.formVersions));
  const latest = [...items].sort(newestFirst);

  return columns.map((column) => {
    const field = fields.get(column.fieldId);
    if (!field) return null;

    if (field.type === FIELD_TYPE.MEASUREMENT) {
      const limits =
        latest.find((item) => item.resolvedLimits[field.id])?.resolvedLimits[
          field.id
        ] ?? field.limits;
      if (limits.min === null && limits.max === null) return null;
      return context.limits?.(limits, field.unit) ?? null;
    }

    if (
      field.type === FIELD_TYPE.CHOICE &&
      field.options.some((option) => option.fails)
    ) {
      return field.options
        .filter((option) => !option.fails)
        .map((option) => option.label)
        .join(" / ");
    }

    return null;
  });
}

/** Rows arrive in date order, so a day's checks sit next to each other. */
export function byDay(rows: readonly EntryLogRow[]): EntryLogDay[] {
  const days: EntryLogDay[] = [];
  for (const row of rows) {
    const day = days.at(-1);
    if (day && day.date === row.date) day.rows.push(row);
    else days.push({ date: row.date, rows: [row] });
  }
  return days;
}

export function toEntryLog(
  items: readonly RecordItem[],
  context: EntryLogContext,
): EntryLog {
  const columns = entryLogColumns(versionsOf(items, context.formVersions));

  const rows = items.map((item): EntryLogRow => {
    const record = item.record;
    const answers = new Map(
      record
        ? describeAnswers(
            context.formVersions[item.formVersionId]?.definition ?? null,
            record.values,
            context.format,
          ).map((line) => [line.fieldId, line])
        : [],
    );

    const row: EntryLogRow = {
      id: item.id,
      targetId: item.targetId,
      date: formatOccurrenceDate(item.entryDate),
      time: item.entryTime,
      targetName: item.targetName,
      status: reportStatus(item),
      late:
        showsTiming(item.displayState, item.timing) &&
        resolvedTiming(item) === RECORD_TIMING.LATE,
      onDemand: isOnDemand(item),
      cells: columns.map((column) => {
        const line = answers.get(column.fieldId);
        return line ? { text: line.text, fails: line.fails } : null;
      }),
      correctiveAction: record?.correctiveAction ?? null,
    };

    if (record) row.recordedBy = actorName(record.recordedBy);
    return row;
  });

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const groups = groupByTarget(rows).map((group) => ({
    ...group,
    norms: entryLogNorms(
      columns,
      group.rows.flatMap((row) => itemsById.get(row.id) ?? []),
      context,
    ),
  }));

  return {
    columns,
    rows,
    groups,
    wide: columns.length > ENTRY_LOG_PORTRAIT_MAX_FIELDS,
  };
}

/** Items in name order, rows in API order; an item is named as its latest row snapshotted it. */
export function groupByTarget(
  rows: readonly EntryLogRow[],
): Omit<EntryLogGroup, "norms">[] {
  const groups = new Map<string, Omit<EntryLogGroup, "norms" | "days">>();

  for (const row of rows) {
    const key = row.targetId ?? row.targetName ?? "";
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
      if (row.targetName !== null) group.targetName = row.targetName;
    } else {
      groups.set(key, { key, targetName: row.targetName, rows: [row] });
    }
  }

  return [...groups.values()]
    .sort(
      (a, b) =>
        (a.targetName ?? "").localeCompare(b.targetName ?? "") ||
        a.key.localeCompare(b.key),
    )
    .map((group) => ({ ...group, days: byDay(group.rows) }));
}
