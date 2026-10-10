import type { RecordResult, TodayTaskItem } from "@haccp/shared";
import {
  buildTodayTaskItemFromOccurrence,
  parseScheduledTimeToMinutes,
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

  const answers =
    row.result !== null && row.values !== null
      ? {
          result: row.result as RecordResult,
          values: row.values,
          correctiveAction: row.correctiveAction,
        }
      : null;

  return buildTodayTaskItemFromOccurrence({
    occurrenceId: row.occurrenceId,
    templateId: row.taskTemplateId,
    title: row.title,
    formVersionId: row.formVersionId,
    targetId: row.targetId,
    targetName: row.targetName,
    resolvedLimits: row.resolvedLimits,
    scheduledTime: row.scheduledTime,
    date: row.occurrenceDate,
    availableAt: row.availableAt,
    dueAt: row.dueAt,
    now,
    record,
    recordedBy,
    answers,
  });
}
