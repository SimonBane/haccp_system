import type { FormDefinition, ResolvedLimits } from "@haccp/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../core/db/client.js";
import { formVersions } from "../../core/db/schema/form-versions.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
import {
  taskRecordDeviationAnswers,
  taskRecordDeviations,
  type NewTaskRecordDeviation,
  type NewTaskRecordDeviationAnswer,
} from "../../core/db/schema/task-record-deviations.js";
import {
  taskRecordReadings,
  type NewTaskRecordReading,
} from "../../core/db/schema/task-record-readings.js";
import {
  taskRecords,
  type NewTaskRecord,
  type TaskRecord,
} from "../../core/db/schema/task-records.js";

export type OccurrenceForRecording = {
  id: string;
  locationId: string;
  taskTemplateId: string;
  title: string;
  targetId: string | null;
  targetName: string | null;
  occurrenceDate: string;
  scheduledTime: string;
  availableAt: Date;
  formVersionId: string;
  definition: FormDefinition;
  resolvedLimits: ResolvedLimits;
};

export type RecordForWrite = {
  record: TaskRecord;
  definition: FormDefinition;
  /** Null for an on-demand record, which has no opening time to respect. */
  availableAt: Date | null;
};

export const taskRecordRepository = {
  async findOccurrenceForRecording(
    db: DbClient,
    scope: { locationId: string; occurrenceId: string },
  ): Promise<OccurrenceForRecording | null> {
    const [row] = await db
      .select({
        id: taskOccurrences.id,
        locationId: taskOccurrences.locationId,
        taskTemplateId: taskOccurrences.taskTemplateId,
        title: taskOccurrences.title,
        targetId: taskOccurrences.targetId,
        targetName: taskOccurrences.targetName,
        occurrenceDate: taskOccurrences.occurrenceDate,
        scheduledTime: taskOccurrences.scheduledTime,
        availableAt: taskOccurrences.availableAt,
        formVersionId: taskOccurrences.formVersionId,
        definition: formVersions.definition,
        resolvedLimits: taskOccurrences.resolvedLimits,
      })
      .from(taskOccurrences)
      .innerJoin(
        formVersions,
        eq(formVersions.id, taskOccurrences.formVersionId),
      )
      .where(
        and(
          eq(taskOccurrences.id, scope.occurrenceId),
          eq(taskOccurrences.locationId, scope.locationId),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async findRecordForWrite(
    db: DbClient,
    scope: { locationId: string; recordId: string },
  ): Promise<RecordForWrite | null> {
    const [row] = await db
      .select({
        record: taskRecords,
        definition: formVersions.definition,
        availableAt: taskOccurrences.availableAt,
      })
      .from(taskRecords)
      .innerJoin(formVersions, eq(formVersions.id, taskRecords.formVersionId))
      .leftJoin(
        taskOccurrences,
        eq(taskOccurrences.id, taskRecords.occurrenceId),
      )
      .where(
        and(
          eq(taskRecords.id, scope.recordId),
          eq(taskRecords.locationId, scope.locationId),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async insertRecord(
    db: DbClient,
    values: NewTaskRecord,
  ): Promise<TaskRecord | null> {
    const [created] = await db.insert(taskRecords).values(values).returning();
    return created ?? null;
  },

  /** Replaces the answers and reactivates a voided record; its context never changes. */
  async updateRecordAnswers(
    db: DbClient,
    recordId: string,
    values: Pick<
      NewTaskRecord,
      | "values"
      | "result"
      | "correctiveAction"
      | "recordedAt"
      | "recordedByUserId"
    >,
  ): Promise<TaskRecord | null> {
    const [updated] = await db
      .update(taskRecords)
      .set({ ...values, voidedAt: null, voidedByUserId: null })
      .where(eq(taskRecords.id, recordId))
      .returning();

    return updated ?? null;
  },

  async replaceReadings(
    db: DbClient,
    recordId: string,
    readings: NewTaskRecordReading[],
  ): Promise<void> {
    await db
      .delete(taskRecordReadings)
      .where(eq(taskRecordReadings.taskRecordId, recordId));

    if (readings.length > 0) {
      await db.insert(taskRecordReadings).values(readings);
    }
  },

  /** Call inside the record's transaction: a passing record must lose the deviation it had. */
  async replaceDeviation(
    db: DbClient,
    recordId: string,
    deviation: {
      row: NewTaskRecordDeviation;
      answers: Omit<NewTaskRecordDeviationAnswer, "deviationId">[];
    } | null,
  ): Promise<void> {
    await db
      .delete(taskRecordDeviations)
      .where(eq(taskRecordDeviations.taskRecordId, recordId));

    if (!deviation) return;

    const [created] = await db
      .insert(taskRecordDeviations)
      .values(deviation.row)
      .returning({ id: taskRecordDeviations.id });

    if (created && deviation.answers.length > 0) {
      await db
        .insert(taskRecordDeviationAnswers)
        .values(
          deviation.answers.map((answer) => ({
            ...answer,
            deviationId: created.id,
          })),
        );
    }
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
