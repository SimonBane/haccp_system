import type {
  CorrectiveIssue,
  EvaluatedAnswers,
  FormDefinition,
  OnDemandRecordInput,
  ResolvedLimits,
  TaskRecordInput,
  TaskRecordResponse,
} from "@haccp/shared";
import {
  API_ERROR_CODE,
  buildAnswerSchema,
  evaluateAnswers,
  FORM_APPLIES_TO,
  isEntryInFuture,
  resolveCorrective,
  resolveLimits,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import type { NewTaskRecord } from "../../core/db/schema/task-records.js";
import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { formRepository } from "../forms/form.repository.js";
import {
  targetRepository,
  type TargetItemRow,
} from "../targets/target.repository.js";
import {
  toDeviationRows,
  toReadingRows,
  toRecordCorrective,
  toTaskRecordResponse,
  type JudgedDeviation,
} from "./task-record.mapper.js";
import { taskRecordRepository } from "./task-record.repository.js";

type ActorScope = {
  locationId: string;
  actorUserId: string;
};

type JudgedAnswers = EvaluatedAnswers & {
  correctiveAction: string | null;
  /** Null unless the record fails. */
  deviation: JudgedDeviation | null;
};

const CORRECTIVE_ISSUE_MESSAGE: Record<CorrectiveIssue, string> = {
  not_asked: "This form does not take a corrective action",
  unknown_answer: "A corrective answer is not one of this form's answers",
  single_answer_only: "This form takes a single corrective answer",
  note_not_allowed: "This form does not take a corrective note",
  required: "A corrective action is required when a check fails",
};

function assertOpened(availableAt: Date | null, now: Date): void {
  if (availableAt !== null && now.getTime() < availableAt.getTime()) {
    throw new ValidationError("This task is not open for completion yet");
  }
}

function assertNotInFuture(
  entry: { entryDate: string; entryTime: string },
  now: Date,
  timeZone: string,
): void {
  if (isEntryInFuture(entry.entryDate, entry.entryTime, now, timeZone)) {
    throw new ValidationError("An entry cannot be in the future");
  }
}

/**
 * Validates against the record's own form version and judges with the limits it was
 * created with — never the form's current version — so a record means what it meant then.
 */
function judgeAnswers(
  context: { definition: FormDefinition; resolvedLimits: ResolvedLimits },
  input: TaskRecordInput,
): JudgedAnswers {
  const answers = buildAnswerSchema(context.definition).parse(input.values);
  const evaluated = evaluateAnswers(
    context.definition,
    context.resolvedLimits,
    answers,
  );

  if (evaluated.result !== "fail") {
    return { ...evaluated, correctiveAction: null, deviation: null };
  }

  const corrective = resolveCorrective(context.definition, {
    answerIds: input.correctiveAnswerIds ?? [],
    note: input.correctiveAction ?? "",
  });

  if (corrective.issue) {
    throw new ValidationError(CORRECTIVE_ISSUE_MESSAGE[corrective.issue]);
  }

  return {
    ...evaluated,
    correctiveAction: corrective.text,
    deviation: {
      failedFieldIds: evaluated.failedFieldIds,
      answers: corrective.answers,
      note: corrective.note,
    },
  };
}

async function insertWithReadings(
  db: Db,
  values: NewTaskRecord,
  recordedAt: Date,
  deviation: JudgedDeviation | null,
): Promise<TaskRecordResponse> {
  return db.transaction(async (tx) => {
    const record = await taskRecordRepository.insertRecord(tx, values);

    if (!record) {
      throw new InternalError("Failed to create task record");
    }

    await taskRecordRepository.replaceReadings(
      tx,
      record.id,
      toReadingRows({
        recordId: record.id,
        locationId: record.locationId,
        targetId: record.targetId,
        recordedAt,
        values: record.values,
      }),
    );

    await taskRecordRepository.replaceDeviation(
      tx,
      record.id,
      deviation ? toDeviationRows(record, deviation) : null,
    );

    return toTaskRecordResponse(record, toRecordCorrective(deviation));
  });
}

export const taskRecordService = {
  async create(
    db: Db,
    scope: ActorScope & { occurrenceId: string },
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
      return await insertWithReadings(
        db,
        {
          locationId: occurrence.locationId,
          taskTemplateId: occurrence.taskTemplateId,
          occurrenceId: occurrence.id,
          title: occurrence.title,
          formVersionId: occurrence.formVersionId,
          targetId: occurrence.targetId,
          targetName: occurrence.targetName,
          resolvedLimits: occurrence.resolvedLimits,
          entryDate: occurrence.occurrenceDate,
          entryTime: occurrence.scheduledTime,
          values: judged.values,
          result: judged.result,
          correctiveAction: judged.correctiveAction,
          createdByUserId: scope.actorUserId,
          recordedAt: now,
          recordedByUserId: scope.actorUserId,
        },
        now,
        judged.deviation,
      );
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

  async createOnDemand(
    db: Db,
    scope: ActorScope & {
      organizationId: string;
      formId: string;
      timeZone: string;
    },
    input: OnDemandRecordInput,
  ): Promise<TaskRecordResponse> {
    const now = new Date();

    const found = await formRepository.findActiveWithLatestVersion(
      db,
      scope.organizationId,
      scope.formId,
    );

    if (!found || !found.form.onDemand) {
      throw new NotFoundError("Form not found");
    }

    const { form, latestVersion } = found;

    if (latestVersion.id !== input.formVersionId) {
      throw new ConflictError("The form has changed since it was opened", {
        code: API_ERROR_CODE.FORM_VERSION_CHANGED,
      });
    }

    let item: TargetItemRow | null = null;
    if (form.appliesTo === FORM_APPLIES_TO.PER_ITEM) {
      item = input.targetId
        ? await targetRepository.findActiveItem(
            db,
            scope.locationId,
            input.targetId,
          )
        : null;
      if (!item) {
        throw new NotFoundError("Item not found at this location");
      }
    } else if (input.targetId !== null) {
      throw new ValidationError("This form is not recorded per item");
    }

    assertNotInFuture(input, now, scope.timeZone);

    const resolvedLimits = resolveLimits(latestVersion.definition, item?.limits);
    const judged = judgeAnswers(
      { definition: latestVersion.definition, resolvedLimits },
      input,
    );

    try {
      return await insertWithReadings(
        db,
        {
          locationId: scope.locationId,
          taskTemplateId: null,
          occurrenceId: null,
          title: form.name,
          formVersionId: latestVersion.id,
          targetId: item?.targetId ?? null,
          targetName: item?.targetName ?? null,
          resolvedLimits,
          entryDate: input.entryDate,
          entryTime: input.entryTime,
          values: judged.values,
          result: judged.result,
          correctiveAction: judged.correctiveAction,
          createdByUserId: scope.actorUserId,
          recordedAt: now,
          recordedByUserId: scope.actorUserId,
        },
        now,
        judged.deviation,
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      mapDbMutationError(error, {
        foreignKey: () => new NotFoundError("Item not found at this location"),
      });
    }
  },

  async update(
    db: Db,
    scope: ActorScope & { recordId: string },
    input: TaskRecordInput,
  ): Promise<TaskRecordResponse> {
    const now = new Date();

    const found = await taskRecordRepository.findRecordForWrite(db, scope);

    if (!found) {
      throw new NotFoundError("Task record not found");
    }

    const { record } = found;

    assertOpened(found.availableAt, now);
    const judged = judgeAnswers(
      { definition: found.definition, resolvedLimits: record.resolvedLimits },
      input,
    );

    return db.transaction(async (tx) => {
      const updated = await taskRecordRepository.updateRecordAnswers(
        tx,
        record.id,
        {
          values: judged.values,
          result: judged.result,
          correctiveAction: judged.correctiveAction,
          recordedAt: now,
          recordedByUserId: scope.actorUserId,
        },
      );

      if (!updated) {
        throw new InternalError("Failed to update task record");
      }

      await taskRecordRepository.replaceReadings(
        tx,
        updated.id,
        toReadingRows({
          recordId: updated.id,
          locationId: updated.locationId,
          targetId: updated.targetId,
          recordedAt: now,
          values: judged.values,
        }),
      );

      await taskRecordRepository.replaceDeviation(
        tx,
        updated.id,
        judged.deviation ? toDeviationRows(updated, judged.deviation) : null,
      );

      return toTaskRecordResponse(
        updated,
        toRecordCorrective(judged.deviation),
      );
    });
  },

  async remove(
    db: Db,
    scope: ActorScope & { recordId: string },
  ): Promise<TaskRecordResponse> {
    const found = await taskRecordRepository.findRecordForWrite(db, scope);

    if (!found || found.record.voidedAt !== null) {
      throw new NotFoundError("Task record not found");
    }

    const voided = await taskRecordRepository.voidActiveRecord(
      db,
      found.record.id,
      { voidedAt: new Date(), voidedByUserId: scope.actorUserId },
    );

    if (!voided) {
      throw new NotFoundError("Task record not found");
    }

    return toTaskRecordResponse(voided);
  },
};
