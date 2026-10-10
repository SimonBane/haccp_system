import type {
  TargetTypeInput,
  TargetTypeListResponse,
  TargetTypeResponse,
} from "@haccp/shared";
import { API_ERROR_CODE } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import {
  ConflictError,
  InternalError,
  NotFoundError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { toTargetTypeResponse } from "./target-type.mapper.js";
import { targetTypeRepository } from "./target-type.repository.js";

function nameExists(): ConflictError {
  return new ConflictError("A type with this name already exists", {
    code: API_ERROR_CODE.TARGET_TYPE_NAME_EXISTS,
  });
}

export const targetTypeService = {
  async list(db: Db, organizationId: string): Promise<TargetTypeListResponse> {
    const rows = await targetTypeRepository.findManyActiveByOrganization(
      db,
      organizationId,
    );
    return { items: rows.map(toTargetTypeResponse) };
  },

  async create(
    db: Db,
    organizationId: string,
    input: TargetTypeInput,
  ): Promise<TargetTypeResponse> {
    try {
      const created = await targetTypeRepository.insert(db, {
        organizationId,
        name: input.name,
        kind: input.kind,
      });

      if (!created) {
        throw new InternalError("Failed to create target type");
      }

      return toTargetTypeResponse(created);
    } catch (error) {
      mapDbMutationError(error, { unique: nameExists });
    }
  },

  async update(
    db: Db,
    organizationId: string,
    targetTypeId: string,
    input: TargetTypeInput,
  ): Promise<TargetTypeResponse> {
    let updated;
    try {
      updated = await targetTypeRepository.updateActive(
        db,
        organizationId,
        targetTypeId,
        { name: input.name, kind: input.kind, updatedAt: new Date() },
      );
    } catch (error) {
      mapDbMutationError(error, { unique: nameExists });
    }

    if (!updated) {
      throw new NotFoundError("Target type not found");
    }

    return toTargetTypeResponse(updated);
  },

  async delete(
    db: Db,
    organizationId: string,
    targetTypeId: string,
  ): Promise<void> {
    const outcome = await targetTypeRepository.archiveIfUnused(
      db,
      organizationId,
      targetTypeId,
    );

    if (outcome === "not_found") {
      throw new NotFoundError("Target type not found");
    }

    if (outcome === "in_use") {
      throw new ConflictError(
        "Equipment or areas still use this type; move or archive them first",
        { code: API_ERROR_CODE.TARGET_TYPE_IN_USE },
      );
    }
  },
};
