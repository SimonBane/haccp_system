import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { organizations, users } from "../../src/core/db/schema/index.js";
import { clerkFake } from "./harness/clerk-fake.js";
import { simulateRedisUnavailable } from "./harness/redis.js";
import { apiRequest } from "./harness/request.js";

/**
 * Redis unreachable for the whole request, not just one command: no cache read
 * ever gets a client to call. Every protected request must still fall back to
 * Postgres, bounded well under the suite's 20s test timeout.
 */
describe("Redis unavailable", () => {
  it("falls back to Postgres promptly for a protected request", async () => {
    const clerkOrgId = `org_outage_${Math.random().toString(36).slice(2, 10)}`;
    const clerkUserId = `user_outage_${Math.random().toString(36).slice(2, 10)}`;

    clerkFake.setOrganization(clerkOrgId, { name: "Outage Kitchen" });
    clerkFake.setUser(clerkUserId, { firstName: "Otto", lastName: "Outage" });

    const restore = await simulateRedisUnavailable();

    try {
      const start = Date.now();
      const response = await apiRequest("/tenant/current", {
        actor: { clerkUserId, clerkOrgId, orgRole: "org:admin" },
      });
      const elapsedMs = Date.now() - start;

      expect(response.status).toBe(200);
      // Bounded by CONNECT_TIMEOUT_MS, not the suite's 20s test timeout or an
      // OS-level TCP timeout.
      expect(elapsedMs).toBeLessThan(5000);
    } finally {
      await restore();
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, clerkOrgId));

    expect(organization).toBeDefined();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId));

    expect(user).toBeDefined();
  });
});
