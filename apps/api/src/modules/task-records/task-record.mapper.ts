import type {
  CorrectiveAnswer,
  RecordCorrective,
  RecordResult,
  RecordValues,
  TaskRecordResponse,
} from "@haccp/shared";
import { FIELD_TYPE, RECORD_KIND } from "@haccp/shared";
import type {
  NewTaskRecordDeviation,
  NewTaskRecordDeviationAnswer,
} from "../../core/db/schema/task-record-deviations.js";
import type { NewTaskRecordReading } from "../../core/db/schema/task-record-readings.js";
import type { TaskRecord } from "../../core/db/schema/task-records.js";

export function toTaskRecordResponse(
  record: TaskRecord,
  corrective: RecordCorrective | null = null,
): TaskRecordResponse {
  return {
    id: record.id,
    kind:
      record.occurrenceId === null ? RECORD_KIND.ON_DEMAND : RECORD_KIND.SCHEDULED,
    occurrenceId: record.occurrenceId,
    taskTemplateId: record.taskTemplateId,
    formVersionId: record.formVersionId,
    entryDate: record.entryDate,
    entryTime: record.entryTime,
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
    corrective,
  };
}

export type JudgedDeviation = {
  failedFieldIds: string[];
  answers: CorrectiveAnswer[];
  note: string | null;
};

export function toRecordCorrective(
  deviation: JudgedDeviation | null,
): RecordCorrective | null {
  return deviation
    ? {
        answerIds: deviation.answers.map((answer) => answer.id),
        note: deviation.note,
      }
    : null;
}

/** The deviation copies the record's context so reports can filter without joining back. */
export function toDeviationRows(
  record: TaskRecord,
  deviation: JudgedDeviation,
): {
  row: NewTaskRecordDeviation;
  answers: Omit<NewTaskRecordDeviationAnswer, "deviationId">[];
} {
  return {
    row: {
      taskRecordId: record.id,
      locationId: record.locationId,
      taskTemplateId: record.taskTemplateId,
      formVersionId: record.formVersionId,
      targetId: record.targetId,
      entryDate: record.entryDate,
      failedFieldIds: deviation.failedFieldIds,
      note: deviation.note,
      recordedAt: record.recordedAt,
      recordedByUserId: record.recordedByUserId,
    },
    answers: deviation.answers.map((answer, position) => ({
      answerId: answer.id,
      label: answer.label,
      position,
    })),
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
