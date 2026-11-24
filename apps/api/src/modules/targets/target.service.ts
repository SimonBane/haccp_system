import { randomUUID } from "node:crypto";
import type {
  TargetDuplicateInput,
  TargetInput,
  TargetListResponse,
  TargetResponse,
} from "@haccp/shared";
import { API_ERROR_CODE, TARGET_KIND } from "@haccp/shared";
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
import {
  targetRepository,
  type TargetHierarchyRow,
} from "./target.repository.js";

function nameExists(): ConflictError {
  return new ConflictError("This name is already used here", {
    code: API_ERROR_CODE.TARGET_NAME_EXISTS,
  });
}

/** Parent must be an active area here, and following parents up from it must never reach `selfId`. */
function assertParentValid(
  hierarchy: TargetHierarchyRow[],
  parentId: string | null,
  selfId: string | null,
): void {
  if (parentId === null) return;

  if (parentId === selfId) {
    throw new ValidationError("A target cannot be its own parent");
  }

  const byId = new Map(hierarchy.map((row) => [row.id, row]));
  const parent = byId.get(parentId);

  if (!parent) {
    throw new NotFoundError("Parent area not found");
  }

  if (parent.kind !== TARGET_KIND.AREA) {
    throw new ValidationError("Only an area can contain other items", {
      code: API_ERROR_CODE.TARGET_PARENT_NOT_AREA,
    });
  }

  const seen = new Set<string>();
  let current: string | null | undefined = parentId;
  while (current) {
    if (current === selfId || seen.has(current)) {
      throw new ValidationError("A target cannot be nested inside itself");
    }
    seen.add(current);
    current = byId.get(current)?.parentId;
  }
}

/** The named contents in parent-first order; each must sit in the source or in another copied item. */
function orderContents(
  hierarchy: TargetHierarchyRow[],
  sourceId: string,
  contents: TargetDuplicateInput["contents"],
): { source: TargetHierarchyRow; name: string }[] {
  const byId = new Map(hierarchy.map((row) => [row.id, row]));
  const named = new Map(contents.map((item) => [item.sourceId, item.name]));
  const ordered: { source: TargetHierarchyRow; name: string }[] = [];
  let level = [sourceId];

  while (level.length > 0) {
    const parents = new Set(level);
    const next = hierarchy.filter(
      (row) =>
        row.parentId !== null && parents.has(row.parentId) && named.has(row.id),
    );
    for (const row of next) {
      ordered.push({ source: row, name: named.get(row.id)! });
    }
    level = next.map((row) => row.id);
  }

  if (
    ordered.length !== contents.length ||
    contents.some((item) => !byId.has(item.sourceId))
  ) {
    throw new ValidationError(
      "Only items inside the copied area, together with the area holding each, can be copied along",
    );
  }
  return ordered;
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

function mapWriteError(error: unknown): never {
  if (error instanceof AppError) throw error;
  mapDbMutationError(error, {
    unique: nameExists,
    foreignKey: () => new NotFoundError("Parent area not found"),
  });
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
    const hierarchy = await targetRepository.findActiveHierarchyByLocation(
      db,
      locationId,
    );
    assertParentValid(hierarchy, input.parentId, null);

    try {
      const created = await targetRepository.insert(db, {
        locationId,
        name: input.name,
        kind: input.kind,
        parentId: input.parentId,
        limits: input.limits,
      });

      if (!created) {
        throw new InternalError("Failed to create target");
      }

      return await loadResponse(db, locationId, created.id);
    } catch (error) {
      mapWriteError(error);
    }
  },

  async update(
    db: Db,
    locationId: string,
    targetId: string,
    input: TargetInput,
  ): Promise<TargetResponse> {
    try {
      return await db.transaction(async (tx) => {
        const hierarchy = await targetRepository.findActiveHierarchyByLocation(
          tx,
          locationId,
        );
        const current = hierarchy.find((row) => row.id === targetId);

        if (!current) {
          throw new NotFoundError("Target not found");
        }

        assertParentValid(hierarchy, input.parentId, targetId);

        if (
          current.kind !== input.kind &&
          hierarchy.some((row) => row.parentId === targetId)
        ) {
          throw new ConflictError(
            "Move the items inside this area before changing what it is",
            { code: API_ERROR_CODE.TARGET_KIND_IN_USE },
          );
        }

        const updated = await targetRepository.updateActive(
          tx,
          locationId,
          targetId,
          {
            name: input.name,
            kind: input.kind,
            parentId: input.parentId,
            limits: input.limits,
            updatedAt: new Date(),
          },
        );

        if (!updated) {
          throw new NotFoundError("Target not found");
        }

        // Occurrences copy the target's name and limits, and a component's copies its area's name, so upcoming ones are rebuilt.
        const componentIds =
          current.name === input.name
            ? []
            : hierarchy
                .filter(
                  (row) =>
                    row.parentId === targetId &&
                    row.kind === TARGET_KIND.COMPONENT,
                )
                .map((row) => row.id);
        const templateIds =
          await targetRepository.findActiveTemplateIdsByTargets(tx, [
            targetId,
            ...componentIds,
          ]);
        await taskOccurrenceService.reconcileTemplatesAtLocation(
          tx,
          locationId,
          templateIds,
        );

        return loadResponse(tx, locationId, targetId);
      });
    } catch (error) {
      mapWriteError(error);
    }
  },

  /** Copies an item, and the named items inside it with their nesting and ranges, in one transaction. */
  async duplicate(
    db: Db,
    locationId: string,
    sourceId: string,
    input: TargetDuplicateInput,
  ): Promise<TargetResponse> {
    try {
      return await db.transaction(async (tx) => {
        const hierarchy = await targetRepository.findActiveHierarchyByLocation(
          tx,
          locationId,
        );

        if (!hierarchy.some((row) => row.id === sourceId)) {
          throw new NotFoundError("Target not found");
        }

        assertParentValid(hierarchy, input.target.parentId, null);

        if (
          input.contents.length > 0 &&
          input.target.kind !== TARGET_KIND.AREA
        ) {
          throw new ValidationError("Only an area can contain other items", {
            code: API_ERROR_CODE.TARGET_PARENT_NOT_AREA,
          });
        }

        const contents = orderContents(hierarchy, sourceId, input.contents);
        const copyIds = new Map<string, string>([[sourceId, randomUUID()]]);
        for (const { source } of contents) copyIds.set(source.id, randomUUID());
        const copyId = copyIds.get(sourceId)!;

        await targetRepository.insertMany(tx, [
          { id: copyId, locationId, ...input.target },
          ...contents.map(({ source, name }) => ({
            id: copyIds.get(source.id)!,
            locationId,
            name,
            kind: source.kind,
            parentId: copyIds.get(source.parentId!)!,
            limits: source.limits,
          })),
        ]);

        return loadResponse(tx, locationId, copyId);
      });
    } catch (error) {
      mapWriteError(error);
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
