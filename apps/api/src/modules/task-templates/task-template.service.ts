import type {
  CreateTaskTemplateInput,
  TaskTemplateListResponse,
  TaskTemplateResponse,
  UpdateTaskTemplateInput,
} from "@haccp/shared";
import { sortScheduledTimes, sortWeekdays } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { taskTemplates } from "../../core/db/schema/task-templates.js";
import {
  InternalError,
  NotFoundError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { equipmentRepository } from "../equipment/equipment.repository.js";
import { toTaskTemplateResponse } from "./task-template.mapper.js";
import { taskTemplateRepository } from "./task-template.repository.js";

async function assertEquipmentBelongsToLocation(
  db: Db,
  locationId: string,
  equipmentId: string | null | undefined,
): Promise<void> {
  if (!equipmentId) {
    return;
  }

  const found = await equipmentRepository.findByIdAndLocation(
    db,
    locationId,
    equipmentId,
  );

  if (!found) {
    throw new NotFoundError("Equipment not found");
  }
}

export const taskTemplateService = {
  async list(
    db: Db,
    locationId: string,
  ): Promise<TaskTemplateListResponse> {
    const rows =
      await taskTemplateRepository.findManyWithEquipmentByLocation(
        db,
        locationId,
      );

    return {
      items: rows.map((row) =>
        toTaskTemplateResponse(row.template, row.equipmentName),
      ),
    };
  },

  async create(
    db: Db,
    locationId: string,
    input: CreateTaskTemplateInput,
  ): Promise<TaskTemplateResponse> {
    await assertEquipmentBelongsToLocation(db, locationId, input.equipmentId);

    try {
      const created = await taskTemplateRepository.insert(db, {
        locationId,
        title: input.title,
        type: input.type,
        weekdays: sortWeekdays(input.weekdays),
        scheduledTimes: sortScheduledTimes(input.scheduledTimes),
        equipmentId: input.equipmentId ?? null,
      });

      if (!created) {
        throw new InternalError("Failed to create task template");
      }

      return toTaskTemplateResponse(created, null);
    } catch (error) {
      mapDbMutationError(error, {
        foreignKey: () => new NotFoundError("Equipment not found"),
      });
    }
  },

  async update(
    db: Db,
    locationId: string,
    taskTemplateId: string,
    input: UpdateTaskTemplateInput,
  ): Promise<TaskTemplateResponse> {
    await assertEquipmentBelongsToLocation(db, locationId, input.equipmentId);

    const updates: Partial<typeof taskTemplates.$inferInsert> = {
      updatedAt: new Date(),
      title: input.title,
      type: input.type,
      weekdays: sortWeekdays(input.weekdays),
      scheduledTimes: sortScheduledTimes(input.scheduledTimes),
      equipmentId: input.equipmentId ?? null,
    };

    try {
      const updated = await taskTemplateRepository.updateByIdAndLocation(
        db,
        locationId,
        taskTemplateId,
        updates,
      );

      if (!updated) {
        throw new NotFoundError("Task template not found");
      }

      return toTaskTemplateResponse(updated, null);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      mapDbMutationError(error, {
        foreignKey: () => new NotFoundError("Equipment not found"),
      });
    }
  },

  async delete(
    db: Db,
    locationId: string,
    taskTemplateId: string,
  ): Promise<void> {
    const deleted = await taskTemplateRepository.deleteByIdAndLocation(
      db,
      locationId,
      taskTemplateId,
    );

    if (!deleted) {
      throw new NotFoundError("Task template not found");
    }
  },
};
