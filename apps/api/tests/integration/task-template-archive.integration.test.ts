import { addCalendarDays, zonedDateString } from "@haccp/shared";
import { eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { taskTemplates } from "../../src/core/db/schema/index.js";
import { seedTwoTenants, type TwoTenantWorld } from "./harness/fixtures.js";
import { apiRequest, asAdmin } from "./harness/request.js";

const CRON_SECRET = process.env.CRON_SECRET ?? "test-cron-secret-integration";

/** seedOrganization inserts templates at "now" — backdate so today's slot is never cut off by the "not retroactive" guard regardless of run time. */
async function backdateAlphaTemplates(world: TwoTenantWorld): Promise<void> {
  await db
    .update(taskTemplates)
    .set({ createdAt: new Date("2020-01-01T00:00:00Z") })
    .where(
      inArray(taskTemplates.id, [
        world.alpha.templates.temperature.id,
        world.alpha.templates.cleaning.id,
      ]),
    );
}

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
    await backdateAlphaTemplates(world);

    // Materializes today's occurrence for both seeded templates (HACCP-12) so Today (HACCP-15) has something to read.
    const materialize = await apiRequest("/internal/task-occurrences/materialize", {
      method: "GET",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(materialize.status).toBe(200);

    // A future, not-yet-due date: today's own occurrence is protected (already due) and
    // must survive an archive untouched — a separate invariant covered elsewhere.
    const futureDate = addCalendarDays(
      zonedDateString(new Date(), world.alpha.timeZone),
      1,
    );

    await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates/${world.alpha.templates.cleaning.id}`,
      { method: "DELETE", actor: asAdmin(world.alpha) },
    );

    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/today?date=${futureDate}`,
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
