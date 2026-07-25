import type {
  CreateEquipmentInput,
  EquipmentListResponse,
  EquipmentResponse,
  UpdateEquipmentInput,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { equipment } from "../../core/db/schema/equipment.js";
import {
  ConflictError,
  InternalError,
  NotFoundError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { locationService } from "../locations/location.service.js";
import { toEquipmentResponse } from "./equipment.mapper.js";
import { equipmentRepository } from "./equipment.repository.js";

export const equipmentService = {
  async list(db: Db, orgId: string): Promise<EquipmentListResponse> {
    const location = await locationService.getOrCreateCurrentLocation(db, orgId);
    const rows = await equipmentRepository.findManyByOrgAndLocation(
      db,
      orgId,
      location.id,
    );

    return {
      items: rows.map(toEquipmentResponse),
    };
  },

  async create(
    db: Db,
    orgId: string,
    input: CreateEquipmentInput,
  ): Promise<EquipmentResponse> {
    await locationService.assertLocationBelongsToOrg(
      db,
      orgId,
      input.locationId,
    );

    try {
      const created = await equipmentRepository.insert(db, {
        orgId,
        locationId: input.locationId,
        name: input.name,
        type: input.type,
        minTempC: String(input.minTempC),
        maxTempC: String(input.maxTempC),
      });

      if (!created) {
        throw new InternalError("Failed to create equipment");
      }

      return toEquipmentResponse(created);
    } catch (error) {
      mapDbMutationError(error, {
        unique: () =>
          new ConflictError(
            "Equipment with this name already exists at this site",
          ),
        foreignKey: () => new NotFoundError("Location not found"),
      });
    }
  },

  async update(
    db: Db,
    orgId: string,
    equipmentId: string,
    input: UpdateEquipmentInput,
  ): Promise<EquipmentResponse> {
    const updates: Partial<typeof equipment.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.type !== undefined) updates.type = input.type;
    if (input.minTempC !== undefined) {
      updates.minTempC = String(input.minTempC);
    }
    if (input.maxTempC !== undefined) {
      updates.maxTempC = String(input.maxTempC);
    }

    try {
      const updated = await equipmentRepository.updateByIdAndOrg(
        db,
        orgId,
        equipmentId,
        updates,
      );

      if (!updated) {
        throw new NotFoundError("Equipment not found");
      }

      return toEquipmentResponse(updated);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      mapDbMutationError(error, {
        unique: () =>
          new ConflictError(
            "Equipment with this name already exists at this site",
          ),
        foreignKey: () => new NotFoundError("Location not found"),
      });
    }
  },

  async delete(db: Db, orgId: string, equipmentId: string): Promise<void> {
    const deleted = await equipmentRepository.deleteByIdAndOrg(
      db,
      orgId,
      equipmentId,
    );

    if (!deleted) {
      throw new NotFoundError("Equipment not found");
    }
  },
};
