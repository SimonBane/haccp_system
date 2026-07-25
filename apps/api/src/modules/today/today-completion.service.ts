import type {
  CompleteTodayTaskInput,
  CompleteTodayTemperatureTaskInput,
  TodayTaskItem,
} from "@haccp/shared";
import {
  buildTodayTaskItem,
  classifyTemperatureResult,
  getWeekdayFromDate,
} from "@haccp/shared";
import type { Db, DbClient } from "../../core/db/client.js";
import { taskCompletions } from "../../core/db/schema/task-completions.js";
import {
  InternalError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { locationService } from "../locations/location.service.js";
import { taskTemplateRepository } from "../task-templates/task-template.repository.js";
import { toTemplateRow, type TemplateRow } from "./today.mapper.js";
import { todayRepository } from "./today.repository.js";

function assertTemplateScheduled(
  template: TemplateRow,
  weekday: string,
  scheduledTime: string,
): void {
  if (!template.weekdays.includes(weekday)) {
    throw new ValidationError("Task is not scheduled for this date");
  }

  if (!template.scheduledTimes.includes(scheduledTime)) {
    throw new ValidationError("Scheduled time does not match the template");
  }
}

function buildTaskItemFromTemplate(
  template: TemplateRow,
  input: CompleteTodayTaskInput,
  completedAt: string | null,
  completedBy: string | null,
  temperatureReading: TodayTaskItem["temperatureReading"],
  now: Date,
): TodayTaskItem {
  return buildTodayTaskItem({
    templateId: template.id,
    title: template.title,
    type: template.type,
    equipmentId: template.equipmentId,
    equipmentName: template.equipmentName,
    minTempC: template.minTempC,
    maxTempC: template.maxTempC,
    scheduledTime: input.scheduledTime,
    date: input.date,
    completedAt,
    completedBy,
    temperatureReading,
    now,
  });
}

async function resolveTemplateForCompletion(
  db: Db,
  orgId: string,
  locationId: string,
  templateId: string,
): Promise<TemplateRow> {
  const templateRow = await taskTemplateRepository.findWithEquipmentById(
    db,
    orgId,
    locationId,
    templateId,
  );

  if (!templateRow) {
    throw new NotFoundError("Task template not found");
  }

  return toTemplateRow(templateRow);
}

async function createOrFetchCompletion(
  db: DbClient,
  orgId: string,
  locationId: string,
  userId: string,
  input: CompleteTodayTaskInput,
  now: Date,
): Promise<typeof taskCompletions.$inferSelect> {
  try {
    const created = await todayRepository.insertCompletion(db, {
      orgId,
      locationId,
      taskTemplateId: input.templateId,
      occurrenceDate: input.date,
      scheduledTime: input.scheduledTime,
      completedAt: now,
      completedBy: userId,
    });

    if (!created) {
      throw new InternalError("Failed to create completion");
    }

    return created;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const existing = await todayRepository.findCompletion(
      db,
      orgId,
      locationId,
      input.templateId,
      input.date,
      input.scheduledTime,
    );

    if (!existing) {
      throw new InternalError("Failed to fetch existing completion");
    }

    return existing;
  }
}

export const todayCompletionService = {
  async completeTask(
    db: Db,
    orgId: string,
    userId: string,
    input: CompleteTodayTaskInput,
  ): Promise<TodayTaskItem> {
    const location = await locationService.getOrCreateCurrentLocation(
      db,
      orgId,
    );
    const weekday = getWeekdayFromDate(input.date);
    const now = new Date();

    const template = await resolveTemplateForCompletion(
      db,
      orgId,
      location.id,
      input.templateId,
    );

    if (template.type === "temperature") {
      throw new ValidationError("This task requires a temperature reading");
    }

    assertTemplateScheduled(template, weekday, input.scheduledTime);

    const completionRow = await createOrFetchCompletion(
      db,
      orgId,
      location.id,
      userId,
      input,
      now,
    );

    return buildTaskItemFromTemplate(
      template,
      input,
      completionRow.completedAt.toISOString(),
      completionRow.completedBy,
      null,
      now,
    );
  },

  async uncompleteTask(
    db: Db,
    orgId: string,
    input: CompleteTodayTaskInput,
  ): Promise<TodayTaskItem> {
    const location = await locationService.getOrCreateCurrentLocation(
      db,
      orgId,
    );
    const weekday = getWeekdayFromDate(input.date);
    const now = new Date();

    const template = await resolveTemplateForCompletion(
      db,
      orgId,
      location.id,
      input.templateId,
    );

    assertTemplateScheduled(template, weekday, input.scheduledTime);

    const deleted = await todayRepository.deleteCompletion(
      db,
      orgId,
      location.id,
      input.templateId,
      input.date,
      input.scheduledTime,
    );

    if (!deleted) {
      throw new NotFoundError("Completion not found");
    }

    return buildTaskItemFromTemplate(
      template,
      input,
      null,
      null,
      null,
      now,
    );
  },

  async completeTemperatureTask(
    db: Db,
    orgId: string,
    userId: string,
    input: CompleteTodayTemperatureTaskInput,
  ): Promise<TodayTaskItem> {
    const location = await locationService.getOrCreateCurrentLocation(
      db,
      orgId,
    );
    const weekday = getWeekdayFromDate(input.date);
    const now = new Date();
    const recordedC = Number(input.recordedC);

    const template = await resolveTemplateForCompletion(
      db,
      orgId,
      location.id,
      input.templateId,
    );

    if (template.type !== "temperature") {
      throw new ValidationError("This endpoint is for temperature tasks");
    }

    if (
      !template.equipmentId ||
      template.minTempC === null ||
      template.maxTempC === null
    ) {
      throw new ValidationError("Temperature task is missing equipment range");
    }

    assertTemplateScheduled(template, weekday, input.scheduledTime);

    const minTempC = template.minTempC;
    const maxTempC = template.maxTempC;
    const result = classifyTemperatureResult({
      recordedC,
      minTempC,
      maxTempC,
    });
    const correctiveAction = input.correctiveAction?.trim() || null;

    if (result === "out_of_range" && !correctiveAction) {
      throw new ValidationError(
        "A corrective action is required for an out-of-range reading",
      );
    }

    return db.transaction(async (tx) => {
      const completionRow = await createOrFetchCompletion(
        tx,
        orgId,
        location.id,
        userId,
        input,
        now,
      );

      const tempLog = await todayRepository.upsertTemperatureLog(
        tx,
        {
          orgId,
          locationId: location.id,
          taskCompletionId: completionRow.id,
          equipmentId: template.equipmentId!,
          recordedC: String(recordedC),
          minTempC: String(minTempC),
          maxTempC: String(maxTempC),
          result,
          correctiveAction: result === "out_of_range" ? correctiveAction : null,
          recordedBy: userId,
        },
        {
          recordedC: String(recordedC),
          minTempC: String(minTempC),
          maxTempC: String(maxTempC),
          result,
          correctiveAction:
            result === "out_of_range" ? correctiveAction : null,
          recordedBy: userId,
          recordedAt: now,
        },
      );

      if (!tempLog) {
        throw new InternalError("Failed to create/update temperature log");
      }

      return buildTaskItemFromTemplate(
        template,
        input,
        completionRow.completedAt.toISOString(),
        completionRow.completedBy,
        {
          recordedC,
          result,
          minTempC,
          maxTempC,
          correctiveAction: result === "out_of_range" ? correctiveAction : null,
        },
        now,
      );
    });
  },
};
