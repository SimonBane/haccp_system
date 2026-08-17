import { ORG_ROLE } from "@haccp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { MEMBERSHIP_STATUS } from "../../src/core/db/schema/organization-memberships.js";
import { seedEmployeeWithStatus, seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { apiRequest } from "./harness/request.js";

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * HACCP-56 §6: the token's own exp is the only thing bounding a stale role —
 * revoking a Clerk session stops refresh, but it cannot retroactively invalidate
 * a JWT already issued. `/locations` is admin-only end to end
 * (mountAdminProtected), so it exercises requireOrgAdmin's JWT-only role check.
 */
describe("stale-token bound", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "staletoken" });
  });

  it("accepts an admin token that has not yet reached its exp", async () => {
    const response = await apiRequest("/locations", {
      actor: {
        clerkUserId: org.admin.clerkUserId,
        clerkOrgId: org.clerkOrgId,
        orgRole: "org:admin",
        exp: nowSeconds() + 30,
      },
    });

    expect(response.status).toBe(200);
  });

  it("rejects an admin token once past its exp", async () => {
    const response = await apiRequest("/locations", {
      actor: {
        clerkUserId: org.admin.clerkUserId,
        clerkOrgId: org.clerkOrgId,
        orgRole: "org:admin",
        exp: nowSeconds() - 10,
      },
    });

    expect(response.status).toBe(401);
  });

  it("a freshly issued token after a demotion fails admin authorization immediately", async () => {
    const secondAdmin = await seedEmployeeWithStatus(db, org, {
      status: MEMBERSHIP_STATUS.ACTIVE,
      role: ORG_ROLE.ADMIN,
    });

    const demote = await apiRequest(`/employees/${secondAdmin.membershipId}/role`, {
      method: "PATCH",
      actor: {
        clerkUserId: org.admin.clerkUserId,
        clerkOrgId: org.clerkOrgId,
        orgRole: "org:admin",
      },
      body: JSON.stringify({ role: ORG_ROLE.EMPLOYEE }),
    });
    expect(demote.status).toBe(200);

    // Simulates Clerk minting the demoted user's next token — org_role now
    // reflects the demotion. The API never needs to "know" this happened; the
    // token alone is sufficient to deny admin access.
    const response = await apiRequest("/locations", {
      actor: {
        clerkUserId: secondAdmin.clerkUserId!,
        clerkOrgId: org.clerkOrgId,
        orgRole: "org:employee",
      },
    });

    expect(response.status).toBe(403);
  });
});
