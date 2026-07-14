import type { LocationResponse } from "@haccp/shared";
import { sql } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { locations } from "../db/schema/locations.js";

const DEFAULT_LOCATION_NAME = "Main site";

function toLocationResponse(location: typeof locations.$inferSelect): LocationResponse {
  return {
    id: location.id,
    orgId: location.orgId,
    name: location.name,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  };
}

export const locationService = {
  async getOrCreateCurrentLocation(
    db: Db,
    orgId: string,
  ): Promise<LocationResponse> {
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

    if (!location) {
      throw new Error("Failed to resolve location");
    }

    return toLocationResponse(location);
  },
};
