import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../core/db/client.js";
import { locations } from "../../core/db/schema/locations.js";

const DEFAULT_LOCATION_NAME = "Main site";

export const locationRepository = {
  async findByIdAndOrg(db: Db, orgId: string, locationId: string) {
    const [row] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.orgId, orgId)))
      .limit(1);

    return row ?? null;
  },

  async upsertDefaultForOrg(db: Db, orgId: string) {
    const [location] = await db
      .insert(locations)
      .values({
        orgId,
        name: DEFAULT_LOCATION_NAME,
      })
      .onConflictDoUpdate({
        target: locations.orgId,
        set: { orgId: sql`excluded.org_id` },
      })
      .returning();

    return location ?? null;
  },
};
