import { randomUUID } from "node:crypto";
import { ORG_ROLE } from "@haccp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { organizationMemberships, users } from "../../src/core/db/schema/index.js";
import { MEMBERSHIP_STATUS } from "../../src/core/db/schema/organization-memberships.js";
import { membershipCache } from "../../src/modules/employees/membership-cache.js";
import { clerkFake } from "./harness/clerk-fake.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { failRedisCommands } from "./harness/redis.js";
import { apiRequest, asAdmin } from "./harness/request.js";

/**
 * HACCP-56/58: PATCH /employees/{id}/role is active-employees-only and goes
 * through Clerk before Postgres, using the role Clerk confirms — a failed
 * cache invalidation never fails the request. tenant-isolation.integration.test.ts
 * covers general cross-org access; employee-locations and employee-profile
 * integration tests cover the other two split endpoints.
 */
describe("Employee role changes", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "roles" });
  });

  async function addActiveAdmin(target: SeededOrg, label: string) {
    const runId = randomUUID().slice(0, 8);
    const clerkUserId = `user_${label}_${runId}`;
    const email = `${label}-${runId}@${target.clerkOrgId}.test`;

    const [user] = await db
      .insert(users)
      .values({ clerkUserId, firstName: "Extra", lastName: "Admin", email })
      .returning();

    const [membership] = await db
      .insert(organizationMemberships)
      .values({
        organizationId: target.organizationId,
        userId: user!.id,
        role: ORG_ROLE.ADMIN,
        status: MEMBERSHIP_STATUS.ACTIVE,
      })
      .returning();

    clerkFake.setUser(clerkUserId, {
      firstName: "Extra",
      lastName: "Admin",
      emailAddresses: [{ id: `idn_${clerkUserId}`, emailAddress: email }],
      primaryEmailAddressId: `idn_${clerkUserId}`,
    });

    return { clerkUserId, userId: user!.id, membershipId: membership!.id };
  }

  it("updates Clerk first, then writes the role Clerk confirmed", async () => {
    const response = await apiRequest(`/employees/${org.employee.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { role: string };
    expect(body.role).toBe(ORG_ROLE.ADMIN);

    expect(
      clerkFake.callCount("organizations.updateOrganizationMembership"),
    ).toBe(1);

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq }) => eq(m.id, org.employee.membershipId),
    });
    expect(membership?.role).toBe(ORG_ROLE.ADMIN);
  });

  it("leaves the local role unchanged when Clerk rejects the update", async () => {
    clerkFake.setMode(
      "organizations.updateOrganizationMembership",
      "retryable",
    );

    const response = await apiRequest(`/employees/${org.employee.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(503);

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq }) => eq(m.id, org.employee.membershipId),
    });
    expect(membership?.role).toBe(ORG_ROLE.EMPLOYEE);
  });

  it("still rejects an admin changing their own role", async () => {
    const response = await apiRequest(`/employees/${org.admin.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.EMPLOYEE }),
    });

    expect(response.status).toBe(403);

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq }) => eq(m.id, org.admin.membershipId),
    });
    expect(membership?.role).toBe(ORG_ROLE.ADMIN);
  });

  it("lets one admin demote another without ever reaching zero admins", async () => {
    const secondAdmin = await addActiveAdmin(org, "second");

    const response = await apiRequest(
      `/employees/${secondAdmin.membershipId}/role`,
      {
        method: "PATCH",
        actor: asAdmin(org),
        body: JSON.stringify({ role: ORG_ROLE.EMPLOYEE }),
      },
    );

    expect(response.status).toBe(200);

    const [demoted, actingAdmin] = await Promise.all([
      db.query.organizationMemberships.findFirst({
        where: (m, { eq }) => eq(m.id, secondAdmin.membershipId),
      }),
      db.query.organizationMemberships.findFirst({
        where: (m, { eq }) => eq(m.id, org.admin.membershipId),
      }),
    ]);

    expect(demoted?.role).toBe(ORG_ROLE.EMPLOYEE);
    expect(actingAdmin?.role).toBe(ORG_ROLE.ADMIN);
  });

  it("invalidates a warm membership cache entry after a role change", async () => {
    await membershipCache.set(org.clerkOrgId, org.employee.clerkUserId, {
      membershipId: org.employee.membershipId,
      organizationId: org.organizationId,
      userId: org.employee.userId,
      role: ORG_ROLE.EMPLOYEE,
      locationIds: org.employee.locationIds,
    });

    const response = await apiRequest(`/employees/${org.employee.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

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
        `/employees/${org.employee.membershipId}/role`,
        {
          method: "PATCH",
          actor: asAdmin(org),
          body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
        },
      );

      expect(response.status).toBe(200);

      const membership = await db.query.organizationMemberships.findFirst({
        where: (m, { eq }) => eq(m.id, org.employee.membershipId),
      });
      expect(membership?.role).toBe(ORG_ROLE.ADMIN);
    } finally {
      restore();
    }
  });

  it("changes only role — locations are untouched", async () => {
    const response = await apiRequest(`/employees/${org.employee.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      locationIds: string[];
      email: string;
      firstName: string;
    };
    expect(body.locationIds).toEqual(org.employee.locationIds);
    expect(body.email).toBe(org.employee.email);
  });

  it("rejects a call targeting a draft employee", async () => {
    const runId = randomUUID().slice(0, 8);
    const [user] = await db
      .insert(users)
      .values({
        clerkUserId: null,
        firstName: "Draft",
        lastName: "Person",
        email: `draft-${runId}@${org.clerkOrgId}.test`,
      })
      .returning();

    const [draftMembership] = await db
      .insert(organizationMemberships)
      .values({
        organizationId: org.organizationId,
        userId: user!.id,
        role: ORG_ROLE.EMPLOYEE,
        status: MEMBERSHIP_STATUS.DRAFT,
      })
      .returning();

    const response = await apiRequest(
      `/employees/${draftMembership!.id}/role`,
      {
        method: "PATCH",
        actor: asAdmin(org),
        body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
      },
    );

    expect(response.status).toBe(400);

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq }) => eq(m.id, draftMembership!.id),
    });
    expect(membership?.role).toBe(ORG_ROLE.EMPLOYEE);
  });
});
