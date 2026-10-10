import type { TaskTemplateResponse } from "@haccp/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { forms } from "../../src/core/db/schema/index.js";
import {
  CLEANING_FIELD_ID,
  FRIDGE_FIELD_ID,
  seedTwoTenants,
  type SeededOrg,
  type TwoTenantWorld,
} from "./harness/fixtures.js";
import { apiRequest, asAdmin } from "./harness/request.js";

/**
 * A template may only use its organisation's active forms and its own location's
 * equipment & areas, and may only override limits the form's measurements have.
 */
describe("Task template form and target ownership", () => {
  let world: TwoTenantWorld;

  beforeEach(async () => {
    world = await seedTwoTenants(db);
  });

  function templateBody(
    org: SeededOrg,
    overrides: Record<string, unknown> = {},
  ): string {
    return JSON.stringify({
      title: "Fridge round",
      formId: org.forms.fridgeCheck.id,
      weekdays: ["monday"],
      scheduledTimes: ["08:00"],
      targets: [{ targetId: org.targets.fridge.id }],
      ...overrides,
    });
  }

  function create(locationId: string, body: string) {
    return apiRequest(`/locations/${locationId}/task-templates`, {
      method: "POST",
      actor: asAdmin(world.alpha),
      body,
    });
  }

  it("creates a template with its targets and per-target overrides", async () => {
    const response = await create(
      world.alpha.locations.main.id,
      templateBody(world.alpha, {
        targets: [
          {
            targetId: world.alpha.targets.fridge.id,
            limitOverrides: { [FRIDGE_FIELD_ID]: { min: 0, max: 2 } },
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as TaskTemplateResponse;
    expect(body).toMatchObject({
      formId: world.alpha.forms.fridgeCheck.id,
      formName: "Fridge check",
      formCategory: "temperature",
      targets: [
        {
          targetId: world.alpha.targets.fridge.id,
          targetName: "Fridge 1",
          limitOverrides: { [FRIDGE_FIELD_ID]: { min: 0, max: 2 } },
        },
      ],
    });
  });

  it("lists templates with their targets", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates`,
      { actor: asAdmin(world.alpha) },
    );

    const body = (await response.json()) as { items: TaskTemplateResponse[] };
    const fridgeRound = body.items.find(
      (item) => item.id === world.alpha.templates.temperature.id,
    );
    expect(fridgeRound?.targets.map((target) => target.targetName)).toEqual([
      "Fridge 1",
    ]);
    expect(
      body.items.find((item) => item.id === world.alpha.templates.cleaning.id)
        ?.targets,
    ).toEqual([]);
  });

  it("rejects a target from another location in the same org", async () => {
    const response = await create(
      world.alpha.locations.annex.id,
      templateBody(world.alpha),
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { message: string };
    expect(body.message).toBe("Equipment or area not found");
    expect(body.message).not.toContain(world.alpha.targets.fridge.id);
  });

  it("rejects a target from another organization", async () => {
    const response = await create(
      world.alpha.locations.main.id,
      templateBody(world.alpha, {
        targets: [{ targetId: world.beta.targets.fridge.id }],
      }),
    );

    expect(response.status).toBe(404);
  });

  it("rejects a form from another organization", async () => {
    const response = await create(
      world.alpha.locations.main.id,
      templateBody(world.alpha, { formId: world.beta.forms.fridgeCheck.id }),
    );

    expect(response.status).toBe(404);
    expect(((await response.json()) as { message: string }).message).toBe(
      "Form not found",
    );
  });

  it("rejects an archived form", async () => {
    await db
      .update(forms)
      .set({ archivedAt: new Date() })
      .where(eq(forms.id, world.alpha.forms.cleaning.id));

    const response = await create(
      world.alpha.locations.main.id,
      templateBody(world.alpha, {
        formId: world.alpha.forms.cleaning.id,
        targets: [],
      }),
    );

    expect(response.status).toBe(404);
  });

  it("rejects an override for a field that is not a measurement on the form", async () => {
    const response = await create(
      world.alpha.locations.main.id,
      templateBody(world.alpha, {
        formId: world.alpha.forms.cleaning.id,
        targets: [
          {
            targetId: world.alpha.targets.fridge.id,
            limitOverrides: { [CLEANING_FIELD_ID]: { min: 0, max: 1 } },
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects an override outside the unit's range", async () => {
    const response = await create(
      world.alpha.locations.main.id,
      templateBody(world.alpha, {
        targets: [
          {
            targetId: world.alpha.targets.fridge.id,
            limitOverrides: { [FRIDGE_FIELD_ID]: { min: 0, max: 150 } },
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects updating a template to use a target from another organization", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates/${world.alpha.templates.temperature.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world.alpha),
        body: templateBody(world.alpha, {
          targets: [{ targetId: world.beta.targets.fridge.id }],
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  it("replaces a template's targets on update", async () => {
    const response = await apiRequest(
      `/locations/${world.alpha.locations.main.id}/task-templates/${world.alpha.templates.temperature.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world.alpha),
        body: templateBody(world.alpha, { targets: [] }),
      },
    );

    expect(response.status).toBe(200);
    expect(((await response.json()) as TaskTemplateResponse).targets).toEqual(
      [],
    );
  });
});
