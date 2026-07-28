import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "../../core/db/client.js";
import type { Location } from "../../core/db/schema/locations.js";
import { locations } from "../../core/db/schema/locations.js";
import type { Organization } from "../../core/db/schema/organizations.js";
import { organizations } from "../../core/db/schema/organizations.js";

export type TenantDbRow = {
  organization: Organization;
  locations: Location[];
};

export const tenantRepository = {
  async findByClerkOrgIdWithLocations(
    db: Db,
    clerkOrgId: string,
  ): Promise<TenantDbRow | null> {
    const rows = await db
      .select({
        organization: organizations,
        location: locations,
      })
      .from(organizations)
      .leftJoin(locations, eq(locations.organizationId, organizations.id))
      .where(
        and(
          eq(organizations.clerkOrgId, clerkOrgId),
          isNull(organizations.deletedAt),
        ),
      )
      .orderBy(asc(locations.name));

    if (rows.length === 0) {
      return null;
    }

    const organization = rows[0]!.organization;
    const locationRows = rows
      .map((row) => row.location)
      .filter((location): location is Location => location !== null);

    return {
      organization,
      locations: locationRows,
    };
  },
};
