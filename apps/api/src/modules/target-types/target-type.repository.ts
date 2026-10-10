import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../core/db/client.js";
import { targetTypes } from "../../core/db/schema/target-types.js";
import { targets } from "../../core/db/schema/targets.js";

export const targetTypeRepository = {
  async findManyActiveByOrganization(db: DbClient, organizationId: string) {
    return db
      .select()
      .from(targetTypes)
      .where(
        and(
          eq(targetTypes.organizationId, organizationId),
          isNull(targetTypes.archivedAt),
        ),
      )
      .orderBy(asc(targetTypes.name));
  },

  async insert(db: DbClient, data: typeof targetTypes.$inferInsert) {
    const [created] = await db.insert(targetTypes).values(data).returning();
    return created ?? null;
  },

  async updateActive(
    db: DbClient,
    organizationId: string,
    targetTypeId: string,
    updates: Partial<typeof targetTypes.$inferInsert>,
  ) {
    const [updated] = await db
      .update(targetTypes)
      .set(updates)
      .where(
        and(
          eq(targetTypes.id, targetTypeId),
          eq(targetTypes.organizationId, organizationId),
          isNull(targetTypes.archivedAt),
        ),
      )
      .returning();

    return updated ?? null;
  },

  /** Archives only when no active target still uses the type, in one conditional write. */
  async archiveIfUnused(
    db: DbClient,
    organizationId: string,
    targetTypeId: string,
  ): Promise<"archived" | "in_use" | "not_found"> {
    const now = new Date();
    const [archived] = await db
      .update(targetTypes)
      .set({ archivedAt: now, updatedAt: now })
      .where(
        and(
          eq(targetTypes.id, targetTypeId),
          eq(targetTypes.organizationId, organizationId),
          isNull(targetTypes.archivedAt),
          sql`NOT EXISTS (SELECT 1 FROM ${targets} WHERE ${targets.targetTypeId} = ${targetTypes.id} AND ${targets.archivedAt} IS NULL)`,
        ),
      )
      .returning({ id: targetTypes.id });

    if (archived) return "archived";

    const [existing] = await db
      .select({ id: targetTypes.id })
      .from(targetTypes)
      .where(
        and(
          eq(targetTypes.id, targetTypeId),
          eq(targetTypes.organizationId, organizationId),
          isNull(targetTypes.archivedAt),
        ),
      )
      .limit(1);

    return existing ? "in_use" : "not_found";
  },
};
