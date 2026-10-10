import { and, asc, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../core/db/client.js";
import { locations } from "../../core/db/schema/locations.js";
import { targetTypes } from "../../core/db/schema/target-types.js";
import { targets } from "../../core/db/schema/targets.js";
import { taskTemplateTargets } from "../../core/db/schema/task-template-targets.js";
import { taskTemplates } from "../../core/db/schema/task-templates.js";

export type TargetWithTypeRow = {
  target: typeof targets.$inferSelect;
  targetTypeName: string;
  kind: string;
};

const targetWithTypeColumns = {
  target: targets,
  targetTypeName: targetTypes.name,
  kind: targetTypes.kind,
};

export const targetRepository = {
  async findManyActiveByLocation(
    db: DbClient,
    locationId: string,
  ): Promise<TargetWithTypeRow[]> {
    return db
      .select(targetWithTypeColumns)
      .from(targets)
      .innerJoin(targetTypes, eq(targetTypes.id, targets.targetTypeId))
      .where(
        and(eq(targets.locationId, locationId), isNull(targets.archivedAt)),
      )
      .orderBy(asc(targets.name));
  },

  async findActiveById(
    db: DbClient,
    locationId: string,
    targetId: string,
  ): Promise<TargetWithTypeRow | null> {
    const [row] = await db
      .select(targetWithTypeColumns)
      .from(targets)
      .innerJoin(targetTypes, eq(targetTypes.id, targets.targetTypeId))
      .where(
        and(
          eq(targets.id, targetId),
          eq(targets.locationId, locationId),
          isNull(targets.archivedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  /** A type is usable at a location when it is active and belongs to that location's organisation. */
  async findActiveTypeForLocation(
    db: DbClient,
    locationId: string,
    targetTypeId: string,
  ): Promise<{ id: string } | null> {
    const [row] = await db
      .select({ id: targetTypes.id })
      .from(targetTypes)
      .innerJoin(
        locations,
        eq(locations.organizationId, targetTypes.organizationId),
      )
      .where(
        and(
          eq(targetTypes.id, targetTypeId),
          eq(locations.id, locationId),
          isNull(targetTypes.archivedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async hasActiveChildren(db: DbClient, targetId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: targets.id })
      .from(targets)
      .where(and(eq(targets.parentId, targetId), isNull(targets.archivedAt)))
      .limit(1);

    return row !== undefined;
  },

  async insert(db: DbClient, data: typeof targets.$inferInsert) {
    const [created] = await db.insert(targets).values(data).returning();
    return created ?? null;
  },

  async updateActive(
    db: DbClient,
    locationId: string,
    targetId: string,
    updates: Partial<typeof targets.$inferInsert>,
  ) {
    const [updated] = await db
      .update(targets)
      .set(updates)
      .where(
        and(
          eq(targets.id, targetId),
          eq(targets.locationId, locationId),
          isNull(targets.archivedAt),
        ),
      )
      .returning({ id: targets.id });

    return updated ?? null;
  },

  async archive(db: DbClient, locationId: string, targetId: string) {
    const now = new Date();
    const [archived] = await db
      .update(targets)
      .set({ archivedAt: now, updatedAt: now })
      .where(
        and(
          eq(targets.id, targetId),
          eq(targets.locationId, locationId),
          isNull(targets.archivedAt),
        ),
      )
      .returning({ id: targets.id });

    return archived ?? null;
  },

  async findActiveTemplateIdsByTarget(
    db: DbClient,
    targetId: string,
  ): Promise<string[]> {
    const rows = await db
      .select({ id: taskTemplateTargets.taskTemplateId })
      .from(taskTemplateTargets)
      .innerJoin(
        taskTemplates,
        eq(taskTemplates.id, taskTemplateTargets.taskTemplateId),
      )
      .where(
        and(
          eq(taskTemplateTargets.targetId, targetId),
          isNull(taskTemplates.archivedAt),
        ),
      );

    return rows.map((row) => row.id);
  },

  async deleteTemplateLinks(db: DbClient, targetId: string): Promise<string[]> {
    const rows = await db
      .delete(taskTemplateTargets)
      .where(eq(taskTemplateTargets.targetId, targetId))
      .returning({ id: taskTemplateTargets.taskTemplateId });

    return rows.map((row) => row.id);
  },
};
