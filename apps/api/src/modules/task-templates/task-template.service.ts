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

async function assertEquipmentForTemplate(
  db: Db,
  orgId: string,
  locationId: string,
  equipmentId: string,
): Promise<void> {
  const matched = await equipmentRepository.findByIdAndOrgAndLocation(
    db,
    orgId,
    locationId,
    equipmentId,
  );

  if (!matched) {
    throw new NotFoundError("Equipment not found");
  }
}

export const taskTemplateService = {
  async list(db: Db, orgId: string): Promise<TaskTemplateListResponse> {
    const location = await locationService.getOrCreateCurrentLocation(db, orgId);
    const rows =
      await taskTemplateRepository.findManyWithEquipmentByOrgAndLocation(
        db,
        orgId,
        location.id,
      );

    return {
      items: rows.map((row) =>
        toTaskTemplateResponse(row.template, row.equipmentName),
      ),
    };
  },

  async create(
    db: Db,
    orgId: string,
    input: CreateTaskTemplateInput,
  ): Promise<TaskTemplateResponse> {
    await locationService.assertLocationBelongsToOrg(
      db,
      orgId,
      input.locationId,
    );

    if (input.equipmentId) {
      await assertEquipmentForTemplate(
        db,
        orgId,
        input.locationId,
        input.equipmentId,
      );
    }

    try {
      const created = await taskTemplateRepository.insert(db, {
        orgId,
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

      let equipmentName: string | null = null;
      if (created.equipmentId) {
        equipmentName = await taskTemplateRepository.findEquipmentNameById(
          db,
          created.equipmentId,
        );
      }

      return toTaskTemplateResponse(created, equipmentName);
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
    orgId: string,
    taskTemplateId: string,
    input: UpdateTaskTemplateInput,
  ): Promise<TaskTemplateResponse> {
    const existing = await taskTemplateRepository.findByIdAndOrg(
      db,
      orgId,
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

    if (nextEquipmentId) {
      await assertEquipmentForTemplate(
        db,
        orgId,
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
      const updated = await taskTemplateRepository.updateByIdAndOrg(
        db,
        orgId,
        taskTemplateId,
        updates,
      );

      if (!updated) {
        throw new NotFoundError("Task template not found");
      }

      let equipmentName: string | null = null;
      if (updated.equipmentId) {
        equipmentName = await taskTemplateRepository.findEquipmentNameById(
          db,
          updated.equipmentId,
        );
      }

      return toTaskTemplateResponse(updated, equipmentName);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      mapDbMutationError(error, {
        foreignKey: () => new NotFoundError("Equipment or location not found"),
      });
    }
  },

  async delete(db: Db, orgId: string, taskTemplateId: string): Promise<void> {
    const deleted = await taskTemplateRepository.deleteByIdAndOrg(
      db,
      orgId,
      taskTemplateId,
    );

    if (!deleted) {
      throw new NotFoundError("Task template not found");
    }
  },
};
