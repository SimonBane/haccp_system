import { and, eq } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { taskCompletions } from "../../core/db/schema/task-completions.js";
import { temperatureLogs } from "../../core/db/schema/temperature-logs.js";
import type { CompletionRecord } from "./today.mapper.js";

export const todayRepository = {
  async findCompletionsWithTemperatureLogs(
    db: Db,
    orgId: string,
    locationId: string,
    date: string,
  ) {
    return db
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
          eq(taskCompletions.locationId, locationId),
          eq(taskCompletions.occurrenceDate, date),
        ),
      );
  },

  async insertCompletion(
    db: DbClient,
    data: typeof taskCompletions.$inferInsert,
  ) {
    const [created] = await db.insert(taskCompletions).values(data).returning();
    return created ?? null;
  },

  async findCompletion(
    db: DbClient,
    orgId: string,
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
          eq(taskCompletions.orgId, orgId),
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
    orgId: string,
    locationId: string,
    templateId: string,
    date: string,
    scheduledTime: string,
  ) {
    const [deleted] = await db
      .delete(taskCompletions)
      .where(
        and(
          eq(taskCompletions.orgId, orgId),
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
    rows: Array<{
      completion: typeof taskCompletions.$inferSelect;
      temperatureLog: typeof temperatureLogs.$inferSelect | null;
    }>,
  ): Map<string, CompletionRecord> {
    const completionByKey = new Map<string, CompletionRecord>();

    for (const row of rows) {
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

    return completionByKey;
  },
};
