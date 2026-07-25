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
import { taskTemplateRepository } from "../task-templates/task-template.repository.js";
import { toTemplateRow, type TemplateRow } from "./today.mapper.js";
import { todayRepository } from "./today.repository.js";

type CompletionContextInput = Pick<
  CompleteTodayTaskInput,
  "templateId" | "date" | "scheduledTime"
>;

type CompletionContext = {
  locationId: string;
  template: TemplateRow;
  weekday: string;
  now: Date;
};

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

async function withCompletionContext<T>(
  db: Db,
  orgId: string,
  locationId: string,
  input: CompletionContextInput,
  handler: (context: CompletionContext) => Promise<T>,
): Promise<T> {
  const weekday = getWeekdayFromDate(input.date);
  const now = new Date();

  const template = await resolveTemplateForCompletion(
    db,
    orgId,
    locationId,
    input.templateId,
  );

  assertTemplateScheduled(template, weekday, input.scheduledTime);

  return handler({ locationId, template, weekday, now });
}

async function createOrFetchCompletion(
  db: DbClient,
  orgId: string,
  locationId: string,
  userId: string,
  input: CompleteTodayTaskInput,
  now: Date,
): Promise<typeof taskCompletions.$inferSelect> {
  const completion = await todayRepository.upsertCompletion(db, {
    orgId,
    locationId,
    taskTemplateId: input.templateId,
    occurrenceDate: input.date,
    scheduledTime: input.scheduledTime,
    completedAt: now,
    completedBy: userId,
  });

  if (!completion) {
    throw new InternalError("Failed to create completion");
  }

  return completion;
}

export const todayCompletionService = {
  async completeTask(
    db: Db,
    orgId: string,
    locationId: string,
    userId: string,
    input: CompleteTodayTaskInput,
  ): Promise<TodayTaskItem> {
    return withCompletionContext(
      db,
      orgId,
      locationId,
      input,
      async ({ locationId: resolvedLocationId, template, now }) => {
        if (template.type === "temperature") {
          throw new ValidationError("This task requires a temperature reading");
        }

        const completionRow = await createOrFetchCompletion(
          db,
          orgId,
          resolvedLocationId,
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
    );
  },

  async uncompleteTask(
    db: Db,
    orgId: string,
    locationId: string,
    input: CompleteTodayTaskInput,
  ): Promise<TodayTaskItem> {
    return withCompletionContext(
      db,
      orgId,
      locationId,
      input,
      async ({ locationId: resolvedLocationId, template, now }) => {
        const deleted = await todayRepository.deleteCompletion(
          db,
          orgId,
          resolvedLocationId,
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
    );
  },

  async completeTemperatureTask(
    db: Db,
    orgId: string,
    locationId: string,
    userId: string,
    input: CompleteTodayTemperatureTaskInput,
  ): Promise<TodayTaskItem> {
    return withCompletionContext(
      db,
      orgId,
      locationId,
      input,
      async ({ locationId: resolvedLocationId, template, now }) => {
        const recordedC = Number(input.recordedC);

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

        const temperatureValues = {
          recordedC: String(recordedC),
          minTempC: String(minTempC),
          maxTempC: String(maxTempC),
          result,
          correctiveAction: result === "out_of_range" ? correctiveAction : null,
          recordedBy: userId,
          recordedAt: now,
        };

        return db.transaction(async (tx) => {
          const completionRow = await createOrFetchCompletion(
            tx,
            orgId,
            resolvedLocationId,
            userId,
            input,
            now,
          );

          const tempLog = await todayRepository.upsertTemperatureLog(
            tx,
            {
              orgId,
              locationId: resolvedLocationId,
              taskCompletionId: completionRow.id,
              equipmentId: template.equipmentId!,
              recordedC: temperatureValues.recordedC,
              minTempC: temperatureValues.minTempC,
              maxTempC: temperatureValues.maxTempC,
              result: temperatureValues.result,
              correctiveAction: temperatureValues.correctiveAction,
              recordedBy: temperatureValues.recordedBy,
            },
            temperatureValues,
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
              correctiveAction:
                result === "out_of_range" ? correctiveAction : null,
            },
            now,
          );
        });
      },
    );
  },
};
