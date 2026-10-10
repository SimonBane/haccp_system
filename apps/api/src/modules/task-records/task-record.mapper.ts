import type {
  RecordResult,
  RecordValues,
  TaskRecordResponse,
} from "@haccp/shared";
import { FIELD_TYPE } from "@haccp/shared";
import type { NewTaskRecordReading } from "../../core/db/schema/task-record-readings.js";
import type { TaskRecord } from "../../core/db/schema/task-records.js";

export function toTaskRecordResponse(record: TaskRecord): TaskRecordResponse {
  return {
    id: record.id,
    occurrenceId: record.occurrenceId,
    formVersionId: record.formVersionId,
    active: record.voidedAt === null,
    createdAt: record.createdAt.toISOString(),
    createdByUserId: record.createdByUserId,
    recordedAt: record.recordedAt.toISOString(),
    recordedByUserId: record.recordedByUserId,
    voidedAt: record.voidedAt ? record.voidedAt.toISOString() : null,
    voidedByUserId: record.voidedByUserId,
    result: record.result as RecordResult,
    values: record.values,
    correctiveAction: record.correctiveAction,
  };
}

/** One typed row per answered measurement; empty optional readings are not trend points. */
export function toReadingRows(params: {
  recordId: string;
  locationId: string;
  targetId: string | null;
  recordedAt: Date;
  values: RecordValues;
}): NewTaskRecordReading[] {
  return Object.entries(params.values).flatMap(([fieldId, answer]) => {
    if (answer.type !== FIELD_TYPE.MEASUREMENT || answer.value === null) {
      return [];
    }

    return [
      {
        taskRecordId: params.recordId,
        fieldId,
        locationId: params.locationId,
        targetId: params.targetId,
        unit: answer.unit,
        value: String(answer.value),
        minValue: answer.min === null ? null : String(answer.min),
        maxValue: answer.max === null ? null : String(answer.max),
        fails: answer.fails,
        recordedAt: params.recordedAt,
      },
    ];
  });
}
