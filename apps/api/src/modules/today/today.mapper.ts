import type { TodayTaskItem, UserSummary } from "@haccp/shared";
import {
  parseScheduledTimeToMinutes,
  type TaskTemplateType,
} from "@haccp/shared";
import type { TaskTemplateWithEquipmentRow } from "../task-templates/task-template.repository.js";

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
  return [...items].sort(
    (a, b) =>
      parseScheduledTimeToMinutes(a.scheduledTime) -
      parseScheduledTimeToMinutes(b.scheduledTime),
  );
}

export function buildCompletionKey(
  templateId: string,
  scheduledTime: string,
): string {
  return `${templateId}|${scheduledTime}`;
}
