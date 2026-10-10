import type { TaskTemplateResponse } from "@haccp/shared";
import { sortScheduledTimes, sortWeekdays } from "@haccp/shared";
import type {
  TaskTemplateWithFormRow,
  TemplateTargetRow,
} from "./task-template.repository.js";

export function toTaskTemplateResponse(
  row: TaskTemplateWithFormRow,
  targets: TemplateTargetRow[],
): TaskTemplateResponse {
  const { template } = row;

  return {
    id: template.id,
    locationId: template.locationId,
    title: template.title,
    formId: template.formId,
    formName: row.formName,
    formCategory: row.formCategory as TaskTemplateResponse["formCategory"],
    weekdays: sortWeekdays(
      template.weekdays as TaskTemplateResponse["weekdays"],
    ),
    scheduledTimes: sortScheduledTimes(template.scheduledTimes),
    targets: targets.map((target) => ({
      targetId: target.targetId,
      targetName: target.targetName,
      limitOverrides: target.limitOverrides,
    })),
    completionOpensBeforeMinutes: template.completionOpensBeforeMinutes,
    completionDueAfterMinutes: template.completionDueAfterMinutes,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}
