import type { FormDefinition, ResolvedLimits } from "@haccp/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../core/db/client.js";
import { formVersions } from "../../core/db/schema/form-versions.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
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
  targetId: string | null;
  availableAt: Date;
  formVersionId: string;
  definition: FormDefinition;
  resolvedLimits: ResolvedLimits;
};

export type RecordChainRow = {
  record: TaskRecord;
  occurrence: OccurrenceForRecording;
};

type OwnershipScope = {
  locationId: string;
  occurrenceId: string;
};

const occurrenceColumns = {
  id: taskOccurrences.id,
  locationId: taskOccurrences.locationId,
  targetId: taskOccurrences.targetId,
  availableAt: taskOccurrences.availableAt,
  formVersionId: taskOccurrences.formVersionId,
  definition: formVersions.definition,
  resolvedLimits: taskOccurrences.resolvedLimits,
};

export const taskRecordRepository = {
  async findOccurrenceForRecording(
    db: DbClient,
    scope: OwnershipScope,
  ): Promise<OccurrenceForRecording | null> {
    const [row] = await db
      .select(occurrenceColumns)
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

  async findRecordChain(
    db: DbClient,
    scope: OwnershipScope,
  ): Promise<RecordChainRow | null> {
    const [row] = await db
      .select({ record: taskRecords, occurrence: occurrenceColumns })
      .from(taskRecords)
      .innerJoin(
        taskOccurrences,
        eq(taskRecords.occurrenceId, taskOccurrences.id),
      )
      .innerJoin(
        formVersions,
        eq(formVersions.id, taskOccurrences.formVersionId),
      )
      .where(
        and(
          eq(taskRecords.occurrenceId, scope.occurrenceId),
          eq(taskOccurrences.locationId, scope.locationId),
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

  /** Replaces the answers and reactivates a voided record; the occurrence and its form version never change. */
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
