import { and, asc, eq, sql } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { locations } from "../../core/db/schema/locations.js";

export const DEFAULT_LOCATION_NAME = "Main site";

export const locationRepository = {
  async findByOrganizationId(db: Db, organizationId: string) {
    return db
      .select()
      .from(locations)
      .where(eq(locations.organizationId, organizationId))
      .orderBy(asc(locations.name));
  },

  async findDefaultByOrganizationId(db: Db, organizationId: string) {
    const [row] = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          eq(locations.isDefault, true),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async findByIdAndOrganization(
    db: Db,
    organizationId: string,
    locationId: string,
  ) {
    const [row] = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.organizationId, organizationId),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async countByOrganizationId(db: Db, organizationId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(locations)
      .where(eq(locations.organizationId, organizationId));

    return row?.count ?? 0;
  },

  async insert(db: DbClient, data: typeof locations.$inferInsert) {
    const [created] = await db.insert(locations).values(data).returning();
    return created ?? null;
  },

  async updateByIdAndOrganization(
    db: Db,
    organizationId: string,
    locationId: string,
    updates: Partial<typeof locations.$inferInsert>,
  ) {
    const [updated] = await db
      .update(locations)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.organizationId, organizationId),
        ),
      )
      .returning();

    return updated ?? null;
  },

  async clearDefaultForOrganization(db: Db, organizationId: string) {
    await db
      .update(locations)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(locations.organizationId, organizationId));
  },

  async deleteByIdAndOrganization(
    db: Db,
    organizationId: string,
    locationId: string,
  ) {
    const [deleted] = await db
      .delete(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.organizationId, organizationId),
        ),
      )
      .returning({ id: locations.id });

    return deleted ?? null;
  },
};
