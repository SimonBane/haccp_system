import type { TaskRecordResponse, TemperatureResult } from "@haccp/shared";
import type { TaskRecord } from "../../core/db/schema/task-records.js";

type TemperatureDetailLike = {
  recordedC: string;
  minTempC: string;
  maxTempC: string;
  result: string;
  correctiveAction: string | null;
};

export function toTaskRecordResponse(
  record: TaskRecord,
  detail: TemperatureDetailLike | null,
): TaskRecordResponse {
  return {
    id: record.id,
    occurrenceId: record.occurrenceId,
    active: record.voidedAt === null,
    createdAt: record.createdAt.toISOString(),
    createdByUserId: record.createdByUserId,
    recordedAt: record.recordedAt.toISOString(),
    recordedByUserId: record.recordedByUserId,
    voidedAt: record.voidedAt ? record.voidedAt.toISOString() : null,
    voidedByUserId: record.voidedByUserId,
    temperature: detail
      ? {
          recordedC: Number(detail.recordedC),
          minTempC: Number(detail.minTempC),
          maxTempC: Number(detail.maxTempC),
          result: detail.result as TemperatureResult,
          correctiveAction: detail.correctiveAction,
        }
      : null,
  };
}
