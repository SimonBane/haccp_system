import {
  RECORD_DISPLAY_STATE,
  RECORD_RESULT,
  RECORD_TIMING,
  type RecordItem,
} from "@haccp/shared";
import {
  actorName,
  formatOccurrenceDate,
  formatTemperatureValue,
  hasTemperatureOutcome,
} from "@/features/records/lib/format";
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
  equipmentName?: string;
  reading?: string;
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
      return hasTemperatureOutcome(item) && item.result === RECORD_RESULT.FAIL
        ? "fail"
        : "done";
  }
}

export function toReportRow(
  item: RecordItem,
  context: { locale: string },
): ReportRow {
  const record = item.record;
  const temperature = record?.temperature ?? null;

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

  if (item.equipmentName !== null) {
    row.equipmentName = item.equipmentName;
  }

  if (temperature) {
    row.reading = formatTemperatureValue(temperature.recordedC, context.locale);
    if (temperature.correctiveAction !== null) {
      row.correctiveAction = temperature.correctiveAction;
    }
  }

  if (record) {
    row.recordedBy = actorName(record.recordedBy);
  }

  return row;
}

export function toReportRows(
  items: readonly RecordItem[],
  context: { locale: string },
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
