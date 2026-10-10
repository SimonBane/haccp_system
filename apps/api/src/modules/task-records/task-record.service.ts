import type {
  EvaluatedAnswers,
  TaskRecordInput,
  TaskRecordResponse,
} from "@haccp/shared";
import {
  API_ERROR_CODE,
  buildAnswerSchema,
  evaluateAnswers,
  requiresCorrectiveAction,
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
import { toReadingRows, toTaskRecordResponse } from "./task-record.mapper.js";
import {
  taskRecordRepository,
  type OccurrenceForRecording,
} from "./task-record.repository.js";

type WriteScope = {
  locationId: string;
  occurrenceId: string;
  actorUserId: string;
};

type JudgedAnswers = EvaluatedAnswers & { correctiveAction: string | null };

function assertOpened(availableAt: Date, now: Date): void {
  if (now.getTime() < availableAt.getTime()) {
    throw new ValidationError("This task is not open for completion yet");
  }
}

/**
 * Validates against the occurrence's own form version and judges with the limits it was
 * created with — never the form's current version — so a record means what it meant then.
 */
function judgeAnswers(
  occurrence: OccurrenceForRecording,
  input: TaskRecordInput,
): JudgedAnswers {
  const answers = buildAnswerSchema(occurrence.definition).parse(input.values);
  const evaluated = evaluateAnswers(
    occurrence.definition,
    occurrence.resolvedLimits,
    answers,
  );
  const correctiveAction = input.correctiveAction?.trim() || null;

  if (
    requiresCorrectiveAction(occurrence.definition, evaluated.result) &&
    !correctiveAction
  ) {
    throw new ValidationError(
      "A corrective action is required when a check fails",
    );
  }

  return {
    ...evaluated,
    correctiveAction: evaluated.result === "fail" ? correctiveAction : null,
  };
}

export const taskRecordService = {
  async create(
    db: Db,
    scope: WriteScope,
    input: TaskRecordInput,
  ): Promise<TaskRecordResponse> {
    const now = new Date();

    const occurrence = await taskRecordRepository.findOccurrenceForRecording(
      db,
      scope,
    );

    if (!occurrence) {
      throw new NotFoundError("Task occurrence not found");
    }

    assertOpened(occurrence.availableAt, now);
    const judged = judgeAnswers(occurrence, input);

    try {
      return await db.transaction(async (tx) => {
        const record = await taskRecordRepository.insertRecord(tx, {
          occurrenceId: occurrence.id,
          formVersionId: occurrence.formVersionId,
          values: judged.values,
          result: judged.result,
          correctiveAction: judged.correctiveAction,
          createdByUserId: scope.actorUserId,
          recordedAt: now,
          recordedByUserId: scope.actorUserId,
        });

        if (!record) {
          throw new InternalError("Failed to create task record");
        }

        await taskRecordRepository.replaceReadings(
          tx,
          record.id,
          toReadingRows({
            recordId: record.id,
            locationId: occurrence.locationId,
            targetId: occurrence.targetId,
            recordedAt: now,
            values: judged.values,
          }),
        );

        return toTaskRecordResponse(record);
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      mapDbMutationError(error, {
        unique: () =>
          new ConflictError("This occurrence already has a record", {
            code: API_ERROR_CODE.TASK_RECORD_ALREADY_EXISTS,
          }),
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

    const chain = await taskRecordRepository.findRecordChain(db, scope);

    if (!chain) {
      throw new NotFoundError("Task record not found");
    }

    assertOpened(chain.occurrence.availableAt, now);
    const judged = judgeAnswers(chain.occurrence, input);

    return db.transaction(async (tx) => {
      const record = await taskRecordRepository.updateRecordAnswers(
        tx,
        chain.record.id,
        {
          values: judged.values,
          result: judged.result,
          correctiveAction: judged.correctiveAction,
          recordedAt: now,
          recordedByUserId: scope.actorUserId,
        },
      );

      if (!record) {
        throw new InternalError("Failed to update task record");
      }

      await taskRecordRepository.replaceReadings(
        tx,
        record.id,
        toReadingRows({
          recordId: record.id,
          locationId: chain.occurrence.locationId,
          targetId: chain.occurrence.targetId,
          recordedAt: now,
          values: judged.values,
        }),
      );

      return toTaskRecordResponse(record);
    });
  },

  async remove(db: Db, scope: WriteScope): Promise<TaskRecordResponse> {
    const chain = await taskRecordRepository.findRecordChain(db, scope);

    if (!chain || chain.record.voidedAt !== null) {
      throw new NotFoundError("Task record not found");
    }

    const voided = await taskRecordRepository.voidActiveRecord(
      db,
      chain.record.id,
      { voidedAt: new Date(), voidedByUserId: scope.actorUserId },
    );

    if (!voided) {
      throw new NotFoundError("Task record not found");
    }

    return toTaskRecordResponse(voided);
  },
};
