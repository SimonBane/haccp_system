import type { TemperatureResult, TodayTaskItem, UserSummary } from "@haccp/shared";
import {
  buildTodayTaskItemFromOccurrence,
  parseScheduledTimeToMinutes,
  type TaskTemplateType,
} from "@haccp/shared";
import type { TaskTemplateWithEquipmentRow } from "../task-templates/task-template.repository.js";
import type { OccurrenceWithRecordRow } from "./today.repository.js";

export type TemplateRow = {
  id: string;
  title: string;
  type: TaskTemplateType;
  weekdays: string[];
  scheduledTimes: string[];
  equipmentId: string | null;
  equipmentName: string | null;
  minTempC: number | null;
  maxTempC: number | null;
};

export type CompletionRecord = {
  completedAt: Date;
  completedBy: UserSummary;
  temperatureLog: {
    recordedC: unknown;
    minTempC: unknown;
    maxTempC: unknown;
    result: string;
    correctiveAction: string | null;
  } | null;
};

export function toTemplateRow(row: TaskTemplateWithEquipmentRow): TemplateRow {
  return {
    id: row.template.id,
    title: row.template.title,
    type: row.template.type as TaskTemplateType,
    weekdays: row.template.weekdays as string[],
    scheduledTimes: row.template.scheduledTimes as string[],
    equipmentId: row.template.equipmentId,
    equipmentName: row.equipmentName,
    minTempC: row.minTempC === null ? null : Number(row.minTempC),
    maxTempC: row.maxTempC === null ? null : Number(row.maxTempC),
  };
}

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

export function buildCompletionKey(
  templateId: string,
  scheduledTime: string,
): string {
  return `${templateId}|${scheduledTime}`;
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
