import {
  FIELD_TYPE,
  FORM_APPLIES_TO,
  splitTargetDisplayName,
  type FormVersionSummary,
  type FormVersionSummaryMap,
  type RecordItem,
} from "@haccp/shared";
import { actorName, formatOccurrenceDate } from "@/features/records/lib/format";
import type { DeviationRowContext } from "./deviation-rows";
import {
  ENTRY_LOG_PORTRAIT_MAX_FIELDS,
  entryLogColumns,
  entryLogNorms,
  toEntryLog,
  type EntryLog,
  type EntryLogColumn,
  type EntryLogRow,
} from "./entry-log";
import {
  splitIntoJournals,
  summarizeJournal,
  type Journal,
  type JournalSummary,
} from "./journals";

export const JOURNAL_SHAPE = {
  GRID: "grid",
  CHECKLIST: "checklist",
  LOG: "log",
} as const;

export type JournalShape = (typeof JOURNAL_SHAPE)[keyof typeof JOURNAL_SHAPE];

/** Check times a readings grid may hold before it reads worse than an entry log. */
export const GRID_MAX_TIMES = 8;

/** Above this many check times the grid prints on a landscape page. */
export const GRID_PORTRAIT_MAX_TIMES = 6;

export type GridCell = {
  text: string;
  fails: boolean;
  missed: boolean;
  open: boolean;
  voided: boolean;
  late: boolean;
};

export type GridAction = {
  time: string;
  /** Null when the deviation was recorded without one: the gap must show, not vanish. */
  text: string | null;
};

export type GridRow = {
  date: string;
  /** Aligned with the times; null where nothing was scheduled or recorded. */
  cells: (GridCell | null)[];
  correctiveActions: GridAction[];
  voidedTimes: string[];
  recordedBy: string[];
};

export type GridBlock = {
  key: string;
  targetName: string | null;
  /** The item's own limits where it has them, else the form's; null when nothing is judged. */
  norm: string | null;
  rows: GridRow[];
};

export type ReadingsGrid = {
  times: string[];
  blocks: GridBlock[];
};

export type ChecklistRow = EntryLogRow & {
  /** The item's name without its area, which heads the group instead. */
  itemName: string;
};

export type ChecklistGroup = { area: string | null; rows: ChecklistRow[] };

export type ChecklistSummary = {
  total: number;
  done: number;
  failed: number;
  missed: number;
};

export type ChecklistSheet = {
  key: string;
  date: string;
  time: string;
  summary: ChecklistSummary;
  groups: ChecklistGroup[];
};

export type DailyChecklist = {
  columns: EntryLogColumn[];
  sheets: ChecklistSheet[];
};

export type JournalBody =
  | { shape: typeof JOURNAL_SHAPE.GRID; grid: ReadingsGrid }
  | { shape: typeof JOURNAL_SHAPE.CHECKLIST; checklist: DailyChecklist }
  | { shape: typeof JOURNAL_SHAPE.LOG; log: EntryLog };

export type JournalDocument = {
  id: string;
  name: string;
  summary: JournalSummary;
  /** Prints on a landscape page. */
  wide: boolean;
  body: JournalBody;
};

export type JournalDocumentContext = DeviationRowContext;

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

function chronological(a: RecordItem, b: RecordItem): number {
  return (
    a.entryDate.localeCompare(b.entryDate) ||
    a.entryTime.localeCompare(b.entryTime)
  );
}

function distinctTimes(items: readonly RecordItem[]): string[] {
  return [...new Set(items.map((item) => item.entryTime))].sort();
}

function distinctTargets(items: readonly RecordItem[]): number {
  return new Set(
    items.flatMap((item) =>
      item.targetId === null && item.targetName === null
        ? []
        : [item.targetId ?? item.targetName],
    ),
  ).size;
}

/** Decided from the form, never by the reader, so the same check always prints the same way. */
export function journalShape(
  newestFirst: readonly FormVersionSummary[],
  items: readonly RecordItem[],
): JournalShape {
  const newest = newestFirst[0];
  if (!newest || newest.onDemand) return JOURNAL_SHAPE.LOG;

  const fields = newest.definition.fields;
  const hasMeasurement = fields.some(
    (field) => field.type === FIELD_TYPE.MEASUREMENT,
  );

  if (
    newest.appliesTo === FORM_APPLIES_TO.PER_ITEM &&
    !hasMeasurement &&
    distinctTargets(items) >= 2
  ) {
    return JOURNAL_SHAPE.CHECKLIST;
  }

  const multiline = fields.some(
    (field) => field.type === FIELD_TYPE.TEXT && field.multiline,
  );
  // Every field any version asked, so a field dropped mid-period still gets a column.
  const singleField = entryLogColumns(newestFirst).length <= 1;
  if (!multiline && singleField && distinctTimes(items).length <= GRID_MAX_TIMES) {
    return JOURNAL_SHAPE.GRID;
  }

  return JOURNAL_SHAPE.LOG;
}

function targetKey(item: RecordItem): string {
  return item.targetId ?? item.targetName ?? "";
}

