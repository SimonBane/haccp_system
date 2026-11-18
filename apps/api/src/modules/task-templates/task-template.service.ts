import type {
  CreateTaskTemplateInput,
  FormDefinition,
  TaskTemplateListResponse,
  TaskTemplateResponse,
  UpdateTaskTemplateInput,
} from "@haccp/shared";
import {
  checkMeasurementLimits,
  getMeasurementFields,
  limitsIssueMessage,
  sortScheduledTimes,
  sortWeekdays,
} from "@haccp/shared";
import type { Db, DbClient } from "../../core/db/client.js";
import {
  AppError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { taskOccurrenceService } from "../task-occurrences/task-occurrence.service.js";
import { toTaskTemplateResponse } from "./task-template.mapper.js";
import {
  taskTemplateRepository,
  type TemplateTargetRow,
} from "./task-template.repository.js";

type TemplateInput = CreateTaskTemplateInput | UpdateTaskTemplateInput;

/** Overrides may only name the form's measurement fields, with limits valid for that field's unit. */
export function assertOverridesFitForm(
  definition: FormDefinition,
  targets: TemplateInput["targets"],
): void {
  const units = new Map(
    getMeasurementFields(definition).map((field) => [field.id, field.unit]),
  );

  for (const target of targets) {
    for (const [fieldId, limits] of Object.entries(target.limitOverrides)) {
      const unit = units.get(fieldId);
      if (!unit) {
        throw new ValidationError(
          `Override for "${fieldId}" does not match a measurement field on this form`,
        );
      }

      const [issue] = checkMeasurementLimits(limits, unit);
      if (issue) {
        throw new ValidationError(
          `Override for "${fieldId}": ${limitsIssueMessage(issue)}`,
        );
      }
    }
  }
}

async function assertInputUsable(
  db: DbClient,
  locationId: string,
  input: TemplateInput,
): Promise<void> {
  const form = await taskTemplateRepository.findActiveFormForLocation(
    db,
    locationId,
    input.formId,
  );

  if (!form) {
    throw new NotFoundError("Form not found");
  }

  const targetIds = input.targets.map((target) => target.targetId);
  const found = await taskTemplateRepository.findActiveTargetIdsAtLocation(
    db,
    locationId,
    targetIds,
  );

  if (targetIds.some((id) => !found.has(id))) {
    throw new NotFoundError("Equipment or area not found");
  }

  assertOverridesFitForm(form.definition, input.targets);
}

function templateColumns(input: TemplateInput) {
  return {
    title: input.title,
    formId: input.formId,
    weekdays: sortWeekdays(input.weekdays),
    scheduledTimes: sortScheduledTimes(input.scheduledTimes),
    completionOpensBeforeMinutes: input.completionOpensBeforeMinutes,
    completionDueAfterMinutes: input.completionDueAfterMinutes,
  };
}

async function loadResponse(
  db: DbClient,
  locationId: string,
  templateId: string,
): Promise<TaskTemplateResponse> {
  const row = await taskTemplateRepository.findActiveWithFormById(
    db,
    locationId,
    templateId,
  );

  if (!row) {
    throw new InternalError("Task template vanished after write");
  }

  const targets = await taskTemplateRepository.findTargetsByTemplateIds(db, [
    templateId,
  ]);

  return toTaskTemplateResponse(row, targets);
}

function mapWriteError(error: unknown): never {
  if (error instanceof AppError) throw error;
  mapDbMutationError(error, {
    foreignKey: () => new NotFoundError("Form, equipment or area not found"),
  });
}

export const taskTemplateService = {
  async list(db: Db, locationId: string): Promise<TaskTemplateListResponse> {
    const rows = await taskTemplateRepository.findManyActiveWithFormByLocation(
      db,
      locationId,
    );
    const targets = await taskTemplateRepository.findTargetsByTemplateIds(
      db,
      rows.map((row) => row.template.id),
    );

    const targetsByTemplate = new Map<string, TemplateTargetRow[]>();
    for (const target of targets) {
      const list = targetsByTemplate.get(target.taskTemplateId) ?? [];
      list.push(target);
      targetsByTemplate.set(target.taskTemplateId, list);
    }

    return {
      items: rows.map((row) =>
        toTaskTemplateResponse(
          row,
          targetsByTemplate.get(row.template.id) ?? [],
        ),
      ),
    };
  },

  async create(
    db: Db,
    locationId: string,
    input: CreateTaskTemplateInput,
  ): Promise<TaskTemplateResponse> {
    await assertInputUsable(db, locationId, input);

    try {
      return await db.transaction(async (tx) => {
        const created = await taskTemplateRepository.insert(tx, {
          locationId,
          ...templateColumns(input),
        });

        if (!created) {
          throw new InternalError("Failed to create task template");
        }

        await taskTemplateRepository.replaceTargets(
          tx,
          created.id,
          locationId,
          input.targets,
        );
        await taskOccurrenceService.reconcileTemplate(
          tx,
          locationId,
          created.id,
        );

        return loadResponse(tx, locationId, created.id);
      });
    } catch (error) {
      mapWriteError(error);
    }
  },

  async update(
    db: Db,
    locationId: string,
    taskTemplateId: string,
    input: UpdateTaskTemplateInput,
  ): Promise<TaskTemplateResponse> {
    await assertInputUsable(db, locationId, input);

    try {
      return await db.transaction(async (tx) => {
        const updated =
          await taskTemplateRepository.updateActiveByIdAndLocation(
            tx,
            locationId,
            taskTemplateId,
            { ...templateColumns(input), updatedAt: new Date() },
          );

        if (!updated) {
          throw new NotFoundError("Task template not found");
        }

        await taskTemplateRepository.replaceTargets(
          tx,
          taskTemplateId,
          locationId,
          input.targets,
        );
        await taskOccurrenceService.reconcileTemplate(
          tx,
          locationId,
          taskTemplateId,
        );

        return loadResponse(tx, locationId, taskTemplateId);
      });
    } catch (error) {
      mapWriteError(error);
    }
  },

  async delete(
    db: Db,
    locationId: string,
    taskTemplateId: string,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const archived = await taskTemplateRepository.archiveByIdAndLocation(
        tx,
        locationId,
        taskTemplateId,
      );

      if (!archived) {
        throw new NotFoundError("Task template not found");
      }

      // An archived template resolves no source, so its future unrecorded occurrences are deleted.
      await taskOccurrenceService.reconcileTemplate(
        tx,
        locationId,
        taskTemplateId,
      );
    });
  },
};
