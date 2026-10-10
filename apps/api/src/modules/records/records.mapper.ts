import {
  deriveRecordDisplayState,
  deriveRecordEntryState,
  deriveRecordResult,
  deriveRecordTiming,
  type FormCategory,
  type RecordDetail,
  type RecordItem,
  type RecordResult,
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

function toRecordDetail(row: RecordRow): RecordDetail | null {
  if (
    row.recordId === null ||
    row.recordCreatedAt === null ||
    row.recordedAt === null ||
    row.values === null
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
    values: row.values,
    correctiveAction: row.correctiveAction,
  };
}

export function toRecordItem(row: RecordRow): RecordItem {
  const record =
    row.recordId === null || row.recordedAt === null
      ? null
      : { recordedAt: row.recordedAt, voidedAt: row.voidedAt };

  return {
    occurrenceId: row.occurrenceId,
    taskTemplateId: row.taskTemplateId,
    occurrenceDate: row.occurrenceDate,
    scheduledTime: row.scheduledTime,
    availableAt: row.availableAt.toISOString(),
    dueAt: row.dueAt === null ? null : row.dueAt.toISOString(),
    title: row.title,
    formVersionId: row.formVersionId,
    category: row.category as FormCategory,
    targetId: row.targetId,
    targetName: row.targetName,
    resolvedLimits: row.resolvedLimits,
    displayState: deriveRecordDisplayState({ record, dueAt: row.dueAt }),
    recordState: deriveRecordEntryState(record),
    timing: deriveRecordTiming({ record, dueAt: row.dueAt }),
    result: deriveRecordResult(
      row.recordResult === null
        ? null
        : { result: row.recordResult as RecordResult },
    ),
    record: toRecordDetail(row),
  };
}
