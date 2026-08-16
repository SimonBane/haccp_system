import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { organizationMemberLocations } from "../../core/db/schema/organization-member-locations.js";
import { organizationMemberships } from "../../core/db/schema/organization-memberships.js";
import type { MembershipStatus } from "../../core/db/schema/organization-memberships.js";
import { organizations } from "../../core/db/schema/organizations.js";
import { users } from "../../core/db/schema/users.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import type { User } from "../../core/db/schema/users.js";

export type MembershipWithUserRow = {
  membership: OrganizationMembership;
  user: User;
  locationIds: string[];
};

export type MembershipWithUser = {
  membership: OrganizationMembership;
  user: User;
};

const locationIdsAgg = sql<string[]>`coalesce(
  array_agg(${organizationMemberLocations.locationId})
  filter (where ${organizationMemberLocations.locationId} is not null),
  array[]::uuid[]
)`.mapWith((value) => (Array.isArray(value) ? value : []));

export type MembershipContextRow = {
  membership: OrganizationMembership;
  user: User;
  locationIds: string[];
};

function selectMembershipContext(db: Db) {
  return db
    .select({
      membership: organizationMemberships,
      user: users,
      locationIds: locationIdsAgg,
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(organizationMemberships.userId, users.id))
    .leftJoin(
      organizationMemberLocations,
      eq(organizationMemberLocations.membershipId, organizationMemberships.id),
    );
}

export const employeeRepository = {
  async findManyWithUsersByOrganizationId(
    db: Db,
    organizationId: string,
  ): Promise<MembershipWithUserRow[]> {
    const rows = await db
      .select({
        membership: organizationMemberships,
        user: users,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .orderBy(organizationMemberships.createdAt);

    if (rows.length === 0) {
      return [];
    }

    const membershipIds = rows.map((row) => row.membership.id);
    const assignmentRows = await db
      .select()
      .from(organizationMemberLocations)
      .where(inArray(organizationMemberLocations.membershipId, membershipIds));

    const locationIdsByMembership = new Map<string, string[]>();

    for (const row of assignmentRows) {
      const existing = locationIdsByMembership.get(row.membershipId) ?? [];
      existing.push(row.locationId);
      locationIdsByMembership.set(row.membershipId, existing);
    }

    return rows.map((row) => ({
      membership: row.membership,
      user: row.user,
      locationIds: locationIdsByMembership.get(row.membership.id) ?? [],
    }));
  },

  async findDetailById(db: Db, organizationId: string, membershipId: string) {
    const [row] = await selectMembershipContext(db)
      .where(
        and(
          eq(organizationMemberships.id, membershipId),
          eq(organizationMemberships.organizationId, organizationId),
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .groupBy(organizationMemberships.id, users.id)
      .limit(1);

    return row ?? null;
  },

  // Provisioning finders must see tombstones so they can restore them.
  async findMembershipContextByClerkUserId(
    db: Db,
    organizationId: string,
    clerkUserId: string,
  ): Promise<MembershipContextRow | null> {
    const [row] = await selectMembershipContext(db)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(users.clerkUserId, clerkUserId),
        ),
      )
      .groupBy(organizationMemberships.id, users.id)
      .limit(1);

    return row ?? null;
  },

  async findMembershipContextByEmail(
    db: Db,
    organizationId: string,
    email: string,
  ): Promise<MembershipContextRow | null> {
    const [row] = await selectMembershipContext(db)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          sql`lower(${users.email}) = lower(${email})`,
        ),
      )
      .groupBy(organizationMemberships.id, users.id)
      .limit(1);

    return row ?? null;
  },

  async findMembershipWithUserById(
    db: Db,
    organizationId: string,
    membershipId: string,
  ): Promise<MembershipWithUser | null> {
    const [row] = await db
      .select({
        membership: organizationMemberships,
        user: users,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(
        and(
          eq(organizationMemberships.id, membershipId),
          eq(organizationMemberships.organizationId, organizationId),
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },


  async insert(
    db: DbClient,
    data: typeof organizationMemberships.$inferInsert,
  ) {
    const [created] = await db
      .insert(organizationMemberships)
      .values(data)
      .returning();

    return created ?? null;
  },

  async updateById(
    db: DbClient,
    membershipId: string,
    updates: Partial<typeof organizationMemberships.$inferInsert>,
  ) {
    const [updated] = await db
      .update(organizationMemberships)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizationMemberships.id, membershipId))
      .returning();

    return updated ?? null;
  },

  async updateByIdAndOrganization(
    db: DbClient,
    organizationId: string,
    membershipId: string,
    updates: Partial<typeof organizationMemberships.$inferInsert>,
  ) {
    const [updated] = await db
      .update(organizationMemberships)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(organizationMemberships.id, membershipId),
          eq(organizationMemberships.organizationId, organizationId),
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .returning();

    return updated ?? null;
  },

  async updateStatusByIdAndOrganization(
    db: DbClient,
    organizationId: string,
    membershipId: string,
    expectedStatus: MembershipStatus,
    updates: Partial<typeof organizationMemberships.$inferInsert>,
  ) {
    const [updated] = await db
      .update(organizationMemberships)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(organizationMemberships.id, membershipId),
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.status, expectedStatus),
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .returning();

    return updated ?? null;
  },

  async softDeleteById(db: DbClient, membershipId: string) {
    const [updated] = await db
      .update(organizationMemberships)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(organizationMemberships.id, membershipId))
      .returning();

    return updated ?? null;
  },

  async softDeleteByIdAndOrganization(
    db: DbClient,
    organizationId: string,
    membershipId: string,
  ) {
    const [updated] = await db
      .update(organizationMemberships)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(organizationMemberships.id, membershipId),
          eq(organizationMemberships.organizationId, organizationId),
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .returning();

    return updated ?? null;
  },

  async replaceLocationAssignments(
    db: DbClient,
    membershipId: string,
    organizationId: string,
    locationIds: string[],
  ) {
    await db
      .delete(organizationMemberLocations)
      .where(eq(organizationMemberLocations.membershipId, membershipId));

    if (locationIds.length === 0) {
      return;
    }

    await db.insert(organizationMemberLocations).values(
      locationIds.map((locationId) => ({
        membershipId,
        locationId,
        organizationId,
      })),
    );
  },

  async findMembershipByClerkIds(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
  ) {
    const [row] = await db
      .select({
        membership: organizationMemberships,
        organizationId: organizations.id,
        userId: users.id,
      })
      .from(organizationMemberships)
      .innerJoin(
        organizations,
        eq(organizationMemberships.organizationId, organizations.id),
      )
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(
        and(
          eq(organizations.clerkOrgId, clerkOrgId),
          eq(users.clerkUserId, clerkUserId),
          isNull(organizationMemberships.deletedAt),
          isNull(organizations.deletedAt),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },
};
