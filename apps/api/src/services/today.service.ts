import type {
  CompleteTodayTaskInput,
  CompleteTodayTemperatureTaskInput,
  TodayResponse,
  TodayTaskItem,
} from "@haccp/shared";
import {
  buildTodayTaskItem,
  classifyTemperatureResult,
  getWeekdayFromDate,
  sortScheduledTimes,
  type TaskTemplateType,
} from "@haccp/shared";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { equipment } from "../db/schema/equipment.js";
import { taskCompletions } from "../db/schema/task-completions.js";
import { taskTemplates } from "../db/schema/task-templates.js";
import { temperatureLogs } from "../db/schema/temperature-logs.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { locationService } from "./location.service.js";

function parseScheduledTimeToMinutes(time: string): number {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

function isPostgresError(error: unknown, code: string): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  ) {
    return true;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    isPostgresError((error as { cause: unknown }).cause, code)
  ) {
    return true;
  }

  return false;
}

function isUniqueViolation(error: unknown): boolean {
  return isPostgresError(error, "23505");
}

function sortItemsByScheduledTime(items: TodayTaskItem[]): TodayTaskItem[] {
  return [...items].sort(
    (a, b) =>
      parseScheduledTimeToMinutes(a.scheduledTime) -
      parseScheduledTimeToMinutes(b.scheduledTime),
  );
}

