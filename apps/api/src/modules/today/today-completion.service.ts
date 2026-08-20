import type { UserSummary } from "@haccp/shared";
import {
  buildTodayTaskItem,
  classifyTemperatureResult,
  getWeekdayFromDate,
  isValidTimeZone,
  TASK_TEMPLATE_TYPE,
  zonedDateString,
} from "@haccp/shared";
import type {
  CompleteTodayTaskInput,
  CompleteTodayTemperatureTaskInput,
  LegacyTodayTaskItem,
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
  /** The organisation's zone — scheduled times are wall clocks at the site. */
  timeZone: string;
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
  completedBy: UserSummary | null,
  temperatureReading: LegacyTodayTaskItem["temperatureReading"],
  now: Date,
  timeZone: string,
): LegacyTodayTaskItem {
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
    timeZone,
  });
}

async function resolveTemplateForCompletion(
  db: Db,
  locationId: string,
  templateId: string,
): Promise<TemplateRow> {
  const templateRow = await taskTemplateRepository.findWithEquipmentById(
    db,
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
  locationId: string,
  input: CompletionContextInput,
  timeZone: string,
  handler: (context: CompletionContext) => Promise<T>,
): Promise<T> {
  if (!isValidTimeZone(timeZone)) {
    throw new InternalError("Organization timezone configuration is invalid");
  }

  const now = new Date();
  const businessDate = zonedDateString(now, timeZone);

  if (input.date > businessDate) {
    throw new ValidationError("Cannot record a task for a future date");
  }

  const weekday = getWeekdayFromDate(input.date);

  const template = await resolveTemplateForCompletion(
    db,
    locationId,
    input.templateId,
  );

  assertTemplateScheduled(template, weekday, input.scheduledTime);

  return handler({ locationId, template, weekday, now, timeZone });
}

async function createOrFetchCompletion(
  db: DbClient,
  locationId: string,
  userDbId: string,
  input: CompleteTodayTaskInput,
  now: Date,
): Promise<typeof taskCompletions.$inferSelect> {
  const completion = await todayRepository.upsertCompletion(db, {
    locationId,
    taskTemplateId: input.templateId,
    occurrenceDate: input.date,
    scheduledTime: input.scheduledTime,
    completedAt: now,
    completedByUserId: userDbId,
  });

  if (!completion) {
    throw new InternalError("Failed to create completion");
  }

  return completion;
}

export const todayCompletionService = {
  async completeTask(
    db: Db,
    locationId: string,
    completedBy: UserSummary,
    input: CompleteTodayTaskInput,
    timeZone: string,
  ): Promise<LegacyTodayTaskItem> {
    return withCompletionContext(
      db,
      locationId,
      input,
      timeZone,
      async ({ locationId: resolvedLocationId, template, now }) => {
        if (template.type === TASK_TEMPLATE_TYPE.TEMPERATURE) {
          throw new ValidationError("This task requires a temperature reading");
        }

        const completionRow = await createOrFetchCompletion(
          db,
          resolvedLocationId,
          completedBy.id,
          input,
          now,
        );

        return buildTaskItemFromTemplate(
          template,
          input,
          completionRow.completedAt.toISOString(),
          completedBy,
          null,
          now,
          timeZone,
        );
      },
    );
  },

  async uncompleteTask(
    db: Db,
    locationId: string,
    input: CompleteTodayTaskInput,
    timeZone: string,
  ): Promise<LegacyTodayTaskItem> {
    return withCompletionContext(
      db,
      locationId,
      input,
      timeZone,
      async ({ locationId: resolvedLocationId, template, now }) => {
        const deleted = await todayRepository.deleteCompletion(
          db,
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
          timeZone,
        );
      },
    );
  },

  async completeTemperatureTask(
    db: Db,
    locationId: string,
    completedBy: UserSummary,
    input: CompleteTodayTemperatureTaskInput,
    timeZone: string,
  ): Promise<LegacyTodayTaskItem> {
    return withCompletionContext(
      db,
      locationId,
      input,
      timeZone,
      async ({ locationId: resolvedLocationId, template, now }) => {
        const recordedC = Number(input.recordedC);

        if (template.type !== TASK_TEMPLATE_TYPE.TEMPERATURE) {
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
          recordedByUserId: completedBy.id,
          recordedAt: now,
        };

        return db.transaction(async (tx) => {
          const completionRow = await createOrFetchCompletion(
            tx,
            resolvedLocationId,
            completedBy.id,
            input,
            now,
          );

          const tempLog = await todayRepository.upsertTemperatureLog(
            tx,
            {
              locationId: resolvedLocationId,
              taskCompletionId: completionRow.id,
              equipmentId: template.equipmentId!,
              recordedC: temperatureValues.recordedC,
              minTempC: temperatureValues.minTempC,
              maxTempC: temperatureValues.maxTempC,
              result: temperatureValues.result,
              correctiveAction: temperatureValues.correctiveAction,
              recordedByUserId: temperatureValues.recordedByUserId,
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
            completedBy,
            {
              recordedC,
              result,
              minTempC,
              maxTempC,
              correctiveAction:
                result === "out_of_range" ? correctiveAction : null,
            },
            now,
            timeZone,
          );
        });
      },
    );
  },
};
