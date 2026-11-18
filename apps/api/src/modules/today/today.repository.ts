import type { RecordValues, ResolvedLimits } from "@haccp/shared";
import { and, eq } from "drizzle-orm";
import type { Db } from "../../core/db/client.js";
import { targets } from "../../core/db/schema/targets.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
import { taskRecords } from "../../core/db/schema/task-records.js";
import { users } from "../../core/db/schema/users.js";
import { parentTargets } from "../targets/target-label.js";

export type OccurrenceWithRecordRow = {
  occurrenceId: string;
  taskTemplateId: string;
  title: string;
  formVersionId: string;
  targetId: string | null;
  targetName: string | null;
  targetKind: string | null;
  /** Live, unlike the snapshot `targetName`, so the room heading follows a rename. */
  targetLiveName: string | null;
  targetParentId: string | null;
  targetParentName: string | null;
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
        recordedAt: taskRecords.recordedAt,
        recordedByUserId: taskRecords.recordedByUserId,
        recordedByFirstName: users.firstName,
        recordedByLastName: users.lastName,
        voidedAt: taskRecords.voidedAt,
        result: taskRecords.result,
        values: taskRecords.values,
        correctiveAction: taskRecords.correctiveAction,
      })
      .from(taskOccurrences)
      .leftJoin(targets, eq(targets.id, taskOccurrences.targetId))
      .leftJoin(parentTargets, eq(parentTargets.id, targets.parentId))
      .leftJoin(taskRecords, eq(taskRecords.occurrenceId, taskOccurrences.id))
      .leftJoin(users, eq(taskRecords.recordedByUserId, users.id))
      .where(
        and(
          eq(taskOccurrences.locationId, locationId),
          eq(taskOccurrences.occurrenceDate, date),
        ),
      );
  },
};
