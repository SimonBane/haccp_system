import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { locations } from "../../core/db/schema/locations.js";
import { organizationMemberLocations } from "../../core/db/schema/organization-member-locations.js";
import {
  MEMBERSHIP_STATUS,
  organizationMemberships,
} from "../../core/db/schema/organization-memberships.js";
import { organizations } from "../../core/db/schema/organizations.js";
import { users } from "../../core/db/schema/users.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import type { User } from "../../core/db/schema/users.js";

export type MembershipWithUserRow = {
  membership: OrganizationMembership;
  user: User;
  locationIds: string[];
};

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

    if (!row) {
      return null;
    }

    const locationIds = await this.getLocationIdsForMembership(db, membershipId);

    return {
      ...row,
      locationIds,
    };
  },

  async findById(db: Db, organizationId: string, membershipId: string) {
    const [row] = await db
      .select()
      .from(organizationMemberships)
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

  async findByEmail(db: Db, organizationId: string, email: string) {
    const [row] = await db
      .select({
        membership: organizationMemberships,
        user: users,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          sql`lower(${users.email}) = lower(${email})`,
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async findByEmailIncludingDeleted(
    db: Db,
    organizationId: string,
    email: string,
  ) {
    const [row] = await db
      .select({
        membership: organizationMemberships,
        user: users,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          sql`lower(${users.email}) = lower(${email})`,
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async findByInvitationId(db: Db, clerkInvitationId: string) {
    const [row] = await db
      .select({
        membership: organizationMemberships,
        user: users,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(
        and(
          eq(organizationMemberships.clerkInvitationId, clerkInvitationId),
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async findActiveByUserAndOrg(
    db: Db,
    organizationId: string,
    userId: string,
  ) {
    const [row] = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, "active"),
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async findByUserAndOrg(db: Db, organizationId: string, userId: string) {
    const [row] = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async getLocationIdsForMembership(db: Db, membershipId: string) {
    const rows = await db
      .select({ locationId: organizationMemberLocations.locationId })
      .from(organizationMemberLocations)
      .where(eq(organizationMemberLocations.membershipId, membershipId));

    return rows.map((row) => row.locationId);
  },

  async getAssignedLocationIdsForUser(
    db: Db,
    organizationId: string,
    userId: string,
  ): Promise<string[]> {
    const rows = await db
      .select({ locationId: organizationMemberLocations.locationId })
      .from(organizationMemberships)
      .innerJoin(
        organizationMemberLocations,
        eq(
          organizationMemberLocations.membershipId,
          organizationMemberships.id,
        ),
      )
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.userId, userId),
          eq(organizationMemberships.status, "active"),
          isNull(organizationMemberships.deletedAt),
        ),
      );

    return rows.map((row) => row.locationId);
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

  async softDeleteById(db: DbClient, membershipId: string) {
    const [updated] = await db
      .update(organizationMemberships)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(organizationMemberships.id, membershipId))
      .returning();

    return updated ?? null;
  },

  async replaceLocationAssignments(
    db: DbClient,
    membershipId: string,
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
      })),
    );
  },

  async assertLocationsBelongToOrg(
    db: Db,
    organizationId: string,
    locationIds: string[],
  ) {
    if (locationIds.length === 0) {
      return true;
    }

    const rows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          inArray(locations.id, locationIds),
        ),
      );

    return rows.length === locationIds.length;
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

  async revertInvitationById(db: Db, clerkInvitationId: string) {
    const [updated] = await db
      .update(organizationMemberships)
      .set({
        status: MEMBERSHIP_STATUS.DRAFT,
        clerkInvitationId: null,
        invitedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationMemberships.clerkInvitationId, clerkInvitationId),
          eq(organizationMemberships.status, MEMBERSHIP_STATUS.INVITED),
          isNull(organizationMemberships.deletedAt),
        ),
      )
      .returning();

    return updated ?? null;
  },
};
