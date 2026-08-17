import { ORG_ROLE } from "@haccp/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  organizationMemberships,
  organizations,
  users,
} from "../../src/core/db/schema/index.js";
import { employeeRepository } from "../../src/modules/employees/employee.repository.js";
import { clerkFake } from "./harness/clerk-fake.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { apiRequest } from "./harness/request.js";
import { signWebhookRequest } from "./harness/webhook-signing.js";

async function readRole(membershipId: string): Promise<string | undefined> {
  const [row] = await db
    .select()
    .from(organizationMemberships)
    .where(eq(organizationMemberships.id, membershipId));
  return row?.role;
}

function membershipUpdatedPayload(org: SeededOrg, payloadRole: string) {
  return {
    type: "organizationMembership.updated",
    data: {
      organization: { id: org.clerkOrgId },
      public_user_data: { user_id: org.employee.clerkUserId },
      // Deliberately wrong — the handler must re-read Clerk, never trust this.
      role: payloadRole,
    },
  };
}

/**
 * HACCP-56 §5: webhook-driven role convergence, against real Svix verification
 * (not mocked — signWebhookRequest signs with the same secret the app verifies
 * with) and the same clerk_role_updated_at marker the direct role-change path
 * uses (HACCP-56 §1-4).
 */
describe("Clerk webhooks", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "webhook" });
  });

  it("rejects a request with an invalid signature", async () => {
    const { body } = signWebhookRequest(membershipUpdatedPayload(org, "org:admin"));

    const response = await apiRequest("/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-id": "msg_bad",
        "svix-timestamp": String(Math.floor(Date.now() / 1000)),
        "svix-signature": "v1,not-a-real-signature",
      },
      body,
    });

    expect(response.status).toBe(400);
  });

  it("converges to Clerk's current role, ignoring both the stale local row and the payload's own role field", async () => {
    // Clerk's real state (as our own role-change endpoint would have left it);
    // the local row and the webhook payload both still say the old role.
    clerkFake.setMembership(org.clerkOrgId, org.employee.clerkUserId, {
      role: ORG_ROLE.ADMIN,
    });

    const { body, headers } = signWebhookRequest(
      membershipUpdatedPayload(org, ORG_ROLE.EMPLOYEE),
    );
    const response = await apiRequest("/webhooks/clerk", {
      method: "POST",
      headers,
      body,
    });

    expect(response.status).toBe(200);
    expect(await readRole(org.employee.membershipId)).toBe(ORG_ROLE.ADMIN);
  });

  it("converges identically on a duplicate delivery of the same event", async () => {
    clerkFake.setMembership(org.clerkOrgId, org.employee.clerkUserId, {
      role: ORG_ROLE.ADMIN,
    });

    const signed = signWebhookRequest(
      membershipUpdatedPayload(org, ORG_ROLE.EMPLOYEE),
    );

    const first = await apiRequest("/webhooks/clerk", {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
    });
    expect(first.status).toBe(200);

    // Re-signed as a fresh message (a real Svix retry uses a new svix-id too),
    // representing Clerk's own at-least-once redelivery of the same event.
    const redelivered = signWebhookRequest(
      membershipUpdatedPayload(org, ORG_ROLE.EMPLOYEE),
    );
    const second = await apiRequest("/webhooks/clerk", {
      method: "POST",
      headers: redelivered.headers,
      body: redelivered.body,
    });

    expect(second.status).toBe(200);
    expect(await readRole(org.employee.membershipId)).toBe(ORG_ROLE.ADMIN);
  });

  it("provisions a membership on organizationMembership.created", async () => {
    const newClerkUserId = `user_wh_${Date.now()}`;
    clerkFake.setUser(newClerkUserId, {
      firstName: "New",
      lastName: "Hire",
      emailAddresses: [
        { id: `idn_${newClerkUserId}`, emailAddress: `${newClerkUserId}@test.example` },
      ],
      primaryEmailAddressId: `idn_${newClerkUserId}`,
    });

    const { body, headers } = signWebhookRequest({
      type: "organizationMembership.created",
      data: {
        organization: { id: org.clerkOrgId },
        public_user_data: { user_id: newClerkUserId },
        role: ORG_ROLE.EMPLOYEE,
      },
    });

    const response = await apiRequest("/webhooks/clerk", {
      method: "POST",
      headers,
      body,
    });

    expect(response.status).toBe(200);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, newClerkUserId));
    expect(user).toBeDefined();

    const [membership] = await db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.userId, user!.id));
    expect(membership).toMatchObject({ role: ORG_ROLE.EMPLOYEE, status: "active" });
  });

  it("soft-deletes the membership on organizationMembership.deleted", async () => {
    const { body, headers } = signWebhookRequest({
      type: "organizationMembership.deleted",
      data: {
        organization: { id: org.clerkOrgId },
        public_user_data: { user_id: org.employee.clerkUserId },
      },
    });

    const response = await apiRequest("/webhooks/clerk", {
      method: "POST",
      headers,
      body,
    });

    expect(response.status).toBe(200);

    const [membership] = await db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.id, org.employee.membershipId));
    expect(membership!.deletedAt).not.toBeNull();
  });

  it("acknowledges (200) rather than retrying when the organization is gone", async () => {
    const { body, headers } = signWebhookRequest(
      membershipUpdatedPayload(org, ORG_ROLE.ADMIN),
    );

    // Soft-delete the organization out from under the webhook.
    await db
      .update(organizations)
      .set({ deletedAt: new Date() })
      .where(eq(organizations.id, org.organizationId));

    const response = await apiRequest("/webhooks/clerk", {
      method: "POST",
      headers,
      body,
    });

    // findMembershipByClerkIds requires the org to be live, so this is a no-op,
    // not a permanent-Clerk-miss ack — either way it must not 5xx into a retry storm.
    expect(response.status).toBe(200);
  });
});

/**
 * The clerk_role_updated_at ordering guard directly: this is what actually
 * prevents an older role read (a delayed/out-of-order webhook, or a stale
 * direct role-change response) from overwriting a newer one, independent of
 * which delivery order the webhooks themselves arrive in.
 */
describe("role projection ordering guard", () => {
  it("never lets an older clerk_role_updated_at overwrite a newer one", async () => {
    const org = await seedOrganization(db, { slug: "ordering" });
    const older = new Date("2026-01-01T00:00:00Z");
    const newer = new Date("2026-01-02T00:00:00Z");

    const first = await employeeRepository.updateRoleFromClerkByIdAndOrganization(
      db,
      org.organizationId,
      org.employee.membershipId,
      ORG_ROLE.ADMIN,
      newer,
    );
    expect(first?.role).toBe(ORG_ROLE.ADMIN);

    // A late arrival for an older event must not win.
    const second = await employeeRepository.updateRoleFromClerkByIdAndOrganization(
      db,
      org.organizationId,
      org.employee.membershipId,
      ORG_ROLE.EMPLOYEE,
      older,
    );
    expect(second).toBeNull();
    expect(await readRole(org.employee.membershipId)).toBe(ORG_ROLE.ADMIN);
  });
});
