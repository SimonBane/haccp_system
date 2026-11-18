import type {
  RecordResult,
  TargetKind,
  TodayArea,
  TodayTaskItem,
} from "@haccp/shared";
import {
  TARGET_KIND,
  buildTodayTaskItemFromOccurrence,
  parseScheduledTimeToMinutes,
} from "@haccp/shared";
import type { OccurrenceWithRecordRow } from "./today.repository.js";

/** Within a time, by what is checked: fixture labels lead with their room, so one walk covers "Kitchen 2 › Floor" then "› Walls". */
export function sortItemsByScheduledTime(
  items: TodayTaskItem[],
): TodayTaskItem[] {
  return [...items].sort((a, b) => {
    const byTime =
      parseScheduledTimeToMinutes(a.scheduledTime) -
      parseScheduledTimeToMinutes(b.scheduledTime);
    if (byTime !== 0) return byTime;
    const byTarget = (a.targetName ?? "").localeCompare(b.targetName ?? "");
    if (byTarget !== 0) return byTarget;
    const byTitle = a.title.localeCompare(b.title);
    if (byTitle !== 0) return byTitle;
    return a.occurrenceId < b.occurrenceId ? -1 : 1;
  });
}

function areaOf(row: OccurrenceWithRecordRow): TodayArea | null {
  if (row.targetKind === TARGET_KIND.AREA && row.targetId && row.targetLiveName) {
    return { id: row.targetId, name: row.targetLiveName };
  }
  return row.targetParentId && row.targetParentName
    ? { id: row.targetParentId, name: row.targetParentName }
    : null;
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
    targetKind: row.targetKind as TargetKind | null,
    area: areaOf(row),
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
