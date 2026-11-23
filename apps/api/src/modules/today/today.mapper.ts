import type {
  RecordCorrective,
  RecordResult,
  TargetKind,
  TodayArea,
  TodayOnDemandForm,
  TodayTaskItem,
} from "@haccp/shared";
import {
  TARGET_KIND,
  buildTodayEntryItem,
  buildTodayTaskItemFromOccurrence,
  parseScheduledTimeToMinutes,
  resolveLimits,
} from "@haccp/shared";
import type { FormWithLatestVersion } from "../forms/form.repository.js";
import type {
  OccurrenceWithRecordRow,
  OnDemandEntryRow,
} from "./today.repository.js";

function todayItemKey(item: TodayTaskItem): string {
  return item.occurrenceId ?? item.recordId ?? "";
}

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
    return todayItemKey(a) < todayItemKey(b) ? -1 : 1;
  });
}

function areaOf(
  row: Pick<
    OccurrenceWithRecordRow,
    | "targetId"
    | "targetKind"
    | "targetLiveName"
    | "targetParentId"
    | "targetParentName"
  >,
): TodayArea | null {
  if (row.targetKind === TARGET_KIND.AREA && row.targetId && row.targetLiveName) {
    return { id: row.targetId, name: row.targetLiveName };
  }
  return row.targetParentId && row.targetParentName
    ? { id: row.targetParentId, name: row.targetParentName }
    : null;
}

function toCorrective(row: {
  deviationId: string | null;
  correctiveNote: string | null;
  correctiveAnswerIds: string[] | null;
}): RecordCorrective | null {
  return row.deviationId === null
    ? null
    : { answerIds: row.correctiveAnswerIds ?? [], note: row.correctiveNote };
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
      corrective: toCorrective(row),
        }
      : null;

  return buildTodayTaskItemFromOccurrence({
    occurrenceId: row.occurrenceId,
    recordId: row.recordId,
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

export function toTodayEntryItem(row: OnDemandEntryRow): TodayTaskItem {
  return buildTodayEntryItem({
    recordId: row.recordId,
    title: row.title,
    formVersionId: row.formVersionId,
    targetId: row.targetId,
    targetName: row.targetName,
    targetKind: row.targetKind as TargetKind | null,
    area: areaOf(row),
    resolvedLimits: row.resolvedLimits,
    entryDate: row.entryDate,
    entryTime: row.entryTime,
    createdAt: row.createdAt,
    recordedAt: row.recordedAt,
    recordedBy: {
      id: row.recordedByUserId,
      firstName: row.recordedByFirstName ?? "",
      lastName: row.recordedByLastName ?? "",
    },
    answers: {
      result: row.result as RecordResult,
      values: row.values,
      correctiveAction: row.correctiveAction,
      corrective: toCorrective(row),
    },
  });
}

export function toTodayOnDemandForm({
  form,
  latestVersion,
}: FormWithLatestVersion): TodayOnDemandForm {
  return {
    formId: form.id,
    name: form.name,
    formVersionId: latestVersion.id,
    appliesTo: form.appliesTo as TodayOnDemandForm["appliesTo"],
    resolvedLimits: resolveLimits(latestVersion.definition, null),
  };
}
