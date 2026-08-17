import { ORG_ROLE } from "@haccp/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { organizationMemberships } from "../../src/core/db/schema/organization-memberships.js";
import { MEMBERSHIP_STATUS } from "../../src/core/db/schema/organization-memberships.js";
import { clerkFake } from "./harness/clerk-fake.js";
import {
  seedEmployeeWithStatus,
  seedOrganization,
  type SeededOrg,
} from "./harness/fixtures.js";
import { apiRequest, asAdmin } from "./harness/request.js";

async function readRole(membershipId: string): Promise<string | undefined> {
  const [row] = await db
    .select()
    .from(organizationMemberships)
    .where(eq(organizationMemberships.id, membershipId));
  return row?.role;
}

/**
 * HACCP-56 §1-4: Clerk-first role changes through PATCH /employees/{id}/role,
 * end to end against the real database and the Clerk fake's failure modes.
 */
describe("employee role change", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "rolechange" });
  });

  it("promotes an active employee and leaves their locations untouched", async () => {
    const response = await apiRequest(`/employees/${org.employee.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { role: string; locationIds: string[] };
    expect(body.role).toBe(ORG_ROLE.ADMIN);
    expect(body.locationIds).toEqual([org.locations.main.id]);
    expect(await readRole(org.employee.membershipId)).toBe(ORG_ROLE.ADMIN);
  });

  it("demoting an admin with no locations assigns the default location", async () => {
    const secondAdmin = await seedEmployeeWithStatus(db, org, {
      status: MEMBERSHIP_STATUS.ACTIVE,
      role: ORG_ROLE.ADMIN,
    });

    const response = await apiRequest(`/employees/${secondAdmin.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.EMPLOYEE }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { role: string; locationIds: string[] };
    expect(body.role).toBe(ORG_ROLE.EMPLOYEE);
    expect(body.locationIds).toEqual([org.locations.main.id]);
  });

  it("refuses to let an admin change their own role", async () => {
    const response = await apiRequest(`/employees/${org.admin.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.EMPLOYEE }),
    });

    expect(response.status).toBe(403);
    expect(await readRole(org.admin.membershipId)).toBe(ORG_ROLE.ADMIN);
  });

  it("blocks demoting the organization's only active admin before contacting Clerk", async () => {
    // A different identity acting as admin per the JWT — the DB still has exactly
    // one ACTIVE admin, which is the one being targeted.
    const response = await apiRequest(`/employees/${org.admin.membershipId}/role`, {
      method: "PATCH",
      actor: {
        clerkUserId: org.employee.clerkUserId,
        clerkOrgId: org.clerkOrgId,
        orgRole: "org:admin",
      },
      body: JSON.stringify({ role: ORG_ROLE.EMPLOYEE }),
    });

    expect(response.status).toBe(400);
    expect(clerkFake.callCount("organizations.updateOrganizationMembership")).toBe(0);
    expect(await readRole(org.admin.membershipId)).toBe(ORG_ROLE.ADMIN);
  });

  it("honors Clerk's own last-admin rejection even when the local pre-check passes", async () => {
    // Two ACTIVE admins locally, so the app-level pre-check does not block this —
    // Clerk's own guard must still be respected as authoritative.
    const secondAdmin = await seedEmployeeWithStatus(db, org, {
      status: MEMBERSHIP_STATUS.ACTIVE,
      role: ORG_ROLE.ADMIN,
    });
    clerkFake.setMode("organizations.updateOrganizationMembership", "last-admin");

    const response = await apiRequest(`/employees/${secondAdmin.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.EMPLOYEE }),
    });

    expect(response.status).toBe(400);
    expect(await readRole(secondAdmin.membershipId)).toBe(ORG_ROLE.ADMIN);
  });

  it("rejects an unsupported role and leaves the projection unchanged", async () => {
    clerkFake.setMode("organizations.updateOrganizationMembership", "permanent");

    const response = await apiRequest(`/employees/${org.employee.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(400);
    expect(await readRole(org.employee.membershipId)).toBe(ORG_ROLE.EMPLOYEE);
  });

  it("reports outcome-unknown when the write is ambiguous and the disambiguating re-read shows the previous role", async () => {
    // "network" (a rejected fetch) is exactly as ambiguous to callClerkWrite as a
    // hung "timeout" would be — isDefiniteRejection is false either way — and it
    // settles immediately instead of needing a real 5s cap or fake timers.
    clerkFake.setMode("organizations.updateOrganizationMembership", "network");

    const response = await apiRequest(`/employees/${org.employee.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(503);
    expect(await readRole(org.employee.membershipId)).toBe(ORG_ROLE.EMPLOYEE);
  });

  it("converges when Clerk applied the write but the acknowledgement was lost", async () => {
    // Simulates the write landing at Clerk without the response reaching us: Clerk's
    // state already shows the target role before our write call fails.
    clerkFake.setMembership(org.clerkOrgId, org.employee.clerkUserId, {
      role: ORG_ROLE.ADMIN,
    });
    clerkFake.setMode("organizations.updateOrganizationMembership", "network");

    const response = await apiRequest(`/employees/${org.employee.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(200);
    expect(await readRole(org.employee.membershipId)).toBe(ORG_ROLE.ADMIN);
  });

  it("retrying an identical role change calls Clerk again rather than no-op'ing locally", async () => {
    const path = `/employees/${org.employee.membershipId}/role`;
    const body = JSON.stringify({ role: ORG_ROLE.ADMIN });

    const first = await apiRequest(path, { method: "PATCH", actor: asAdmin(org), body });
    expect(first.status).toBe(200);

    const callsAfterFirst = clerkFake.callCount(
      "organizations.updateOrganizationMembership",
    );

    const second = await apiRequest(path, { method: "PATCH", actor: asAdmin(org), body });
    expect(second.status).toBe(200);

    expect(clerkFake.callCount("organizations.updateOrganizationMembership")).toBe(
      callsAfterFirst + 1,
    );
    expect(await readRole(org.employee.membershipId)).toBe(ORG_ROLE.ADMIN);
  });

  it("changes a draft employee's role locally with no Clerk call", async () => {
    const draft = await seedEmployeeWithStatus(db, org, {
      status: MEMBERSHIP_STATUS.DRAFT,
    });

    const response = await apiRequest(`/employees/${draft.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(200);
    expect(clerkFake.callCount("organizations.updateOrganizationMembership")).toBe(0);
    expect(await readRole(draft.membershipId)).toBe(ORG_ROLE.ADMIN);
  });

  it("changes an invited employee's role by revoking and reissuing the invitation", async () => {
    const invited = await seedEmployeeWithStatus(db, org, {
      status: MEMBERSHIP_STATUS.INVITED,
      role: ORG_ROLE.EMPLOYEE,
      clerkInvitationId: "inv_old",
    });

    const response = await apiRequest(`/employees/${invited.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(200);
    expect(clerkFake.client.organizations.revokeOrganizationInvitation).toHaveBeenCalledTimes(1);
    expect(clerkFake.client.organizations.createOrganizationInvitation).toHaveBeenCalledTimes(1);
    expect(await readRole(invited.membershipId)).toBe(ORG_ROLE.ADMIN);
  });
});

/** HACCP-56 §6: best-effort session revocation after a demotion. */
describe("session revocation on demotion", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "sessionkick" });
  });

  it("revokes active sessions after a demotion", async () => {
    const secondAdmin = await seedEmployeeWithStatus(db, org, {
      status: MEMBERSHIP_STATUS.ACTIVE,
      role: ORG_ROLE.ADMIN,
    });
    clerkFake.setSessions(secondAdmin.clerkUserId!, ["sess_1", "sess_2"]);

    const response = await apiRequest(`/employees/${secondAdmin.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.EMPLOYEE }),
    });

    expect(response.status).toBe(200);
    const sessions = clerkFake.getSessions(secondAdmin.clerkUserId!);
    expect(sessions.every((session) => session.status === "revoked")).toBe(true);
  });

  it("does not revoke sessions on a promotion", async () => {
    clerkFake.setSessions(org.employee.clerkUserId, ["sess_1"]);

    const response = await apiRequest(`/employees/${org.employee.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(200);
    const sessions = clerkFake.getSessions(org.employee.clerkUserId);
    expect(sessions.every((session) => session.status === "active")).toBe(true);
  });

  it("still succeeds and keeps the authoritative role when session revocation itself fails", async () => {
    const secondAdmin = await seedEmployeeWithStatus(db, org, {
      status: MEMBERSHIP_STATUS.ACTIVE,
      role: ORG_ROLE.ADMIN,
    });
    clerkFake.setSessions(secondAdmin.clerkUserId!, ["sess_1"]);
    clerkFake.setMode("sessions.getSessionList", "retryable");

    const response = await apiRequest(`/employees/${secondAdmin.membershipId}/role`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.EMPLOYEE }),
    });

    expect(response.status).toBe(200);
    expect(await readRole(secondAdmin.membershipId)).toBe(ORG_ROLE.EMPLOYEE);
    // The failed listing means nothing was found to revoke — status is unchanged,
    // not an error, and it must not have blocked the role change above.
    const sessions = clerkFake.getSessions(secondAdmin.clerkUserId!);
    expect(sessions.every((session) => session.status === "active")).toBe(true);
  });
});