type TemplateRow = {
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

function toTemplateRow(row: {
  template: typeof taskTemplates.$inferSelect;
  equipmentName: string | null;
  minTempC: string | null;
  maxTempC: string | null;
}): TemplateRow {
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

export const todayService = {
  async getToday(db: Db, orgId: string, date: string): Promise<TodayResponse> {
    const location = await locationService.getOrCreateCurrentLocation(
      db,
      orgId,
    );

    const weekday = getWeekdayFromDate(date);
    const now = new Date();

    const templateRows = await db
      .select({
        template: taskTemplates,
        equipmentName: equipment.name,
        minTempC: equipment.minTempC,
        maxTempC: equipment.maxTempC,
      })
      .from(taskTemplates)
      .leftJoin(equipment, eq(taskTemplates.equipmentId, equipment.id))
      .where(
        and(
          eq(taskTemplates.orgId, orgId),
          eq(taskTemplates.locationId, location.id),
        ),
      );

    const matchingTemplates = templateRows
      .map(toTemplateRow)
      .filter((t) => t.weekdays.includes(weekday));

    const completionRows = await db
      .select({
        completion: taskCompletions,
        temperatureLog: temperatureLogs,
      })
      .from(taskCompletions)
      .leftJoin(
        temperatureLogs,
        eq(taskCompletions.id, temperatureLogs.taskCompletionId),
      )
      .where(
        and(
          eq(taskCompletions.orgId, orgId),
          eq(taskCompletions.locationId, location.id),
          eq(taskCompletions.occurrenceDate, date),
        ),
      );

    const completionByKey = new Map<
      string,
      {
        completedAt: Date;
        completedBy: string;
        temperatureLog: {
          recordedC: unknown;
          minTempC: unknown;
          maxTempC: unknown;
          result: string;
          correctiveAction: string | null;
        } | null;
      }
    >();

    for (const row of completionRows) {
      const key = `${row.completion.taskTemplateId}|${row.completion.scheduledTime}`;
      completionByKey.set(key, {
        completedAt: row.completion.completedAt,
        completedBy: row.completion.completedBy,
        temperatureLog: row.temperatureLog
          ? {
              recordedC: row.temperatureLog.recordedC,
              minTempC: row.temperatureLog.minTempC,
              maxTempC: row.temperatureLog.maxTempC,
              result: row.temperatureLog.result,
              correctiveAction: row.temperatureLog.correctiveAction,
            }
          : null,
      });
    }

    const sections: TodayResponse["sections"] = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    for (const template of matchingTemplates) {
      const times = sortScheduledTimes(template.scheduledTimes);

      for (const scheduledTime of times) {
        const key = `${template.id}|${scheduledTime}`;
        const completion = completionByKey.get(key);

        const temperatureReading =
          template.type === "temperature" && completion?.temperatureLog
            ? {
                recordedC: Number(completion.temperatureLog.recordedC),
                minTempC: Number(completion.temperatureLog.minTempC),
                maxTempC: Number(completion.temperatureLog.maxTempC),
                result: completion.temperatureLog.result as
                  "ok" | "out_of_range",
                correctiveAction:
                  completion.temperatureLog.correctiveAction ?? null,
              }
            : null;

        const item = buildTodayTaskItem({
          templateId: template.id,
          title: template.title,
          type: template.type,
          equipmentId: template.equipmentId,
          equipmentName: template.equipmentName,
          minTempC: template.minTempC,
          maxTempC: template.maxTempC,
          scheduledTime,
          date,
          completedAt: completion?.completedAt
            ? completion.completedAt.toISOString()
            : null,
          completedBy: completion?.completedBy ?? null,
          temperatureReading: temperatureReading,
          now,
        });

        sections[item.timeSlot].push(item);
      }
    }

    return {
      date,
      locationId: location.id,
      sections: {
        morning: sortItemsByScheduledTime(sections.morning),
        afternoon: sortItemsByScheduledTime(sections.afternoon),
        evening: sortItemsByScheduledTime(sections.evening),
      },
    };
  },

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

    const [templateRow] = await db
      .select({
        template: taskTemplates,
        equipmentName: equipment.name,
        minTempC: equipment.minTempC,
        maxTempC: equipment.maxTempC,
      })
      .from(taskTemplates)
      .leftJoin(equipment, eq(taskTemplates.equipmentId, equipment.id))
      .where(
        and(
          eq(taskTemplates.id, input.templateId),
          eq(taskTemplates.orgId, orgId),
          eq(taskTemplates.locationId, location.id),
        ),
      )
      .limit(1);

    if (!templateRow) {
      throw new NotFoundError("Task template not found");
    }

    const template = toTemplateRow(templateRow);

    if (template.type === "temperature") {
      throw new ValidationError("This task requires a temperature reading");
    }

    if (!template.weekdays.includes(weekday)) {
      throw new ValidationError("Task is not scheduled for this date");
    }

    if (!template.scheduledTimes.includes(input.scheduledTime)) {
      throw new ValidationError("Scheduled time does not match the template");
    }

    let completionRow: typeof taskCompletions.$inferSelect | null = null;
    try {
      const [created] = await db
        .insert(taskCompletions)
        .values({
          orgId,
          locationId: location.id,
          taskTemplateId: input.templateId,
          occurrenceDate: input.date,
          scheduledTime: input.scheduledTime,
          completedAt: now,
          completedBy: userId,
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create completion");
      }

      completionRow = created;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const [existing] = await db
        .select()
        .from(taskCompletions)
        .where(
          and(
            eq(taskCompletions.orgId, orgId),
            eq(taskCompletions.locationId, location.id),
            eq(taskCompletions.taskTemplateId, input.templateId),
            eq(taskCompletions.occurrenceDate, input.date),
            eq(taskCompletions.scheduledTime, input.scheduledTime),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new Error("Failed to fetch existing completion");
      }

      completionRow = existing;
    }

    if (!completionRow) {
      throw new Error("Completion missing");
    }

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
      completedAt: completionRow.completedAt.toISOString(),
      completedBy: completionRow.completedBy,
      temperatureReading: null,
      now,
    });
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

    const [templateRow] = await db
      .select({
        template: taskTemplates,
        equipmentName: equipment.name,
        minTempC: equipment.minTempC,
        maxTempC: equipment.maxTempC,
      })
      .from(taskTemplates)
      .leftJoin(equipment, eq(taskTemplates.equipmentId, equipment.id))
      .where(
        and(
          eq(taskTemplates.id, input.templateId),
          eq(taskTemplates.orgId, orgId),
          eq(taskTemplates.locationId, location.id),
        ),
      )
      .limit(1);

    if (!templateRow) {
      throw new NotFoundError("Task template not found");
    }

    const template = toTemplateRow(templateRow);

    if (!template.weekdays.includes(weekday)) {
      throw new ValidationError("Task is not scheduled for this date");
    }

    if (!template.scheduledTimes.includes(input.scheduledTime)) {
      throw new ValidationError("Scheduled time does not match the template");
    }

    const [deleted] = await db
      .delete(taskCompletions)
      .where(
        and(
          eq(taskCompletions.orgId, orgId),
          eq(taskCompletions.locationId, location.id),
          eq(taskCompletions.taskTemplateId, input.templateId),
          eq(taskCompletions.occurrenceDate, input.date),
          eq(taskCompletions.scheduledTime, input.scheduledTime),
        ),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundError("Completion not found");
    }

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
      completedAt: null,
      completedBy: null,
      temperatureReading: null,
      now,
    });
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

    const [templateRow] = await db
      .select({
        template: taskTemplates,
        equipmentName: equipment.name,
        minTempC: equipment.minTempC,
        maxTempC: equipment.maxTempC,
      })
      .from(taskTemplates)
      .leftJoin(equipment, eq(taskTemplates.equipmentId, equipment.id))
      .where(
        and(
          eq(taskTemplates.id, input.templateId),
          eq(taskTemplates.orgId, orgId),
          eq(taskTemplates.locationId, location.id),
        ),
      )
      .limit(1);

    if (!templateRow) {
      throw new NotFoundError("Task template not found");
    }

    const template = toTemplateRow(templateRow);

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

    if (!template.weekdays.includes(weekday)) {
      throw new ValidationError("Task is not scheduled for this date");
    }

    if (!template.scheduledTimes.includes(input.scheduledTime)) {
      throw new ValidationError("Scheduled time does not match the template");
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

    return db.transaction(async (tx) => {
      let completionRow: typeof taskCompletions.$inferSelect | null = null;

      try {
        const [created] = await tx
          .insert(taskCompletions)
          .values({
            orgId,
            locationId: location.id,
            taskTemplateId: input.templateId,
            occurrenceDate: input.date,
            scheduledTime: input.scheduledTime,
            completedAt: now,
            completedBy: userId,
          })
          .returning();

        if (!created) {
          throw new Error("Failed to create completion");
        }

        completionRow = created;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;

        const [existing] = await tx
          .select()
          .from(taskCompletions)
          .where(
            and(
              eq(taskCompletions.orgId, orgId),
              eq(taskCompletions.locationId, location.id),
              eq(taskCompletions.taskTemplateId, input.templateId),
              eq(taskCompletions.occurrenceDate, input.date),
              eq(taskCompletions.scheduledTime, input.scheduledTime),
            ),
          )
          .limit(1);

        if (!existing) {
          throw new Error("Failed to fetch existing completion");
        }

        completionRow = existing;
      }

      if (!completionRow) {
        throw new Error("Completion row missing");
      }

      const [tempLog] = await tx
        .insert(temperatureLogs)
        .values({
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
        })
        .onConflictDoUpdate({
          target: temperatureLogs.taskCompletionId,
          set: {
            recordedC: String(recordedC),
            minTempC: String(minTempC),
            maxTempC: String(maxTempC),
            result,
            correctiveAction:
              result === "out_of_range" ? correctiveAction : null,
            recordedBy: userId,
            recordedAt: now,
          },
        })
        .returning();

      if (!tempLog) {
        throw new Error("Failed to create/update temperature log");
      }

      return buildTodayTaskItem({
        templateId: template.id,
        title: template.title,
        type: template.type,
        equipmentId: template.equipmentId,
        equipmentName: template.equipmentName,
        minTempC,
        maxTempC,
        scheduledTime: input.scheduledTime,
        date: input.date,
        completedAt: completionRow.completedAt.toISOString(),
        completedBy: completionRow.completedBy,
        temperatureReading: {
          recordedC,
          result,
          minTempC,
          maxTempC,
          correctiveAction: result === "out_of_range" ? correctiveAction : null,
        },
        now,
      });
    });
  },
};