function byTarget(items: readonly RecordItem[]): Map<string, RecordItem[]> {
  const groups = new Map<string, RecordItem[]>();
  for (const item of items) {
    const key = targetKey(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function latestTargetName(items: readonly RecordItem[]): string | null {
  return (
    [...items]
      .sort((a, b) => chronological(b, a))
      .find((item) => item.targetName)?.targetName ?? null
  );
}

function emptyCell(): GridCell {
  return {
    text: "",
    fails: false,
    missed: false,
    open: false,
    voided: false,
    late: false,
  };
}

export function toReadingsGrid(
  items: readonly RecordItem[],
  context: JournalDocumentContext,
): ReadingsGrid {
  const times = distinctTimes(items);
  const timeIndex = new Map(times.map((time, index) => [time, index]));

  const blocks = [...byTarget(items).entries()].map(
    ([key, blockItems]): GridBlock => {
      const rows = new Map<string, GridRow>();
      const ordered = [...blockItems].sort(chronological);
      const log = toEntryLog(ordered, context);

      ordered.forEach((item, index) => {
        const entry = log.rows[index]!;
        let row = rows.get(item.entryDate);
        if (!row) {
          row = {
            date: formatOccurrenceDate(item.entryDate),
            cells: times.map(() => null),
            correctiveActions: [],
            voidedTimes: [],
            recordedBy: [],
          };
          rows.set(item.entryDate, row);
        }

        const recordedBy = item.record
          ? actorName(item.record.recordedBy)
          : null;
        if (recordedBy && !row.recordedBy.includes(recordedBy)) {
          row.recordedBy.push(recordedBy);
        }

        const answer = entry.cells[0] ?? null;
        const missed = entry.status === "missed";
        const open = entry.status === "open";
        const voided = entry.status === "voided";
        if (!answer && !missed && !open) return;

        const at = timeIndex.get(item.entryTime)!;
        const cell = row.cells[at] ?? emptyCell();
        // Two checks in one slot (a re-recorded reading) both print rather than one hiding the other.
        if (answer) {
          cell.text =
            cell.text === "" ? answer.text : `${cell.text} / ${answer.text}`;
        }
        cell.fails ||= (answer?.fails ?? false) && !voided;
        cell.missed ||= missed;
        cell.open ||= open;
        cell.voided ||= voided;
        cell.late ||= entry.late;
        row.cells[at] = cell;

        if (voided) row.voidedTimes.push(item.entryTime);
        else if (entry.status === "fail") {
          row.correctiveActions.push({
            time: item.entryTime,
            text: entry.correctiveAction,
          });
        }
      });

      const fields = entryLogColumns(versionsOf(blockItems, context.formVersions));
      return {
        key,
        targetName: latestTargetName(blockItems),
        norm: entryLogNorms(fields.slice(0, 1), blockItems, context)[0] ?? null,
        rows: [...rows.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, row]) => row),
      };
    },
  );

  blocks.sort(
    (a, b) =>
      (a.targetName ?? "").localeCompare(b.targetName ?? "") ||
      a.key.localeCompare(b.key),
  );

  return { times, blocks };
}

function sheetSummary(rows: readonly EntryLogRow[]): ChecklistSummary {
  const counted = rows.filter((row) => row.status !== "voided");
  return {
    total: counted.length,
    done: counted.filter((row) => row.status === "done").length,
    failed: counted.filter((row) => row.status === "fail").length,
    missed: counted.filter((row) => row.status === "missed").length,
  };
}

/** Items outside any area first, then each area with its items, all in name order. */
function groupByArea(rows: readonly EntryLogRow[]): ChecklistGroup[] {
  const groups = new Map<string | null, ChecklistRow[]>();
  for (const row of rows) {
    const { area, name } = splitTargetDisplayName(row.targetName ?? "");
    const group = groups.get(area);
    const checklistRow = { ...row, itemName: name };
    if (group) group.push(checklistRow);
    else groups.set(area, [checklistRow]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) =>
      a === null ? -1 : b === null ? 1 : a.localeCompare(b),
    )
    .map(([area, groupRows]) => ({
      area,
      rows: groupRows.sort((a, b) => a.itemName.localeCompare(b.itemName)),
    }));
}

export function toDailyChecklist(
  items: readonly RecordItem[],
  context: JournalDocumentContext,
): DailyChecklist {
  const log = toEntryLog(items, context);
  const sheets = new Map<
    string,
    { key: string; date: string; time: string; rows: EntryLogRow[] }
  >();

  items.forEach((item, index) => {
    const key = `${item.entryDate} ${item.entryTime}`;
    let sheet = sheets.get(key);
    if (!sheet) {
      sheet = {
        key,
        date: formatOccurrenceDate(item.entryDate),
        time: item.entryTime,
        rows: [],
      };
      sheets.set(key, sheet);
    }
    sheet.rows.push(log.rows[index]!);
  });

  return {
    columns: log.columns,
    sheets: [...sheets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, { rows, ...sheet }]) => ({
        ...sheet,
        summary: sheetSummary(rows),
        groups: groupByArea(rows),
      })),
  };
}

export function toJournalDocument(
  journal: Journal,
  context: JournalDocumentContext,
): JournalDocument {
  const versions = versionsOf(journal.items, context.formVersions);
  const shape = journalShape(versions, journal.items);
  const base = {
    id: journal.id,
    name: journal.name,
    summary: summarizeJournal(journal),
  };

  if (shape === JOURNAL_SHAPE.GRID) {
    const grid = toReadingsGrid(journal.items, context);
    return {
      ...base,
      wide: grid.times.length > GRID_PORTRAIT_MAX_TIMES,
      body: { shape, grid },
    };
  }

  if (shape === JOURNAL_SHAPE.CHECKLIST) {
    const checklist = toDailyChecklist(journal.items, context);
    return {
      ...base,
      wide: checklist.columns.length > ENTRY_LOG_PORTRAIT_MAX_FIELDS,
      body: { shape, checklist },
    };
  }

  const log = toEntryLog(journal.items, context);
  return { ...base, wide: log.wide, body: { shape: JOURNAL_SHAPE.LOG, log } };
}

export function toJournalDocuments(
  items: readonly RecordItem[],
  context: JournalDocumentContext,
): JournalDocument[] {
  return splitIntoJournals(items, context.formVersions).map((journal) =>
    toJournalDocument(journal, context),
  );
}
