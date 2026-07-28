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
  ValidationError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { equipmentRepository } from "../equipment/equipment.repository.js";
import { locationService } from "../locations/location.service.js";
import { toTaskTemplateResponse } from "./task-template.mapper.js";
import { taskTemplateRepository } from "./task-template.repository.js";

async function resolveEquipmentForTemplate(
  db: Db,
  locationId: string,
  equipmentId: string,
): Promise<{ id: string; name: string }> {
  const matched = await equipmentRepository.findByIdAndLocation(
    db,
    locationId,
    equipmentId,
  );

  if (!matched) {
    throw new NotFoundError("Equipment not found");
  }

  return matched;
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
    organizationId: string,
    input: CreateTaskTemplateInput,
  ): Promise<TaskTemplateResponse> {
    const [, resolvedEquipment] = await Promise.all([
      locationService.assertLocationBelongsToOrganization(
        db,
        organizationId,
        input.locationId,
      ),
      input.equipmentId
        ? resolveEquipmentForTemplate(db, input.locationId, input.equipmentId)
        : Promise.resolve(null),
    ]);

    try {
      const created = await taskTemplateRepository.insert(db, {
        locationId: input.locationId,
        title: input.title,
        type: input.type,
        weekdays: sortWeekdays(input.weekdays),
        scheduledTimes: sortScheduledTimes(input.scheduledTimes),
        equipmentId: input.equipmentId ?? null,
      });

      if (!created) {
        throw new InternalError("Failed to create task template");
      }

      return toTaskTemplateResponse(
        created,
        resolvedEquipment?.name ?? null,
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      mapDbMutationError(error, {
        foreignKey: () => new NotFoundError("Equipment or location not found"),
      });
    }
  },

  async update(
    db: Db,
    locationId: string,
    taskTemplateId: string,
    input: UpdateTaskTemplateInput,
  ): Promise<TaskTemplateResponse> {
    const existing = await taskTemplateRepository.findByIdAndLocation(
      db,
      locationId,
      taskTemplateId,
    );

    if (!existing) {
      throw new NotFoundError("Task template not found");
    }

    const nextType =
      input.type ?? (existing.type as TaskTemplateResponse["type"]);
    const nextEquipmentId =
      input.equipmentId !== undefined
        ? input.equipmentId
        : existing.equipmentId;

    if (nextType === "temperature" && !nextEquipmentId) {
      throw new ValidationError("Equipment is required for temperature tasks");
    }

    let resolvedEquipment: { id: string; name: string } | null = null;

    if (nextEquipmentId) {
      resolvedEquipment = await resolveEquipmentForTemplate(
        db,
        existing.locationId,
        nextEquipmentId,
      );
    }

    const updates: Partial<typeof taskTemplates.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updates.title = input.title;
    if (input.type !== undefined) updates.type = input.type;
    if (input.weekdays !== undefined) {
      updates.weekdays = sortWeekdays(input.weekdays);
    }
    if (input.scheduledTimes !== undefined) {
      updates.scheduledTimes = sortScheduledTimes(input.scheduledTimes);
    }
    if (input.equipmentId !== undefined) {
      updates.equipmentId = input.equipmentId;
    } else if (input.type !== undefined && input.type !== "temperature") {
      updates.equipmentId = null;
    }

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

      return toTaskTemplateResponse(
        updated,
        resolvedEquipment?.name ?? null,
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      mapDbMutationError(error, {
        foreignKey: () => new NotFoundError("Equipment or location not found"),
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
