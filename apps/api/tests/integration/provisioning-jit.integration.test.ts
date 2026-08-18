import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  locations,
  organizationMemberships,
  organizations,
  users,
} from "../../src/core/db/schema/index.js";
import { clerkFake } from "./harness/clerk-fake.js";
import { seedOrganization } from "./harness/fixtures.js";
import { failRedisCommands, hangRedisCommands } from "./harness/redis.js";
import { apiRequest, asAdmin } from "./harness/request.js";

/**
 * JIT provisioning against a real database and Redis: that the transaction commits
 * the right rows, that caches make the second request cheaper, and that a cache
 * outage costs latency rather than correctness.
 */
describe("just-in-time provisioning", () => {
  const suffix = () => Math.random().toString(36).slice(2, 10);

  describe("first request for an unknown organization", () => {
    let clerkOrgId: string;
    let clerkUserId: string;

    beforeEach(() => {
      clerkOrgId = `org_new_${suffix()}`;
      clerkUserId = `user_new_${suffix()}`;

      clerkFake.setOrganization(clerkOrgId, { name: "Newly Seen Kitchen" });
      clerkFake.setUser(clerkUserId, {
        firstName: "Nia",
        lastName: "Newcomer",
      });
    });

    it("creates the organization, a default location, the user and the membership", async () => {
      const response = await apiRequest("/tenant/current", {
        actor: { clerkUserId, clerkOrgId, orgRole: "org:admin" },
      });

      expect(response.status).toBe(200);

      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkOrgId, clerkOrgId));

      expect(organization).toBeDefined();
      expect(organization!.name).toBe("Newly Seen Kitchen");

      // buildTenantCacheBlob throws on a location-less org, poisoning later requests.
      const created = await db
        .select()
        .from(locations)
        .where(eq(locations.organizationId, organization!.id));

      expect(created).toHaveLength(1);
      expect(created[0]!.isDefault).toBe(true);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId));

      expect(user).toBeDefined();

      const [membership] = await db
        .select()
        .from(organizationMemberships)
        .where(eq(organizationMemberships.userId, user!.id));

      expect(membership).toMatchObject({
        organizationId: organization!.id,
        role: "org:admin",
        status: "active",
        deletedAt: null,
      });
    });

    it("serves the second request without calling Clerk again", async () => {
      const first = await apiRequest("/tenant/current", {
        actor: { clerkUserId, clerkOrgId, orgRole: "org:admin" },
      });
      expect(first.status).toBe(200);

      const afterFirst = {
        org: clerkFake.callCount("organizations.getOrganization"),
        user: clerkFake.callCount("users.getUser"),
      };

      // Without this the comparison below would hold trivially at 0 === 0.
      expect(afterFirst.org).toBeGreaterThan(0);
      expect(afterFirst.user).toBeGreaterThan(0);

      const second = await apiRequest("/tenant/current", {
        actor: { clerkUserId, clerkOrgId, orgRole: "org:admin" },
      });
      expect(second.status).toBe(200);

      // If this regresses, every authenticated request starts a Clerk round trip.
      expect(clerkFake.callCount("organizations.getOrganization")).toBe(
        afterFirst.org,
      );
      expect(clerkFake.callCount("users.getUser")).toBe(afterFirst.user);
    });

    it("provisions exactly once under concurrent first requests", async () => {
      const actor = { clerkUserId, clerkOrgId, orgRole: "org:admin" };

      const responses = await Promise.all([
        apiRequest("/tenant/current", { actor }),
        apiRequest("/tenant/current", { actor }),
        apiRequest("/tenant/current", { actor }),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }

      // Single-flight collapses duplicates; the unique indexes are the backstop.
      const created = await db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkOrgId, clerkOrgId));

      expect(created).toHaveLength(1);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, clerkUserId));

      const memberships = await db
        .select()
        .from(organizationMemberships)
        .where(eq(organizationMemberships.userId, user!.id));

      expect(memberships).toHaveLength(1);
    });

    it("still provisions when the cache is unavailable", async () => {
      // Cache modules log and fall through to Postgres: losing Redis costs a round trip.
      const restore = await failRedisCommands("get", "set");

      try {
        const response = await apiRequest("/tenant/current", {
          actor: { clerkUserId, clerkOrgId, orgRole: "org:admin" },
        });

        expect(response.status).toBe(200);
      } finally {
        restore();
      }

      const created = await db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkOrgId, clerkOrgId));

      expect(created).toHaveLength(1);
    });

    it("still provisions promptly when a cache read hangs instead of failing fast", async () => {
      const restore = await hangRedisCommands("get");

      try {
        const start = Date.now();
        const response = await apiRequest("/tenant/current", {
          actor: { clerkUserId, clerkOrgId, orgRole: "org:admin" },
        });
        const elapsedMs = Date.now() - start;

        expect(response.status).toBe(200);
        // Bounded by COMMAND_TIMEOUT_MS, not the suite's 20s test timeout.
        expect(elapsedMs).toBeLessThan(5000);
      } finally {
        restore();
      }

      const created = await db
        .select()
        .from(organizations)
        .where(eq(organizations.clerkOrgId, clerkOrgId));

      expect(created).toHaveLength(1);
    });
  });

  describe("stale Clerk metadata", () => {
    it("does not rewrite the stored role from the presented token", async () => {
      const org = await seedOrganization(db, { slug: "roledrift" });

      // A token minted before a demotion still claims admin; healing from it would
      // undo the demotion on the next request. The webhook is the correction channel.
      const response = await apiRequest("/tenant/current", {
        actor: {
          clerkUserId: org.employee.clerkUserId,
          clerkOrgId: org.clerkOrgId,
          orgRole: "org:admin",
        },
      });

      expect(response.status).toBe(200);

      const [membership] = await db
        .select()
        .from(organizationMemberships)
        .where(eq(organizationMemberships.id, org.employee.membershipId));

      expect(membership!.role).toBe("org:employee");
    });

    it("serves a healthy membership without consulting Clerk for the profile", async () => {
      const org = await seedOrganization(db, { slug: "profiledrift" });

      // Clerk now reports a different name than the database holds.
      clerkFake.setUser(org.admin.clerkUserId, {
        firstName: "Renamed",
        lastName: "Elsewhere",
        emailAddresses: [
          { id: `idn_${org.admin.clerkUserId}`, emailAddress: org.admin.email },
        ],
        primaryEmailAddressId: `idn_${org.admin.clerkUserId}`,
      });

      const before = clerkFake.callCount("users.getUser");

      const response = await apiRequest("/tenant/current", {
        actor: asAdmin(org),
      });
      expect(response.status).toBe(200);

      // A healthy row short-circuits before the profile fetch, so drift is not observed.
      expect(clerkFake.callCount("users.getUser")).toBe(before);

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, org.admin.clerkUserId));

      expect(user!.firstName).toBe("Ada");
    });
  });
});
