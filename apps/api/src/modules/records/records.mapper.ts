import {
  deriveRecordDisplayState,
  deriveRecordEntryState,
  deriveRecordResult,
  deriveRecordTiming,
  type RecordDetail,
  type RecordItem,
  type RecordTemperatureDetail,
  type TaskTemplateType,
  type TemperatureResult,
  type UserSummary,
} from "@haccp/shared";
import type { RecordRow } from "./records.repository.js";

function toUserSummary(
  id: string | null,
  firstName: string | null,
  lastName: string | null,
): UserSummary | null {
  if (id === null) return null;
  return { id, firstName: firstName ?? "", lastName: lastName ?? "" };
}

function toTemperatureDetail(row: RecordRow): RecordTemperatureDetail | null {
  if (
    row.temperatureRecordedC === null ||
    row.temperatureMinTempC === null ||
    row.temperatureMaxTempC === null ||
    row.temperatureResult === null
  ) {
    return null;
  }

  return {
    recordedC: Number(row.temperatureRecordedC),
    minTempC: Number(row.temperatureMinTempC),
    maxTempC: Number(row.temperatureMaxTempC),
    result: row.temperatureResult as TemperatureResult,
    correctiveAction: row.correctiveAction,
  };
}

function toRecordDetail(
  row: RecordRow,
  temperature: RecordTemperatureDetail | null,
): RecordDetail | null {
  if (
    row.recordId === null ||
    row.recordCreatedAt === null ||
    row.recordedAt === null
  ) {
    return null;
  }

  return {
    recordId: row.recordId,
    createdAt: row.recordCreatedAt.toISOString(),
    createdBy: toUserSummary(
      row.createdById,
      row.createdByFirstName,
      row.createdByLastName,
    ),
    recordedAt: row.recordedAt.toISOString(),
    recordedBy: toUserSummary(
      row.recordedById,
      row.recordedByFirstName,
      row.recordedByLastName,
    ),
    voidedAt: row.voidedAt === null ? null : row.voidedAt.toISOString(),
    voidedBy: toUserSummary(
      row.voidedById,
      row.voidedByFirstName,
      row.voidedByLastName,
    ),
    temperature,
  };
}

export function toRecordItem(row: RecordRow): RecordItem {
  const temperature = toTemperatureDetail(row);
  const record =
    row.recordId === null || row.recordedAt === null
      ? null
      : { recordedAt: row.recordedAt, voidedAt: row.voidedAt };

  return {
    occurrenceId: row.occurrenceId,
    taskTemplateId: row.taskTemplateId,
    occurrenceDate: row.occurrenceDate,
    scheduledTime: row.scheduledTime,
    dueAt: row.dueAt.toISOString(),
    title: row.title,
    type: row.type as TaskTemplateType,
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName,
    minTempC: row.minTempC === null ? null : Number(row.minTempC),
    maxTempC: row.maxTempC === null ? null : Number(row.maxTempC),
    displayState: deriveRecordDisplayState(record),
    recordState: deriveRecordEntryState(record),
    timing: deriveRecordTiming({ record, dueAt: row.dueAt }),
    result: deriveRecordResult(temperature),
    record: toRecordDetail(row, temperature),
  };
}
