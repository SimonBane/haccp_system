import { ORG_ROLE } from "@haccp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { apiRequest, asAdmin } from "./harness/request.js";

/**
 * HACCP-58: the combined identity+role+location update endpoint is gone —
 * employee administration is exactly three status-scoped mutations
 * (/role, /locations, /profile). This file asserts the contract boundary
 * itself; each endpoint's own behavior is covered in its sibling file.
 */
describe("Employee administration contract", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "contract" });
  });

  it("no longer serves the combined update endpoint", async () => {
    const response = await apiRequest(`/employees/${org.employee.membershipId}`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ role: ORG_ROLE.ADMIN }),
    });

    expect(response.status).toBe(404);
  });

  it("rejects a /profile call targeting an active employee", async () => {
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
});
