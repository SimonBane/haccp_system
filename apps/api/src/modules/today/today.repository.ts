import type { RecordValues, ResolvedLimits } from "@haccp/shared";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../../core/db/client.js";
import { targets } from "../../core/db/schema/targets.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
import {
  taskRecordDeviationAnswers,
  taskRecordDeviations,
} from "../../core/db/schema/task-record-deviations.js";
import { taskRecords } from "../../core/db/schema/task-records.js";
import { users } from "../../core/db/schema/users.js";
import { parentTargets } from "../targets/target-label.js";

type TargetLabelRow = {
  targetId: string | null;
  targetKind: string | null;
  /** Live, unlike the snapshot `targetName`, so the room heading follows a rename. */
  targetLiveName: string | null;
  targetParentId: string | null;
  targetParentName: string | null;
};

type DeviationRow = {
  deviationId: string | null;
  correctiveNote: string | null;
  correctiveAnswerIds: string[] | null;
};

const deviationColumns = {
  deviationId: taskRecordDeviations.id,
  correctiveNote: taskRecordDeviations.note,
  correctiveAnswerIds: sql<string[] | null>`(
    select array_agg(${taskRecordDeviationAnswers.answerId} order by ${taskRecordDeviationAnswers.position})
    from ${taskRecordDeviationAnswers}
    where ${taskRecordDeviationAnswers.deviationId} = ${taskRecordDeviations.id}
  )`,
};

export type OccurrenceWithRecordRow = TargetLabelRow & {
  occurrenceId: string;
  recordId: string | null;
  taskTemplateId: string;
  title: string;
  formVersionId: string;
  targetName: string | null;
  resolvedLimits: ResolvedLimits;
  scheduledTime: string;
  occurrenceDate: string;
  availableAt: Date;
  dueAt: Date | null;
  recordedAt: Date | null;
  recordedByUserId: string | null;
  recordedByFirstName: string | null;
  recordedByLastName: string | null;
  voidedAt: Date | null;
  result: string | null;
  values: RecordValues | null;
  correctiveAction: string | null;
} & DeviationRow;

export type OnDemandEntryRow = TargetLabelRow & {
  recordId: string;
  title: string;
  formVersionId: string;
  targetName: string | null;
  resolvedLimits: ResolvedLimits;
  entryDate: string;
  entryTime: string;
  createdAt: Date;
  recordedAt: Date;
  recordedByUserId: string;
  recordedByFirstName: string | null;
  recordedByLastName: string | null;
  result: string;
  values: RecordValues;
  correctiveAction: string | null;
} & DeviationRow;

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
        formVersionId: taskOccurrences.formVersionId,
        targetId: taskOccurrences.targetId,
        targetName: taskOccurrences.targetName,
        targetKind: targets.kind,
        targetLiveName: targets.name,
        targetParentId: targets.parentId,
        targetParentName: parentTargets.name,
        resolvedLimits: taskOccurrences.resolvedLimits,
        scheduledTime: taskOccurrences.scheduledTime,
        occurrenceDate: taskOccurrences.occurrenceDate,
        availableAt: taskOccurrences.availableAt,
        dueAt: taskOccurrences.dueAt,
        recordId: taskRecords.id,
        recordedAt: taskRecords.recordedAt,
        recordedByUserId: taskRecords.recordedByUserId,
        recordedByFirstName: users.firstName,
        recordedByLastName: users.lastName,
        voidedAt: taskRecords.voidedAt,
        result: taskRecords.result,
        values: taskRecords.values,
        correctiveAction: taskRecords.correctiveAction,
        ...deviationColumns,
      })
      .from(taskOccurrences)
      .leftJoin(targets, eq(targets.id, taskOccurrences.targetId))
      .leftJoin(parentTargets, eq(parentTargets.id, targets.parentId))
      .leftJoin(taskRecords, eq(taskRecords.occurrenceId, taskOccurrences.id))
      .leftJoin(users, eq(taskRecords.recordedByUserId, users.id))
      .leftJoin(
        taskRecordDeviations,
        eq(taskRecordDeviations.taskRecordId, taskRecords.id),
      )
      .where(
        and(
          eq(taskOccurrences.locationId, locationId),
          eq(taskOccurrences.occurrenceDate, date),
        ),
      );
  },

  /** Active entries only: an undone on-demand entry has nothing left to show on Today. */
  async findOnDemandEntries(
    db: Db,
    locationId: string,
    date: string,
  ): Promise<OnDemandEntryRow[]> {
    return db
      .select({
        recordId: taskRecords.id,
        title: taskRecords.title,
        formVersionId: taskRecords.formVersionId,
        targetId: taskRecords.targetId,
        targetName: taskRecords.targetName,
        targetKind: targets.kind,
        targetLiveName: targets.name,
        targetParentId: targets.parentId,
        targetParentName: parentTargets.name,
        resolvedLimits: taskRecords.resolvedLimits,
        entryDate: taskRecords.entryDate,
        entryTime: taskRecords.entryTime,
        createdAt: taskRecords.createdAt,
        recordedAt: taskRecords.recordedAt,
        recordedByUserId: taskRecords.recordedByUserId,
        recordedByFirstName: users.firstName,
        recordedByLastName: users.lastName,
        result: taskRecords.result,
        values: taskRecords.values,
        correctiveAction: taskRecords.correctiveAction,
        ...deviationColumns,
      })
      .from(taskRecords)
      .leftJoin(targets, eq(targets.id, taskRecords.targetId))
      .leftJoin(parentTargets, eq(parentTargets.id, targets.parentId))
      .leftJoin(users, eq(taskRecords.recordedByUserId, users.id))
      .leftJoin(
        taskRecordDeviations,
        eq(taskRecordDeviations.taskRecordId, taskRecords.id),
      )
      .where(
        and(
          eq(taskRecords.locationId, locationId),
          eq(taskRecords.entryDate, date),
          isNull(taskRecords.occurrenceId),
          isNull(taskRecords.voidedAt),
        ),
      )
      .orderBy(
        asc(taskRecords.entryTime),
        asc(taskRecords.createdAt),
        asc(taskRecords.id),
      );
  },
};
