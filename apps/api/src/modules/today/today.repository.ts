import { and, eq, sql } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { taskCompletions } from "../../core/db/schema/task-completions.js";
import { temperatureLogs } from "../../core/db/schema/temperature-logs.js";
import type { CompletionRecord } from "./today.mapper.js";

export type CompletionWithTemperatureRow = {
  taskTemplateId: string;
  scheduledTime: string;
  completedAt: Date;
  completedBy: string;
  recordedC: string | null;
  minTempC: string | null;
  maxTempC: string | null;
  result: string | null;
  correctiveAction: string | null;
};

export const todayRepository = {
  async findCompletionsWithTemperatureLogs(
    db: Db,
    locationId: string,
    date: string,
  ): Promise<CompletionWithTemperatureRow[]> {
    return db
      .select({
        taskTemplateId: taskCompletions.taskTemplateId,
        scheduledTime: taskCompletions.scheduledTime,
        completedAt: taskCompletions.completedAt,
        completedBy: taskCompletions.completedBy,
        recordedC: temperatureLogs.recordedC,
        minTempC: temperatureLogs.minTempC,
        maxTempC: temperatureLogs.maxTempC,
        result: temperatureLogs.result,
        correctiveAction: temperatureLogs.correctiveAction,
      })
      .from(taskCompletions)
      .leftJoin(
        temperatureLogs,
        eq(taskCompletions.id, temperatureLogs.taskCompletionId),
      )
      .where(
        and(
          eq(taskCompletions.locationId, locationId),
          eq(taskCompletions.occurrenceDate, date),
        ),
      );
  },

  async upsertCompletion(
    db: DbClient,
    data: typeof taskCompletions.$inferInsert,
  ) {
    const [row] = await db
      .insert(taskCompletions)
      .values(data)
      .onConflictDoUpdate({
        target: [
          taskCompletions.taskTemplateId,
          taskCompletions.occurrenceDate,
          taskCompletions.scheduledTime,
        ],
        set: {
          completedAt: sql`${taskCompletions.completedAt}`,
        },
      })
      .returning();

    return row ?? null;
  },

  async findCompletion(
    db: DbClient,
    locationId: string,
    templateId: string,
    date: string,
    scheduledTime: string,
  ) {
    const [existing] = await db
      .select()
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.locationId, locationId),
          eq(taskCompletions.taskTemplateId, templateId),
          eq(taskCompletions.occurrenceDate, date),
          eq(taskCompletions.scheduledTime, scheduledTime),
        ),
      )
      .limit(1);

    return existing ?? null;
  },

  async deleteCompletion(
    db: DbClient,
    locationId: string,
    templateId: string,
    date: string,
    scheduledTime: string,
  ) {
    const [deleted] = await db
      .delete(taskCompletions)
      .where(
        and(
          eq(taskCompletions.locationId, locationId),
          eq(taskCompletions.taskTemplateId, templateId),
          eq(taskCompletions.occurrenceDate, date),
          eq(taskCompletions.scheduledTime, scheduledTime),
        ),
      )
      .returning();

    return deleted ?? null;
  },

  async upsertTemperatureLog(
    tx: DbClient,
    data: typeof temperatureLogs.$inferInsert,
    update: {
      recordedC: string;
      minTempC: string;
      maxTempC: string;
      result: string;
      correctiveAction: string | null;
      recordedBy: string;
      recordedAt: Date;
    },
  ) {
    const [tempLog] = await tx
      .insert(temperatureLogs)
      .values(data)
      .onConflictDoUpdate({
        target: temperatureLogs.taskCompletionId,
        set: {
          recordedC: update.recordedC,
          minTempC: update.minTempC,
          maxTempC: update.maxTempC,
          result: update.result,
          correctiveAction: update.correctiveAction,
          recordedBy: update.recordedBy,
          recordedAt: update.recordedAt,
        },
      })
      .returning();

    return tempLog ?? null;
  },

  buildCompletionMap(
    rows: CompletionWithTemperatureRow[],
  ): Map<string, CompletionRecord> {
    const completionByKey = new Map<string, CompletionRecord>();

    for (const row of rows) {
      const key = `${row.taskTemplateId}|${row.scheduledTime}`;
      completionByKey.set(key, {
        completedAt: row.completedAt,
        completedBy: row.completedBy,
        temperatureLog:
          row.recordedC !== null &&
          row.minTempC !== null &&
          row.maxTempC !== null &&
          row.result !== null
            ? {
                recordedC: row.recordedC,
                minTempC: row.minTempC,
                maxTempC: row.maxTempC,
                result: row.result,
                correctiveAction: row.correctiveAction,
              }
            : null,
      });
    }

    return completionByKey;
  },
};
