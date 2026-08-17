import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/core/db/client.js";
import { clerkFake } from "./harness/clerk-fake.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { failRedisCommands } from "./harness/redis.js";
import { apiRequest, asAdmin, asEmployee } from "./harness/request.js";

/**
 * HACCP-56 §7: location revocation must be bounded, even when the admin write that
 * revokes it fails partway through, or Redis itself fails. The membership cache TTL
 * is set to 2s for the whole integration suite (vitest.integration.config.ts) so the
 * bound itself can be waited out rather than mocked.
 */
describe("location revocation", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "revoke" });
  });

  async function warmEmployeeCache(): Promise<void> {
    // A cache miss on the request path runs ensureMembership, which populates the
    // membership blob with the employee's current (pre-revocation) locationIds.
    const response = await apiRequest(
      `/locations/${org.locations.main.id}/today?date=2026-08-16`,
      { actor: asEmployee(org) },
    );
    expect(response.status).toBe(200);
  }

  it("denies access to a revoked location immediately, even when the same update's Clerk call fails", async () => {
    await warmEmployeeCache();

    // A concurrent profile change forces applyActiveEmployeeUpdate to call Clerk;
    // failing that call must not skip the cache invalidation for the location change
    // committed moments earlier in the same request.
    const updateUserSpy = vi
      .spyOn(clerkFake.client.users, "updateUser")
      .mockRejectedValueOnce(new Error("Clerk unavailable (injected)"));

    // `[]` would not revoke `main` — employees always need at least one location, so
    // resolveLocationAssignments would silently reassign the default (main) right
    // back. Reassigning to annex only is a genuine revocation of main.
    const update = await apiRequest(`/employees/${org.employee.membershipId}`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({
        firstName: "Changed",
        locationIds: [org.locations.annex.id],
      }),
    });

    // The DB write committed; the Clerk call after it failed. This is a regression
    // guard on that failure mode, not the behavior under test below.
    expect(update.status).toBe(500);
    updateUserSpy.mockRestore();

    const afterRevocation = await apiRequest(
      `/locations/${org.locations.main.id}/today?date=2026-08-16`,
      { actor: asEmployee(org) },
    );

    expect(afterRevocation.status).toBe(403);
  });

  it("denies access to a revoked location once the cache invalidation itself fails, bounded by the TTL", async () => {
    await warmEmployeeCache();

    const restoreRedis = await failRedisCommands("del");

    const update = await apiRequest(`/employees/${org.employee.membershipId}`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ locationIds: [org.locations.annex.id] }),
    });

    // No Clerk call is made for a locations-only change, so the write itself succeeds
    // even though the invalidation DEL that follows it is failing.
    expect(update.status).toBe(200);

    const immediatelyAfter = await apiRequest(
      `/locations/${org.locations.main.id}/today?date=2026-08-16`,
      { actor: asEmployee(org) },
    );

    // Expected and accepted: the failed DEL leaves the pre-revocation blob live. This
    // is the trade-off recorded on HACCP-56 — bounded by TTL, not eliminated.
    expect(immediatelyAfter.status).toBe(200);

    restoreRedis();

    await new Promise((resolve) => setTimeout(resolve, 2_200));

    const afterTtl = await apiRequest(
      `/locations/${org.locations.main.id}/today?date=2026-08-16`,
      { actor: asEmployee(org) },
    );

    expect(afterTtl.status).toBe(403);
  }, 15_000);

  it("denies every concurrent request once a revocation has committed, none racing back to stale access", async () => {
    await warmEmployeeCache();

    const update = await apiRequest(`/employees/${org.employee.membershipId}`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ locationIds: [org.locations.annex.id] }),
    });
    expect(update.status).toBe(200);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        apiRequest(`/locations/${org.locations.main.id}/today?date=2026-08-16`, {
          actor: asEmployee(org),
        }),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(403);
    }
  });
});
