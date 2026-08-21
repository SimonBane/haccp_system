import type { TemperatureResult, TodayTaskItem } from "@haccp/shared";
import {
  buildTodayTaskItemFromOccurrence,
  parseScheduledTimeToMinutes,
  type TaskTemplateType,
} from "@haccp/shared";
import type { OccurrenceWithRecordRow } from "./today.repository.js";

export function sortItemsByScheduledTime(
  items: TodayTaskItem[],
): TodayTaskItem[] {
  return [...items].sort((a, b) => {
    const byTime =
      parseScheduledTimeToMinutes(a.scheduledTime) -
      parseScheduledTimeToMinutes(b.scheduledTime);
    if (byTime !== 0) return byTime;
    return a.occurrenceId < b.occurrenceId ? -1 : 1;
  });
}

export function toTodayTaskItem(
  row: OccurrenceWithRecordRow,
  now: Date,
): TodayTaskItem {
  const record =
    row.recordedAt !== null
      ? { recordedAt: row.recordedAt, voidedAt: row.voidedAt }
      : null;

  const recordedBy =
    row.recordedAt !== null && row.recordedByUserId !== null
      ? {
          id: row.recordedByUserId,
          firstName: row.recordedByFirstName ?? "",
          lastName: row.recordedByLastName ?? "",
        }
      : null;

  const temperatureReading =
    row.detailRecordedC !== null &&
    row.detailMinTempC !== null &&
    row.detailMaxTempC !== null &&
    row.detailResult !== null
      ? {
          recordedC: Number(row.detailRecordedC),
          minTempC: Number(row.detailMinTempC),
          maxTempC: Number(row.detailMaxTempC),
          result: row.detailResult as TemperatureResult,
          correctiveAction: row.detailCorrectiveAction,
        }
      : null;

  return buildTodayTaskItemFromOccurrence({
    occurrenceId: row.occurrenceId,
    templateId: row.taskTemplateId,
    title: row.title,
    type: row.type as TaskTemplateType,
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName,
    minTempC: row.minTempC === null ? null : Number(row.minTempC),
    maxTempC: row.maxTempC === null ? null : Number(row.maxTempC),
    scheduledTime: row.scheduledTime,
    date: row.occurrenceDate,
    dueAt: row.dueAt,
    now,
    record,
    recordedBy,
    temperatureReading,
  });
}
