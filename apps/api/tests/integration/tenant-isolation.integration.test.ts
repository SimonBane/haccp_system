import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { seedTwoTenants, type TwoTenantWorld } from "./harness/fixtures.js";
import { apiRequest, asAdmin, asEmployee } from "./harness/request.js";

/** The cross-tenant boundary end to end. Both branches of locationParamMiddleware. */
describe("location scoping across tenants", () => {
  let world: TwoTenantWorld;

  beforeEach(async () => {
    world = await seedTwoTenants(db);
  });

  it("lets an admin reach a location in their own organization", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/equipment`,
      { actor: asAdmin(world.alpha) },
    );

    expect(response.status).toBe(200);
  });

  it("refuses an admin reaching another organization's location", async () => {
    const response = await apiRequest(
      `/locations/${world.beta.locations.main.id}/equipment`,
      { actor: asAdmin(world.alpha) },
    );

    // 403, not 404: authenticated, location exists, simply not theirs.
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      message: "You do not have access to this location",
    });
  });

  it("refuses an employee reaching an unassigned location in their own organization", async () => {
    // Same tenant, so only the assignment list stops it — the branch a tenant-only check misses.
    const response = await apiRequest(
      `/locations/${world.alpha.locations.annex.id}/today?date=2026-08-16`,
      { actor: asEmployee(world.alpha) },
    );

    expect(response.status).toBe(403);
  });

  it("refuses an employee writing at an unassigned location in their own organization", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.annex.id}/today/occurrences/00000000-0000-4000-8000-000000000099/record`,
      {
        method: "POST",
        actor: asEmployee(world.alpha),
        body: JSON.stringify({ kind: "ordinary" }),
      },
    );

    expect(response.status).toBe(403);
  });

  it("lets an employee reach the location they are assigned to", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/today?date=2026-08-16`,
      { actor: asEmployee(world.alpha) },
    );

    expect(response.status).toBe(200);
  });

  it("refuses an employee reaching another organization's location", async () => {
    const response = await apiRequest(
      `/locations/${world.beta.locations.main.id}/today?date=2026-08-16`,
      { actor: asEmployee(world.alpha) },
    );

    expect(response.status).toBe(403);
  });
});
