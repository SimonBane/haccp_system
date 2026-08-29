import type {
  RecordDisplayState,
  RecordItem,
  RecordResult,
  RecordTiming,
} from "@haccp/shared";
import {
  actorName,
  formatOccurrenceDate,
  formatRecordInstant,
  formatTemperatureRange,
  formatTemperatureValue,
  hasTemperatureOutcome,
} from "@/features/records/lib/format";
import { resolvedTiming, showsTiming } from "@/features/records/lib/labels";

export type ReportAttribution = {
  at: string;
  by: string | null;
};

/**
 * Optional facts are absent keys, not nulls: the report must print no deadline label, value
 * or placeholder for a no-deadline occurrence, and an absent key is what makes that testable.
 */
export type ReportRow = {
  occurrenceId: string;
  scheduledDate: string;
  scheduledTime: string;
  title: string;
  displayState: RecordDisplayState;
  availableAt: string;
  equipmentName?: string;
  dueAt?: string;
  timing?: RecordTiming;
  reading?: string;
  permittedRange?: string;
  result?: RecordResult;
  created?: ReportAttribution;
  recorded?: ReportAttribution;
  voided?: ReportAttribution;
  correctiveAction?: string;
};

export function toReportRow(
  item: RecordItem,
  context: { locale: string; timeZone: string },
): ReportRow {
  const { locale, timeZone } = context;
  const record = item.record;
  const temperature = record?.temperature ?? null;

  const row: ReportRow = {
    occurrenceId: item.occurrenceId,
    scheduledDate: formatOccurrenceDate(item.occurrenceDate),
    scheduledTime: item.scheduledTime,
    title: item.title,
    displayState: item.displayState,
    availableAt: formatRecordInstant(item.availableAt, locale, timeZone),
  };

  if (item.equipmentName !== null) {
    row.equipmentName = item.equipmentName;
  }

  if (item.dueAt !== null) {
    row.dueAt = formatRecordInstant(item.dueAt, locale, timeZone);
  }

  if (showsTiming(item.displayState, item.timing)) {
    row.timing = resolvedTiming(item);
  }

  const permittedRange = formatTemperatureRange(
    item.minTempC,
    item.maxTempC,
    locale,
  );
  if (permittedRange !== null) {
    row.permittedRange = permittedRange;
  }

  if (temperature) {
    row.reading = formatTemperatureValue(temperature.recordedC, locale);
    if (temperature.correctiveAction !== null) {
      row.correctiveAction = temperature.correctiveAction;
    }
  }

  if (hasTemperatureOutcome(item)) {
    row.result = item.result;
  }

  if (record) {
    row.created = {
      at: formatRecordInstant(record.createdAt, locale, timeZone),
      by: actorName(record.createdBy),
    };
    row.recorded = {
      at: formatRecordInstant(record.recordedAt, locale, timeZone),
      by: actorName(record.recordedBy),
    };

    if (record.voidedAt !== null) {
      row.voided = {
        at: formatRecordInstant(record.voidedAt, locale, timeZone),
        by: actorName(record.voidedBy),
      };
    }
  }

  return row;
}

export function toReportRows(
  items: readonly RecordItem[],
  context: { locale: string; timeZone: string },
): ReportRow[] {
  return items.map((item) => toReportRow(item, context));
}
