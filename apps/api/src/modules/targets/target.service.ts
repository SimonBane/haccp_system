import type {
  TargetInput,
  TargetListResponse,
  TargetResponse,
} from "@haccp/shared";
import { API_ERROR_CODE } from "@haccp/shared";
import type { Db, DbClient } from "../../core/db/client.js";
import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { taskOccurrenceService } from "../task-occurrences/task-occurrence.service.js";
import { toTargetResponse } from "./target.mapper.js";
import { targetRepository } from "./target.repository.js";

function nameExists(): ConflictError {
  return new ConflictError(
    "Equipment or an area with this name already exists here",
    {
      code: API_ERROR_CODE.TARGET_NAME_EXISTS,
    },
  );
}

async function assertTypeUsable(
  db: DbClient,
  locationId: string,
  targetTypeId: string,
): Promise<void> {
  const found = await targetRepository.findActiveTypeForLocation(
    db,
    locationId,
    targetTypeId,
  );

  if (!found) {
    throw new NotFoundError("Target type not found");
  }
}

/** Parent must be an active target here, and following parents up from it must never reach `selfId`. */
async function assertParentValid(
  db: DbClient,
  locationId: string,
  parentId: string | null,
  selfId: string | null,
): Promise<void> {
  if (parentId === null) return;

  if (parentId === selfId) {
    throw new ValidationError("A target cannot be its own parent");
  }

  const rows = await targetRepository.findManyActiveByLocation(db, locationId);
  const parentOf = new Map(
    rows.map((row) => [row.target.id, row.target.parentId]),
  );

  if (!parentOf.has(parentId)) {
    throw new NotFoundError("Parent target not found");
  }

  const seen = new Set<string>();
  let current: string | null | undefined = parentId;
  while (current) {
    if (current === selfId || seen.has(current)) {
      throw new ValidationError("A target cannot be nested inside itself");
    }
    seen.add(current);
    current = parentOf.get(current);
  }
}

async function loadResponse(
  db: DbClient,
  locationId: string,
  targetId: string,
): Promise<TargetResponse> {
  const row = await targetRepository.findActiveById(db, locationId, targetId);

  if (!row) {
    throw new InternalError("Target vanished after write");
  }

  return toTargetResponse(row);
}

export const targetService = {
  async list(db: Db, locationId: string): Promise<TargetListResponse> {
    const rows = await targetRepository.findManyActiveByLocation(
      db,
      locationId,
    );
    return { items: rows.map(toTargetResponse) };
  },

  async create(
    db: Db,
    locationId: string,
    input: TargetInput,
  ): Promise<TargetResponse> {
    await assertTypeUsable(db, locationId, input.targetTypeId);
    await assertParentValid(db, locationId, input.parentId, null);

    try {
      const created = await targetRepository.insert(db, {
        locationId,
        name: input.name,
        targetTypeId: input.targetTypeId,
        parentId: input.parentId,
      });

      if (!created) {
        throw new InternalError("Failed to create target");
      }

      return await loadResponse(db, locationId, created.id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDbMutationError(error, {
        unique: nameExists,
        foreignKey: () => new NotFoundError("Target type or parent not found"),
      });
    }
  },

  async update(
    db: Db,
    locationId: string,
    targetId: string,
    input: TargetInput,
  ): Promise<TargetResponse> {
    await assertTypeUsable(db, locationId, input.targetTypeId);
    await assertParentValid(db, locationId, input.parentId, targetId);

    try {
      return await db.transaction(async (tx) => {
        const updated = await targetRepository.updateActive(
          tx,
          locationId,
          targetId,
          {
            name: input.name,
            targetTypeId: input.targetTypeId,
            parentId: input.parentId,
            updatedAt: new Date(),
          },
        );

        if (!updated) {
          throw new NotFoundError("Target not found");
        }

        // Occurrences copy the target's name, so upcoming ones are rebuilt with the new one.
        const templateIds =
          await targetRepository.findActiveTemplateIdsByTarget(tx, targetId);
        await taskOccurrenceService.reconcileTemplatesAtLocation(
          tx,
          locationId,
          templateIds,
        );

        return loadResponse(tx, locationId, targetId);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDbMutationError(error, {
        unique: nameExists,
        foreignKey: () => new NotFoundError("Target type or parent not found"),
      });
    }
  },

  /** Archives: records keep pointing at it, and templates stop scheduling it. */
  async delete(db: Db, locationId: string, targetId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const archived = await targetRepository.archive(tx, locationId, targetId);

      if (!archived) {
        throw new NotFoundError("Target not found");
      }

      // Checked after the scoped archive so another location's id reads as not found; the throw rolls it back.
      if (await targetRepository.hasActiveChildren(tx, targetId)) {
        throw new ConflictError(
          "Move or archive the items inside this one first",
        );
      }

      const templateIds = await targetRepository.deleteTemplateLinks(
        tx,
        targetId,
      );
      await taskOccurrenceService.reconcileTemplatesAtLocation(
        tx,
        locationId,
        templateIds,
      );
    });
  },
};
