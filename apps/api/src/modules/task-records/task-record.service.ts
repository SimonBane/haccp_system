import type {
  RecordKind,
  TaskRecordInput,
  TaskRecordResponse,
  TaskTemplateType,
  TemperatureResult,
} from "@haccp/shared";
import {
  classifyTemperatureResult,
  RECORD_KIND,
  TASK_TEMPLATE_TYPE,
  TEMPERATURE_RESULT,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { toTaskRecordResponse } from "./task-record.mapper.js";
import {
  taskRecordRepository,
  type OccurrenceForRecording,
  type RecordChainRow,
} from "./task-record.repository.js";

type WriteScope = {
  locationId: string;
  occurrenceId: string;
  actorUserId: string;
};

type EvaluatedTemperature = {
  recordedC: number;
  minTempC: number;
  maxTempC: number;
  result: TemperatureResult;
  correctiveAction: string | null;
};

function assertOpened(availableAt: Date, now: Date): void {
  if (now.getTime() < availableAt.getTime()) {
    throw new ValidationError("This task is not open for completion yet");
  }
}

function expectedKindFor(occurrenceType: TaskTemplateType): RecordKind {
  return occurrenceType === TASK_TEMPLATE_TYPE.TEMPERATURE
    ? RECORD_KIND.TEMPERATURE
    : RECORD_KIND.ORDINARY;
}

function assertKindMatches(
  input: TaskRecordInput,
  occurrenceType: TaskTemplateType,
): void {
  const expected = expectedKindFor(occurrenceType);

  if (input.kind !== expected) {
    throw new ValidationError(`This occurrence requires a ${expected} record`);
  }
}

function evaluateTemperature(
  input: Extract<TaskRecordInput, { kind: typeof RECORD_KIND.TEMPERATURE }>,
  range: { minTempC: string | null; maxTempC: string | null },
): EvaluatedTemperature {
  if (range.minTempC === null || range.maxTempC === null) {
    throw new InternalError(
      "Temperature occurrence is missing its recorded range",
    );
  }

  const recordedC = input.recordedC;
  const minTempC = Number(range.minTempC);
  const maxTempC = Number(range.maxTempC);
  const result = classifyTemperatureResult({ recordedC, minTempC, maxTempC });
  const correctiveAction = input.correctiveAction?.trim() || null;

  if (result === TEMPERATURE_RESULT.OUT_OF_RANGE && !correctiveAction) {
    throw new ValidationError(
      "A corrective action is required for an out-of-range reading",
    );
  }

  return {
    recordedC,
    minTempC,
    maxTempC,
    result,
    correctiveAction:
      result === TEMPERATURE_RESULT.OUT_OF_RANGE ? correctiveAction : null,
  };
}

export const taskRecordService = {
  async create(
    db: Db,
    scope: WriteScope,
    input: TaskRecordInput,
  ): Promise<TaskRecordResponse> {
    const now = new Date();

    const occurrence: OccurrenceForRecording | null =
      await taskRecordRepository.findOccurrenceForRecording(db, scope);

    if (!occurrence) {
      throw new NotFoundError("Task occurrence not found");
    }

    assertOpened(occurrence.availableAt, now);
    assertKindMatches(input, occurrence.type);

    const temperature =
      input.kind === RECORD_KIND.TEMPERATURE
        ? evaluateTemperature(input, occurrence)
        : null;

    try {
      return await db.transaction(async (tx) => {
        const recordRow = await taskRecordRepository.insertRecord(tx, {
          occurrenceId: scope.occurrenceId,
          createdByUserId: scope.actorUserId,
          recordedAt: now,
          recordedByUserId: scope.actorUserId,
        });

        if (!recordRow) {
          throw new InternalError("Failed to create task record");
        }

        if (!temperature) {
          return toTaskRecordResponse(recordRow, null);
        }

        const detailRow = await taskRecordRepository.insertTemperatureDetail(
          tx,
          {
            taskRecordId: recordRow.id,
            recordedC: String(temperature.recordedC),
            minTempC: String(temperature.minTempC),
            maxTempC: String(temperature.maxTempC),
            result: temperature.result,
            correctiveAction: temperature.correctiveAction,
          },
        );

        if (!detailRow) {
          throw new InternalError("Failed to create temperature detail");
        }

        return toTaskRecordResponse(recordRow, detailRow);
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      mapDbMutationError(error, {
        unique: () => new ConflictError("This occurrence already has a record"),
        foreignKey: () => new NotFoundError("Task occurrence not found"),
      });
    }
  },

  async update(
    db: Db,
    scope: WriteScope,
    input: TaskRecordInput,
  ): Promise<TaskRecordResponse> {
    const now = new Date();

    const chain: RecordChainRow | null =
      await taskRecordRepository.findRecordChain(db, scope);

    if (!chain) {
      throw new NotFoundError("Task record not found");
    }

    assertOpened(chain.availableAt, now);
    assertKindMatches(input, chain.occurrenceType);

    const temperature =
      input.kind === RECORD_KIND.TEMPERATURE
        ? evaluateTemperature(input, chain)
        : null;

    return db.transaction(async (tx) => {
      const updatedRecord = await taskRecordRepository.updateRecordForReactivation(
        tx,
        chain.recordId,
        { recordedAt: now, recordedByUserId: scope.actorUserId },
      );

      if (!updatedRecord) {
        throw new InternalError("Failed to update task record");
      }

      if (!temperature) {
        return toTaskRecordResponse(updatedRecord, null);
      }

      const detailRow = await taskRecordRepository.replaceTemperatureDetail(
        tx,
        chain.recordId,
        {
          recordedC: String(temperature.recordedC),
          minTempC: String(temperature.minTempC),
          maxTempC: String(temperature.maxTempC),
          result: temperature.result,
          correctiveAction: temperature.correctiveAction,
        },
      );

      if (!detailRow) {
        throw new InternalError("Failed to update temperature detail");
      }

      return toTaskRecordResponse(updatedRecord, detailRow);
    });
  },

  async remove(
    db: Db,
    scope: WriteScope,
  ): Promise<TaskRecordResponse> {
    const chain: RecordChainRow | null =
      await taskRecordRepository.findRecordChain(db, scope);

    if (!chain || chain.voidedAt !== null) {
      throw new NotFoundError("Task record not found");
    }

    const now = new Date();
    const voided = await taskRecordRepository.voidActiveRecord(
      db,
      chain.recordId,
      { voidedAt: now, voidedByUserId: scope.actorUserId },
    );

    if (!voided) {
      throw new NotFoundError("Task record not found");
    }

    const detail =
      chain.detailRecordedC !== null
        ? {
            recordedC: chain.detailRecordedC,
            minTempC: chain.detailMinTempC!,
            maxTempC: chain.detailMaxTempC!,
            result: chain.detailResult!,
            correctiveAction: chain.detailCorrectiveAction,
          }
        : null;

    return toTaskRecordResponse(voided, detail);
  },
};
