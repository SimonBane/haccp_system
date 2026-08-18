import { randomUUID } from "node:crypto";
import { ORG_ROLE } from "@haccp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { organizationMemberships, users } from "../../src/core/db/schema/index.js";
import { MEMBERSHIP_STATUS } from "../../src/core/db/schema/organization-memberships.js";
import { clerkFake } from "./harness/clerk-fake.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { apiRequest, asAdmin } from "./harness/request.js";

/**
 * HACCP-58: PATCH /employees/{id}/profile is the draft/invited-only bundle
 * (email, first name, last name, role) that reissues the Clerk invitation
 * when a changed field affects an invited employee — active employees must
 * go through /role instead, and never through this endpoint.
 */
describe("Employee profile changes", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "profile" });
  });

  async function addDraftEmployee(label: string) {
    const runId = randomUUID().slice(0, 8);
    const email = `${label}-${runId}@${org.clerkOrgId}.test`;

    const [user] = await db
      .insert(users)
      .values({ clerkUserId: null, firstName: "Draft", lastName: "Person", email })
      .returning();

    const [membership] = await db
      .insert(organizationMemberships)
      .values({
        organizationId: org.organizationId,
        userId: user!.id,
        role: ORG_ROLE.EMPLOYEE,
        status: MEMBERSHIP_STATUS.DRAFT,
      })
      .returning();

    return { userId: user!.id, membershipId: membership!.id, email };
  }

  async function addInvitedEmployee(label: string) {
    const runId = randomUUID().slice(0, 8);
    const email = `${label}-${runId}@${org.clerkOrgId}.test`;

    const [user] = await db
      .insert(users)
      .values({ clerkUserId: null, firstName: "Invited", lastName: "Person", email })
      .returning();

    const [membership] = await db
      .insert(organizationMemberships)
      .values({
        organizationId: org.organizationId,
        userId: user!.id,
        role: ORG_ROLE.EMPLOYEE,
        status: MEMBERSHIP_STATUS.INVITED,
        clerkInvitationId: "inv_seed",
        invitedAt: new Date(),
      })
      .returning();

    return { userId: user!.id, membershipId: membership!.id, email };
  }

  it("rejects a call targeting an active employee", async () => {
    const response = await apiRequest(
      `/employees/${org.employee.membershipId}/profile`,
      {
        method: "PATCH",
        actor: asAdmin(org),
        body: JSON.stringify({ firstName: "Renamed" }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("writes a plain update for a draft employee, with no Clerk call", async () => {
    const draft = await addDraftEmployee("draft");
    const createInvitationCalls =
      clerkFake.client.organizations.createOrganizationInvitation.mock.calls
        .length;
    const revokeInvitationCalls =
      clerkFake.client.organizations.revokeOrganizationInvitation.mock.calls
        .length;

    const response = await apiRequest(`/employees/${draft.membershipId}/profile`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ firstName: "Nova", role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { firstName: string; role: string };
    expect(body.firstName).toBe("Nova");
    expect(body.role).toBe(ORG_ROLE.ADMIN);
    expect(
      clerkFake.client.organizations.createOrganizationInvitation.mock.calls
        .length,
    ).toBe(createInvitationCalls);
    expect(
      clerkFake.client.organizations.revokeOrganizationInvitation.mock.calls
        .length,
    ).toBe(revokeInvitationCalls);
  });

  it("reissues the invitation when a changed field affects an invited employee", async () => {
    const invited = await addInvitedEmployee("invited");
    const createInvitationCalls =
      clerkFake.client.organizations.createOrganizationInvitation.mock.calls
        .length;
    const revokeInvitationCalls =
      clerkFake.client.organizations.revokeOrganizationInvitation.mock.calls
        .length;

    const response = await apiRequest(`/employees/${invited.membershipId}/profile`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(200);
    expect(
      clerkFake.client.organizations.revokeOrganizationInvitation.mock.calls
        .length,
    ).toBe(revokeInvitationCalls + 1);
    expect(
      clerkFake.client.organizations.createOrganizationInvitation.mock.calls
        .length,
    ).toBe(createInvitationCalls + 1);

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq }) => eq(m.id, invited.membershipId),
    });
    expect(membership?.role).toBe(ORG_ROLE.ADMIN);
    expect(membership?.status).toBe(MEMBERSHIP_STATUS.INVITED);
    expect(membership?.clerkInvitationId).not.toBe("inv_seed");
  });

  it("does not reissue when the submitted values equal the current ones", async () => {
    const invited = await addInvitedEmployee("noop");
    const createInvitationCalls =
      clerkFake.client.organizations.createOrganizationInvitation.mock.calls
        .length;

    const response = await apiRequest(`/employees/${invited.membershipId}/profile`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.EMPLOYEE, firstName: "Invited" }),
    });

    expect(response.status).toBe(200);
    expect(
      clerkFake.client.organizations.createOrganizationInvitation.mock.calls
        .length,
    ).toBe(createInvitationCalls);

    const membership = await db.query.organizationMemberships.findFirst({
      where: (m, { eq }) => eq(m.id, invited.membershipId),
    });
    expect(membership?.clerkInvitationId).toBe("inv_seed");
  });

  it("rejects a duplicate email on a draft employee", async () => {
    const draft = await addDraftEmployee("dup");

    const response = await apiRequest(`/employees/${draft.membershipId}/profile`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ email: org.admin.email }),
    });

    expect(response.status).toBe(409);
  });
});
