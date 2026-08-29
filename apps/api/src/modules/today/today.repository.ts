import { and, eq } from "drizzle-orm";
import type { Db } from "../../core/db/client.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
import { taskRecordTemperatures } from "../../core/db/schema/task-record-temperatures.js";
import { taskRecords } from "../../core/db/schema/task-records.js";
import { users } from "../../core/db/schema/users.js";

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
  availableAt: Date;
  dueAt: Date | null;
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
        availableAt: taskOccurrences.availableAt,
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
};
