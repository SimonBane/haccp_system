import {
  RECORD_DISPLAY_STATE,
  RECORD_RESULT,
  RECORD_TIMING,
  type FormVersionSummaryMap,
  type RecordItem,
} from "@haccp/shared";
import {
  describeAnswers,
  summarizeAnswers,
  type AnswerFormatters,
} from "@/features/forms/lib/answer-summary";
import { actorName, formatOccurrenceDate } from "@/features/records/lib/format";
import { resolvedTiming, showsTiming } from "@/features/records/lib/labels";

export type ReportStatus = "done" | "fail" | "missed" | "open" | "voided";

/** Optional facts are absent keys, not nulls, so a row with nothing to say prints nothing. */
export type ReportRow = {
  occurrenceId: string;
  scheduledDate: string;
  scheduledTime: string;
  title: string;
  status: ReportStatus;
  late: boolean;
  targetName?: string;
  answers?: string;
  recordedBy?: string | null;
  correctiveAction?: string;
};

export type ReportDateGroup = {
  date: string;
  rows: ReportRow[];
};

function reportStatus(item: RecordItem): ReportStatus {
  switch (item.displayState) {
    case RECORD_DISPLAY_STATE.MISSED:
      return "missed";
    case RECORD_DISPLAY_STATE.OPEN:
      return "open";
    case RECORD_DISPLAY_STATE.VOIDED:
      return "voided";
    default:
      return item.result === RECORD_RESULT.FAIL ? "fail" : "done";
  }
}

export type ReportRowContext = {
  formVersions: FormVersionSummaryMap;
  format: AnswerFormatters;
};

export function toReportRow(
  item: RecordItem,
  context: ReportRowContext,
): ReportRow {
  const record = item.record;

  const row: ReportRow = {
    occurrenceId: item.occurrenceId,
    scheduledDate: formatOccurrenceDate(item.occurrenceDate),
    scheduledTime: item.scheduledTime,
    title: item.title,
    status: reportStatus(item),
    late:
      showsTiming(item.displayState, item.timing) &&
      resolvedTiming(item) === RECORD_TIMING.LATE,
  };

  if (item.targetName !== null) {
    row.targetName = item.targetName;
  }

  if (record) {
    const lines = describeAnswers(
      context.formVersions[item.formVersionId]?.definition ?? null,
      record.values,
      context.format,
    );
    if (lines.length > 0) row.answers = summarizeAnswers(lines);
    if (record.correctiveAction !== null) {
      row.correctiveAction = record.correctiveAction;
    }
    row.recordedBy = actorName(record.recordedBy);
  }

  return row;
}

export function toReportRows(
  items: readonly RecordItem[],
  context: ReportRowContext,
): ReportRow[] {
  return items.map((item) => toReportRow(item, context));
}

/** Groups consecutive rows only — the API order is the report order and must not be re-sorted. */
export function groupReportRowsByDate(
  rows: readonly ReportRow[],
): ReportDateGroup[] {
  const groups: ReportDateGroup[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last?.date === row.scheduledDate) {
      last.rows.push(row);
    } else {
      groups.push({ date: row.scheduledDate, rows: [row] });
    }
  }
  return groups;
}
