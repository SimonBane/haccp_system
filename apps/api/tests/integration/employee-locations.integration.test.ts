import { ORG_ROLE } from "@haccp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { membershipCache } from "../../src/modules/employees/membership-cache.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { failRedisCommands } from "./harness/redis.js";
import { apiRequest, asAdmin } from "./harness/request.js";

/**
 * HACCP-58: PATCH /employees/{id}/locations works for any employee status,
 * changes only assigned location IDs, and rejects an empty array for a role
 * that requires at least one location — the rest of the split-endpoint
 * behavior (role, profile) lives in the sibling integration files.
 */
describe("Employee location changes", () => {
  let org: SeededOrg;
  let otherOrg: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "locations" });
    otherOrg = await seedOrganization(db, { slug: "locations-other" });
  });

  it("404s for a membership that does not belong to the organization", async () => {
    const response = await apiRequest(
      `/employees/${otherOrg.employee.membershipId}/locations`,
      {
        method: "PATCH",
        actor: asAdmin(org),
        body: JSON.stringify({ locationIds: [org.locations.main.id] }),
      },
    );

    expect(response.status).toBe(404);
  });

  it("rejects a location from another organization", async () => {
    const response = await apiRequest(
      `/employees/${org.employee.membershipId}/locations`,
      {
        method: "PATCH",
        actor: asAdmin(org),
        body: JSON.stringify({ locationIds: [otherOrg.locations.main.id] }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("rejects an empty array for a role that requires location assignments", async () => {
    const response = await apiRequest(
      `/employees/${org.employee.membershipId}/locations`,
      {
        method: "PATCH",
        actor: asAdmin(org),
        body: JSON.stringify({ locationIds: [] }),
      },
    );

    expect(response.status).toBe(400);

    const assignments = await db.query.organizationMemberLocations.findMany({
      where: (row, { eq }) => eq(row.membershipId, org.employee.membershipId),
    });
    expect(assignments).toHaveLength(1);
  });

  it("accepts an empty array for an admin", async () => {
    const response = await apiRequest(
      `/employees/${org.admin.membershipId}/locations`,
      {
        method: "PATCH",
        actor: asAdmin(org),
        body: JSON.stringify({ locationIds: [] }),
      },
    );

    expect(response.status).toBe(200);
  });

  it("replaces assignments transactionally and changes only locations", async () => {
    const response = await apiRequest(
      `/employees/${org.employee.membershipId}/locations`,
      {
        method: "PATCH",
        actor: asAdmin(org),
        body: JSON.stringify({
          locationIds: [org.locations.main.id, org.locations.annex.id],
        }),
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      locationIds: string[];
      role: string;
      email: string;
    };
    expect(body.locationIds.sort()).toEqual(
      [org.locations.main.id, org.locations.annex.id].sort(),
    );
    expect(body.role).toBe(org.employee.role);
    expect(body.email).toBe(org.employee.email);

    const assignments = await db.query.organizationMemberLocations.findMany({
      where: (row, { eq }) => eq(row.membershipId, org.employee.membershipId),
    });
    expect(assignments).toHaveLength(2);
  });

  it("invalidates a warm membership cache entry after a location change", async () => {
    await membershipCache.set(org.clerkOrgId, org.employee.clerkUserId, {
      membershipId: org.employee.membershipId,
      organizationId: org.organizationId,
      userId: org.employee.userId,
      role: ORG_ROLE.EMPLOYEE,
      locationIds: org.employee.locationIds,
    });

    const response = await apiRequest(
      `/employees/${org.employee.membershipId}/locations`,
      {
        method: "PATCH",
        actor: asAdmin(org),
        body: JSON.stringify({
          locationIds: [org.locations.main.id, org.locations.annex.id],
        }),
      },
    );

    expect(response.status).toBe(200);

    const cached = await membershipCache.get(
      org.clerkOrgId,
      org.employee.clerkUserId,
    );
    expect(cached).toBeNull();
  });

  it("still succeeds when membership-cache invalidation fails", async () => {
    const restore = await failRedisCommands("del");

    try {
      const response = await apiRequest(
        `/employees/${org.employee.membershipId}/locations`,
        {
          method: "PATCH",
          actor: asAdmin(org),
          body: JSON.stringify({
            locationIds: [org.locations.main.id, org.locations.annex.id],
          }),
        },
      );

      expect(response.status).toBe(200);

      const assignments = await db.query.organizationMemberLocations.findMany({
        where: (row, { eq }) => eq(row.membershipId, org.employee.membershipId),
      });
      expect(assignments).toHaveLength(2);
    } finally {
      restore();
    }
  });
});
