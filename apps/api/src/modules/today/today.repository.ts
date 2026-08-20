import { and, eq, sql } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { taskCompletions } from "../../core/db/schema/task-completions.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
import { taskRecordTemperatures } from "../../core/db/schema/task-record-temperatures.js";
import { taskRecords } from "../../core/db/schema/task-records.js";
import { temperatureLogs } from "../../core/db/schema/temperature-logs.js";
import { users } from "../../core/db/schema/users.js";
import { buildCompletionKey, type CompletionRecord } from "./today.mapper.js";

export type OccurrenceWithRecordRow = {
  occurrenceId: string;
  taskTemplateId: string;
  title: string;
  type: string;
  equipmentId: string | null;
  equipmentName: string | null;
  minTempC: string | null;
  maxTempC: string | null;
  scheduledTime: string;
  occurrenceDate: string;
  dueAt: Date;
  recordedAt: Date | null;
  recordedByUserId: string | null;
  recordedByFirstName: string | null;
  recordedByLastName: string | null;
  voidedAt: Date | null;
  detailRecordedC: string | null;
  detailMinTempC: string | null;
  detailMaxTempC: string | null;
  detailResult: string | null;
  detailCorrectiveAction: string | null;
};

export type CompletionWithTemperatureRow = {
  taskTemplateId: string;
  scheduledTime: string;
  completedAt: Date;
  completedByUserId: string;
  completedByFirstName: string;
  completedByLastName: string;
  recordedC: string | null;
  minTempC: string | null;
  maxTempC: string | null;
  result: string | null;
  correctiveAction: string | null;
};

export const todayRepository = {
  async findOccurrencesWithRecords(
    db: Db,
    locationId: string,
    date: string,
  ): Promise<OccurrenceWithRecordRow[]> {
    return db
      .select({
        occurrenceId: taskOccurrences.id,
        taskTemplateId: taskOccurrences.taskTemplateId,
        title: taskOccurrences.title,
        type: taskOccurrences.type,
        equipmentId: taskOccurrences.equipmentId,
        equipmentName: taskOccurrences.equipmentName,
        minTempC: taskOccurrences.minTempC,
        maxTempC: taskOccurrences.maxTempC,
        scheduledTime: taskOccurrences.scheduledTime,
        occurrenceDate: taskOccurrences.occurrenceDate,
        dueAt: taskOccurrences.dueAt,
        recordedAt: taskRecords.recordedAt,
        recordedByUserId: taskRecords.recordedByUserId,
        recordedByFirstName: users.firstName,
        recordedByLastName: users.lastName,
        voidedAt: taskRecords.voidedAt,
        detailRecordedC: taskRecordTemperatures.recordedC,
        detailMinTempC: taskRecordTemperatures.minTempC,
        detailMaxTempC: taskRecordTemperatures.maxTempC,
        detailResult: taskRecordTemperatures.result,
        detailCorrectiveAction: taskRecordTemperatures.correctiveAction,
      })
      .from(taskOccurrences)
      .leftJoin(taskRecords, eq(taskRecords.occurrenceId, taskOccurrences.id))
      .leftJoin(users, eq(taskRecords.recordedByUserId, users.id))
      .leftJoin(
        taskRecordTemperatures,
        eq(taskRecordTemperatures.taskRecordId, taskRecords.id),
      )
      .where(
        and(
          eq(taskOccurrences.locationId, locationId),
          eq(taskOccurrences.occurrenceDate, date),
        ),
      );
  },

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
        completedByUserId: taskCompletions.completedByUserId,
        completedByFirstName: users.firstName,
        completedByLastName: users.lastName,
        recordedC: temperatureLogs.recordedC,
        minTempC: temperatureLogs.minTempC,
        maxTempC: temperatureLogs.maxTempC,
        result: temperatureLogs.result,
        correctiveAction: temperatureLogs.correctiveAction,
      })
      .from(taskCompletions)
      .innerJoin(users, eq(taskCompletions.completedByUserId, users.id))
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
      recordedByUserId: string;
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
          recordedByUserId: update.recordedByUserId,
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
      // Must match the mapper: a mismatched key silently renders completed tasks as pending.
      const key = buildCompletionKey(row.taskTemplateId, row.scheduledTime);
      completionByKey.set(key, {
        completedAt: row.completedAt,
        completedBy: {
          id: row.completedByUserId,
          firstName: row.completedByFirstName,
          lastName: row.completedByLastName,
        },
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
