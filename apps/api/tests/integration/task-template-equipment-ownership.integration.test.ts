import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { seedTwoTenants, type TwoTenantWorld } from "./harness/fixtures.js";
import { apiRequest, asAdmin } from "./harness/request.js";

/**
 * HACCP-58: a task template cannot reference equipment from another location,
 * even within the same organization — the service pre-check and the composite
 * DB constraint both guard this; here we exercise the HTTP boundary.
 */
describe("Task template equipment ownership", () => {
  let world: TwoTenantWorld;

  beforeEach(async () => {
    world = await seedTwoTenants(db);
  });

  it("rejects creating a template with equipment from another location in the same org", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.annex.id}/task-templates`,
      {
        method: "POST",
        actor: asAdmin(world.alpha),
        body: JSON.stringify({
          title: "Cross-location check",
          type: "temperature",
          weekdays: ["monday"],
          scheduledTimes: ["08:00"],
          equipmentId: world.alpha.equipment.fridge.id,
        }),
      },
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { message: string };
    expect(body.message).toBe("Equipment not found");
    expect(body.message).not.toContain(world.alpha.equipment.fridge.id);
  });

  it("rejects creating a template with equipment from another organization", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates`,
      {
        method: "POST",
        actor: asAdmin(world.alpha),
        body: JSON.stringify({
          title: "Cross-org check",
          type: "temperature",
          weekdays: ["monday"],
          scheduledTimes: ["08:00"],
          equipmentId: world.beta.equipment.fridge.id,
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  it("accepts creating a template with equipment from its own location", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates`,
      {
        method: "POST",
        actor: asAdmin(world.alpha),
        body: JSON.stringify({
          title: "Same-location check",
          type: "temperature",
          weekdays: ["monday"],
          scheduledTimes: ["08:00"],
          equipmentId: world.alpha.equipment.fridge.id,
        }),
      },
    );

    expect(response.status).toBe(201);
  });

  it("rejects updating a template to reference equipment from another location", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates/${world.alpha.templates.temperature.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world.alpha),
        body: JSON.stringify({
          title: world.alpha.templates.temperature.title,
          type: "temperature",
          weekdays: ["monday"],
          scheduledTimes: ["08:00"],
          equipmentId: world.beta.equipment.fridge.id,
        }),
      },
    );

    expect(response.status).toBe(404);
  });
});
