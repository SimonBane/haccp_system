import type { TaskTemplateType, TemperatureResult } from "@haccp/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../core/db/client.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
import { taskRecordTemperatures } from "../../core/db/schema/task-record-temperatures.js";
import {
  taskRecords,
  type NewTaskRecord,
  type TaskRecord,
} from "../../core/db/schema/task-records.js";

export type OccurrenceForRecording = {
  id: string;
  type: TaskTemplateType;
  occurrenceDate: string;
  availableAt: Date;
  dueAt: Date | null;
  minTempC: string | null;
  maxTempC: string | null;
};

export type RecordChainRow = {
  recordId: string;
  occurrenceId: string;
  createdAt: Date;
  createdByUserId: string;
  recordedAt: Date;
  recordedByUserId: string;
  voidedAt: Date | null;
  voidedByUserId: string | null;
  occurrenceType: TaskTemplateType;
  occurrenceDate: string;
  availableAt: Date;
  dueAt: Date | null;
  minTempC: string | null;
  maxTempC: string | null;
  detailRecordedC: string | null;
  detailMinTempC: string | null;
  detailMaxTempC: string | null;
  detailResult: string | null;
  detailCorrectiveAction: string | null;
};

type OwnershipScope = {
  locationId: string;
  occurrenceId: string;
};

export type NewTaskRecordTemperature =
  typeof taskRecordTemperatures.$inferInsert;
export type TaskRecordTemperature = typeof taskRecordTemperatures.$inferSelect;

export const taskRecordRepository = {
  async findOccurrenceForRecording(
    db: DbClient,
    scope: OwnershipScope,
  ): Promise<OccurrenceForRecording | null> {
    const [row] = await db
      .select({
        id: taskOccurrences.id,
        type: taskOccurrences.type,
        occurrenceDate: taskOccurrences.occurrenceDate,
        availableAt: taskOccurrences.availableAt,
        dueAt: taskOccurrences.dueAt,
        minTempC: taskOccurrences.minTempC,
        maxTempC: taskOccurrences.maxTempC,
      })
      .from(taskOccurrences)
      .where(
        and(
          eq(taskOccurrences.id, scope.occurrenceId),
          eq(taskOccurrences.locationId, scope.locationId),
        ),
      )
      .limit(1);

    return row ? { ...row, type: row.type as TaskTemplateType } : null;
  },

  async findRecordChain(
    db: DbClient,
    scope: OwnershipScope,
  ): Promise<RecordChainRow | null> {
    const [row] = await db
      .select({
        recordId: taskRecords.id,
        occurrenceId: taskRecords.occurrenceId,
        createdAt: taskRecords.createdAt,
        createdByUserId: taskRecords.createdByUserId,
        recordedAt: taskRecords.recordedAt,
        recordedByUserId: taskRecords.recordedByUserId,
        voidedAt: taskRecords.voidedAt,
        voidedByUserId: taskRecords.voidedByUserId,
        occurrenceType: taskOccurrences.type,
        occurrenceDate: taskOccurrences.occurrenceDate,
        availableAt: taskOccurrences.availableAt,
        dueAt: taskOccurrences.dueAt,
        minTempC: taskOccurrences.minTempC,
        maxTempC: taskOccurrences.maxTempC,
        detailRecordedC: taskRecordTemperatures.recordedC,
        detailMinTempC: taskRecordTemperatures.minTempC,
        detailMaxTempC: taskRecordTemperatures.maxTempC,
        detailResult: taskRecordTemperatures.result,
        detailCorrectiveAction: taskRecordTemperatures.correctiveAction,
      })
      .from(taskRecords)
      .innerJoin(
        taskOccurrences,
        eq(taskRecords.occurrenceId, taskOccurrences.id),
      )
      .leftJoin(
        taskRecordTemperatures,
        eq(taskRecordTemperatures.taskRecordId, taskRecords.id),
      )
      .where(
        and(
          eq(taskRecords.occurrenceId, scope.occurrenceId),
          eq(taskOccurrences.locationId, scope.locationId),
        ),
      )
      .limit(1);

    return row ? { ...row, occurrenceType: row.occurrenceType as TaskTemplateType } : null;
  },

  async insertRecord(
    db: DbClient,
    values: NewTaskRecord,
  ): Promise<TaskRecord | null> {
    const [created] = await db.insert(taskRecords).values(values).returning();
    return created ?? null;
  },

  async insertTemperatureDetail(
    db: DbClient,
    values: NewTaskRecordTemperature,
  ): Promise<TaskRecordTemperature | null> {
    const [created] = await db
      .insert(taskRecordTemperatures)
      .values(values)
      .returning();
    return created ?? null;
  },

  async updateRecordForReactivation(
    db: DbClient,
    recordId: string,
    values: { recordedAt: Date; recordedByUserId: string },
  ): Promise<TaskRecord | null> {
    const [updated] = await db
      .update(taskRecords)
      .set({
        recordedAt: values.recordedAt,
        recordedByUserId: values.recordedByUserId,
        voidedAt: null,
        voidedByUserId: null,
      })
      .where(eq(taskRecords.id, recordId))
      .returning();

    return updated ?? null;
  },

  async replaceTemperatureDetail(
    db: DbClient,
    taskRecordId: string,
    values: {
      recordedC: string;
      minTempC: string;
      maxTempC: string;
      result: TemperatureResult;
      correctiveAction: string | null;
    },
  ): Promise<TaskRecordTemperature | null> {
    const [updated] = await db
      .update(taskRecordTemperatures)
      .set(values)
      .where(eq(taskRecordTemperatures.taskRecordId, taskRecordId))
      .returning();

    return updated ?? null;
  },

  async voidActiveRecord(
    db: DbClient,
    recordId: string,
    values: { voidedAt: Date; voidedByUserId: string },
  ): Promise<TaskRecord | null> {
    const [updated] = await db
      .update(taskRecords)
      .set({
        voidedAt: values.voidedAt,
        voidedByUserId: values.voidedByUserId,
      })
      .where(and(eq(taskRecords.id, recordId), isNull(taskRecords.voidedAt)))
      .returning();

    return updated ?? null;
  },
};
