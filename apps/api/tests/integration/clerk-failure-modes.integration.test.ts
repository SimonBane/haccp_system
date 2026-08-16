import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/core/db/client.js";
import { clerkFake } from "./harness/clerk-fake.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { apiRequest, asAdmin } from "./harness/request.js";

/**
 * The 401-vs-503 split through the real chain. The web app reads 401 as signed
 * out, so a Clerk outage answering 401 would sign out every tablet mid-shift:
 * only a bad token is 401, "could not check" is 503. auth.test.ts covers the
 * classifier alone; this covers it with a real database and caches behind it.
 */
describe("Clerk failure modes", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "clerkfail" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const protectedPath = "/tenant/current";

  it("rejects a request with no Authorization header", async () => {
    const response = await apiRequest(protectedPath);

    expect(response.status).toBe(401);
  });

  it("rejects a malformed token as unauthorized", async () => {
    const response = await apiRequest(protectedPath, {
      rawToken: "not.a.jwt",
    });

    expect(response.status).toBe(401);
  });

  it("rejects an expired token as unauthorized", async () => {
    clerkFake.setMode("verifyToken", "bad-token");

    const response = await apiRequest(protectedPath, { actor: asAdmin(org) });

    expect(response.status).toBe(401);
  });

  it("reports a rejected secret key as unavailable, never as signed out", async () => {
    // Our misconfiguration: a 401 would sign out every device on a bad key rotation.
    clerkFake.setMode("verifyToken", "invalid-secret");

    const response = await apiRequest(protectedPath, { actor: asAdmin(org) });

    expect(response.status).toBe(503);
  });

  it("reports a transport failure as unavailable", async () => {
    clerkFake.setMode("verifyToken", "network");

    const response = await apiRequest(protectedPath, { actor: asAdmin(org) });

    expect(response.status).toBe(503);
  });

  it("reports a hung identity provider as unavailable rather than hanging", async () => {
    clerkFake.setMode("verifyToken", "timeout");

    // Scoped to withClerkTimeout's timers so postgres.js keeps real time.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const pending = apiRequest(protectedPath, { actor: asAdmin(org) });

    // The 5s cap in clerk-errors.ts is the only thing bounding this request.
    await vi.advanceTimersByTimeAsync(5_100);

    const response = await pending;
    expect(response.status).toBe(503);
  });

  describe("during just-in-time provisioning", () => {
    const unknown = (clerkOrgId: string) => ({
      clerkUserId: `user_unknown_${Date.now()}`,
      clerkOrgId,
      orgRole: "org:admin",
    });

    it("treats an unknown Clerk user as forbidden", async () => {
      // 404 is a definite "not entitled"; it must not masquerade as a transient 503.
      clerkFake.setMode("users.getUser", "permanent");

      const response = await apiRequest(protectedPath, {
        actor: unknown(org.clerkOrgId),
      });

      expect(response.status).toBe(403);
    });

    it("treats a Clerk server error as unavailable", async () => {
      clerkFake.setMode("users.getUser", "retryable");

      const response = await apiRequest(protectedPath, {
        actor: unknown(org.clerkOrgId),
      });

      expect(response.status).toBe(503);
    });

    it("treats an unknown organization as forbidden", async () => {
      clerkFake.setMode("organizations.getOrganization", "permanent");

      const response = await apiRequest(protectedPath, {
        actor: {
          clerkUserId: org.admin.clerkUserId,
          clerkOrgId: `org_missing_${Date.now()}`,
          orgRole: "org:admin",
        },
      });

      expect(response.status).toBe(403);
    });
  });

  it("refuses a valid token that carries no organization", async () => {
    const response = await apiRequest(protectedPath, {
      actor: {
        clerkUserId: org.admin.clerkUserId,
        clerkOrgId: null,
        orgRole: null,
      },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      message: "Organization membership required",
    });
  });
});
