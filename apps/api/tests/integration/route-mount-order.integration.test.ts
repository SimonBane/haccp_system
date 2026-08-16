import { todayResponseSchema } from "@haccp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { apiRequest, asAdmin, asEmployee } from "./harness/request.js";

/**
 * Location-scoped routers must be registered before the admin `/locations` router.
 * Reversed, Hono matches the admin router for every `/locations/*` path and
 * requireOrgAdmin locks non-admins out of Today.
 */
describe("route mount order", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "mountorder" });
  });

  it("serves Today to a non-admin employee", async () => {
    const response = await apiRequest(
      `/locations/${org.locations.main.id}/today?date=2026-08-16`,
      { actor: asEmployee(org) },
    );

    expect(response.status).toBe(200);

    // The API does not validate its own responses, so a status check alone would
    // miss a payload the web client's Zod parse rejects — which is a blank screen.
    const parsed = todayResponseSchema.safeParse(await response.json());
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it("still guards the admin locations collection against a non-admin", async () => {
    // Reachable Today only means something if admin-only routes stayed guarded.
    const response = await apiRequest("/locations", {
      actor: asEmployee(org),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      message: "Admin access required",
    });
  });

  it("serves the admin locations collection to an admin", async () => {
    const response = await apiRequest("/locations", { actor: asAdmin(org) });

    expect(response.status).toBe(200);
  });

  it("keeps location-scoped admin routes admin-only", async () => {
    // Location-scoped and admin-only, so both middlewares run in mount order.
    const response = await apiRequest(
      `/locations/${org.locations.main.id}/equipment`,
      { actor: asEmployee(org) },
    );

    expect(response.status).toBe(403);
  });
});
