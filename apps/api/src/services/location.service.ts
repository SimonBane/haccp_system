import type { LocationResponse } from "@haccp/shared";
import { eq } from "drizzle-orm";
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
    const existing = await db.query.locations.findFirst({
      where: eq(locations.orgId, orgId),
    });

    if (existing) {
      return toLocationResponse(existing);
    }

    const [created] = await db
      .insert(locations)
      .values({
        orgId,
        name: DEFAULT_LOCATION_NAME,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create location");
    }

    return toLocationResponse(created);
  },
};
