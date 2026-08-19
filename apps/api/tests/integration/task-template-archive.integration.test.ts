import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { taskTemplates } from "../../src/core/db/schema/index.js";
import { seedTwoTenants, type TwoTenantWorld } from "./harness/fixtures.js";
import { apiRequest, asAdmin } from "./harness/request.js";

/**
 * HACCP-11: DELETE on a task template archives it in place — active reads and
 * Today must stop seeing it, but the row itself is preserved.
 */
describe("Task template archive on delete", () => {
  let world: TwoTenantWorld;

  beforeEach(async () => {
    world = await seedTwoTenants(db);
  });

  it("sets archivedAt instead of removing the row", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates/${world.alpha.templates.cleaning.id}`,
      { method: "DELETE", actor: asAdmin(world.alpha) },
    );

    expect(response.status).toBe(204);

    const [row] = await db
      .select()
      .from(taskTemplates)
      .where(eq(taskTemplates.id, world.alpha.templates.cleaning.id));

    expect(row?.archivedAt).not.toBeNull();
  });

  it("returns not found for a template that is already archived", async () => {
    await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates/${world.alpha.templates.cleaning.id}`,
      { method: "DELETE", actor: asAdmin(world.alpha) },
    );

    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates/${world.alpha.templates.cleaning.id}`,
      { method: "DELETE", actor: asAdmin(world.alpha) },
    );

    expect(response.status).toBe(404);
  });

  it("returns not found for an unknown template id", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates/00000000-0000-4000-8000-000000000000`,
      { method: "DELETE", actor: asAdmin(world.alpha) },
    );

    expect(response.status).toBe(404);
  });

  it("hides the archived template from the active admin list", async () => {
    await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates/${world.alpha.templates.cleaning.id}`,
      { method: "DELETE", actor: asAdmin(world.alpha) },
    );

    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates`,
      { method: "GET", actor: asAdmin(world.alpha) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { id: string }[] };
    expect(body.items.map((item) => item.id)).not.toContain(
      world.alpha.templates.cleaning.id,
    );
    expect(body.items.map((item) => item.id)).toContain(
      world.alpha.templates.temperature.id,
    );
  });

  it("stops Today from listing tasks from an archived template", async () => {
    await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates/${world.alpha.templates.cleaning.id}`,
      { method: "DELETE", actor: asAdmin(world.alpha) },
    );

    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/today?date=2026-08-19`,
      { method: "GET", actor: asAdmin(world.alpha) },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      sections: Record<string, { templateId: string }[]>;
    };
    const allItems = Object.values(body.sections).flat();
    expect(
      allItems.some(
        (item) => item.templateId === world.alpha.templates.cleaning.id,
      ),
    ).toBe(false);
    expect(
      allItems.some(
        (item) => item.templateId === world.alpha.templates.temperature.id,
      ),
    ).toBe(true);
  });
});
