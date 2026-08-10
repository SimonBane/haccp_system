import { and, asc, eq } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { locations } from "../../core/db/schema/locations.js";

export const DEFAULT_LOCATION_NAME = "Main site";

export const locationRepository = {
  async findByOrganizationId(db: DbClient, organizationId: string) {
    return db
      .select()
      .from(locations)
      .where(eq(locations.organizationId, organizationId))
      .orderBy(asc(locations.name));
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
