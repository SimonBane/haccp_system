import type { TaskTemplateResponse } from "@haccp/shared";
import { sortScheduledTimes, sortWeekdays } from "@haccp/shared";
import { taskTemplates } from "../../core/db/schema/task-templates.js";

type TaskTemplateRow = typeof taskTemplates.$inferSelect;

export function toTaskTemplateResponse(
  row: TaskTemplateRow,
  equipmentName: string | null,
): TaskTemplateResponse {
  return {
    id: row.id,
    locationId: row.locationId,
    title: row.title,
    type: row.type as TaskTemplateResponse["type"],
    weekdays: sortWeekdays(row.weekdays as TaskTemplateResponse["weekdays"]),
    scheduledTimes: sortScheduledTimes(row.scheduledTimes),
    equipmentId: row.equipmentId,
    equipmentName,
    completionOpensBeforeMinutes: row.completionOpensBeforeMinutes,
    completionDueAfterMinutes: row.completionDueAfterMinutes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
