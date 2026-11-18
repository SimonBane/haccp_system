import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../core/db/client.js";
import { targets } from "../../core/db/schema/targets.js";
import { taskTemplateTargets } from "../../core/db/schema/task-template-targets.js";
import { taskTemplates } from "../../core/db/schema/task-templates.js";

export type TargetRow = typeof targets.$inferSelect;

export type TargetWithTaskCountRow = {
  target: TargetRow;
  taskCount: number;
};

export type TargetHierarchyRow = Pick<
  TargetRow,
  "id" | "parentId" | "kind" | "name"
>;

function activeTaskCounts(db: DbClient, locationId: string) {
  return db
    .select({
      targetId: taskTemplateTargets.targetId,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(taskTemplateTargets)
    .innerJoin(
      taskTemplates,
      eq(taskTemplates.id, taskTemplateTargets.taskTemplateId),
    )
    .where(
      and(
        eq(taskTemplates.locationId, locationId),
        isNull(taskTemplates.archivedAt),
      ),
    )
    .groupBy(taskTemplateTargets.targetId)
    .as("task_counts");
}

export const targetRepository = {
  async findManyActiveByLocation(
    db: DbClient,
    locationId: string,
  ): Promise<TargetWithTaskCountRow[]> {
    const counts = activeTaskCounts(db, locationId);

    return db
      .select({
        target: targets,
        taskCount: sql<number>`coalesce(${counts.count}, 0)`.mapWith(Number),
      })
      .from(targets)
      .leftJoin(counts, eq(counts.targetId, targets.id))
      .where(
        and(eq(targets.locationId, locationId), isNull(targets.archivedAt)),
      )
      .orderBy(asc(targets.name));
  },

  async findActiveById(
    db: DbClient,
    locationId: string,
    targetId: string,
  ): Promise<TargetWithTaskCountRow | null> {
    const counts = activeTaskCounts(db, locationId);

    const [row] = await db
      .select({
        target: targets,
        taskCount: sql<number>`coalesce(${counts.count}, 0)`.mapWith(Number),
      })
      .from(targets)
      .leftJoin(counts, eq(counts.targetId, targets.id))
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

  async findActiveHierarchyByLocation(
    db: DbClient,
    locationId: string,
  ): Promise<TargetHierarchyRow[]> {
    return db
      .select({
        id: targets.id,
        parentId: targets.parentId,
        kind: targets.kind,
        name: targets.name,
      })
      .from(targets)
      .where(
        and(eq(targets.locationId, locationId), isNull(targets.archivedAt)),
      );
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

  async findActiveTemplateIdsByTargets(
    db: DbClient,
    targetIds: string[],
  ): Promise<string[]> {
    if (targetIds.length === 0) return [];

    const rows = await db
      .selectDistinct({ id: taskTemplates.id })
      .from(taskTemplateTargets)
      .innerJoin(
        taskTemplates,
        eq(taskTemplates.id, taskTemplateTargets.taskTemplateId),
      )
      .where(
        and(
          inArray(taskTemplateTargets.targetId, targetIds),
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
