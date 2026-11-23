import {
  API_ERROR_CODE,
  droppedOverridesDetailsSchema,
  formListResponseSchema,
  formResponseSchema,
  targetListResponseSchema,
  targetResponseSchema,
  type FormDefinition,
} from "@haccp/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  taskTemplates,
  taskTemplateTargets,
} from "../../src/core/db/schema/index.js";
import {
  CLEANING_DEFINITION,
  FRIDGE_CHECK_DEFINITION,
  FRIDGE_FIELD_ID,
  seedTwoTenants,
  type TwoTenantWorld,
} from "./harness/fixtures.js";
import { apiRequest, asAdmin, asEmployee } from "./harness/request.js";

describe("Equipment & areas and forms (HTTP)", () => {
  let world: TwoTenantWorld;

  beforeEach(async () => {
    world = await seedTwoTenants(db);
  });

  function asAlpha(method: string, body?: unknown) {
    return {
      method,
      actor: asAdmin(world.alpha),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
  }

  describe("targets", () => {
    const targetsPath = (locationId: string) =>
      `/locations/${locationId}/targets`;

    async function createArea(name: string, parentId: string | null = null) {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", { name, kind: "area", parentId }),
      );
      expect(response.status).toBe(201);
      return targetResponseSchema.parse(await response.json());
    }

    it("lists targets with the number of active tasks checking them", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("GET"),
      );

      expect(response.status).toBe(200);
      const body = targetListResponseSchema.parse(await response.json());
      expect(body.items).toEqual([
        expect.objectContaining({
          id: world.alpha.targets.fridge.id,
          kind: "equipment",
          taskCount: 1,
        }),
      ]);
    });

    it("creates equipment inside an area", async () => {
      const kitchen = await createArea("Kitchen");

      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", {
          name: "Prep table",
          kind: "equipment",
          parentId: kitchen.id,
        }),
      );

      expect(response.status).toBe(201);
      expect(targetResponseSchema.parse(await response.json())).toMatchObject({
        name: "Prep table",
        kind: "equipment",
        parentId: kitchen.id,
        taskCount: 0,
      });
    });

    it("refuses to place anything inside equipment", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", {
          name: "Top shelf",
          kind: "equipment",
          parentId: world.alpha.targets.fridge.id,
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: API_ERROR_CODE.TARGET_PARENT_NOT_AREA,
      });
    });

    it("refuses a kind the database does not know", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", { name: "Van", kind: "vehicle" }),
      );

      expect(response.status).toBe(400);
    });

    it("refuses a parent from another location", async () => {
      const kitchen = await createArea("Kitchen");

      const response = await apiRequest(
        targetsPath(world.alpha.locations.annex.id),
        asAlpha("POST", {
          name: "Annex shelf",
          kind: "equipment",
          parentId: kitchen.id,
        }),
      );

      expect(response.status).toBe(404);
    });

    it("refuses to nest an area inside its own child", async () => {
      const kitchen = await createArea("Kitchen");
      const coldRoom = await createArea("Cold room", kitchen.id);

      const response = await apiRequest(
        `${targetsPath(world.alpha.locations.main.id)}/${kitchen.id}`,
        asAlpha("PATCH", {
          name: "Kitchen",
          kind: "area",
          parentId: coldRoom.id,
        }),
      );

      expect(response.status).toBe(400);
    });

    it("changes an item's kind while a task checks it, but not an area that holds items", async () => {
      const fridgeAsArea = await apiRequest(
        `${targetsPath(world.alpha.locations.main.id)}/${world.alpha.targets.fridge.id}`,
        asAlpha("PATCH", {
          name: world.alpha.targets.fridge.name,
          kind: "area",
        }),
      );
      expect(fridgeAsArea.status).toBe(200);

      const kitchen = await createArea("Kitchen");
      await createArea("Cold room", kitchen.id);
      const kitchenAsEquipment = await apiRequest(
        `${targetsPath(world.alpha.locations.main.id)}/${kitchen.id}`,
        asAlpha("PATCH", { name: "Kitchen", kind: "equipment" }),
      );
      expect(kitchenAsEquipment.status).toBe(409);
      expect(await kitchenAsEquipment.json()).toMatchObject({
        error: API_ERROR_CODE.TARGET_KIND_IN_USE,
      });
    });

    it("archives a target: hidden from the list, unlinked from templates, name reusable", async () => {
      const removed = await apiRequest(
        `${targetsPath(world.alpha.locations.main.id)}/${world.alpha.targets.fridge.id}`,
        asAlpha("DELETE"),
      );
      expect(removed.status).toBe(204);

      const list = targetListResponseSchema.parse(
        await (
          await apiRequest(
            targetsPath(world.alpha.locations.main.id),
            asAlpha("GET"),
          )
        ).json(),
      );
      expect(list.items).toEqual([]);

      const links = await db
        .select()
        .from(taskTemplateTargets)
        .where(eq(taskTemplateTargets.targetId, world.alpha.targets.fridge.id));
      expect(links).toEqual([]);

      const recreated = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", {
          name: world.alpha.targets.fridge.name,
          kind: "equipment",
        }),
      );
      expect(recreated.status).toBe(201);
    });

    it("refuses a duplicate active name at the same location", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", {
          name: world.alpha.targets.fridge.name,
          kind: "equipment",
        }),
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: API_ERROR_CODE.TARGET_NAME_EXISTS,
      });
    });

    it("creates fixtures inside areas, repeating a name only across areas", async () => {
      const kitchen = await createArea("Kitchen");
      const bar = await createArea("Bar");
      const createFixture = (parentId: string | null) =>
        apiRequest(
          targetsPath(world.alpha.locations.main.id),
          asAlpha("POST", { name: "Walls", kind: "fixture", parentId }),
        );

      const kitchenWalls = await createFixture(kitchen.id);
      expect(kitchenWalls.status).toBe(201);
      expect(targetResponseSchema.parse(await kitchenWalls.json())).toMatchObject({
        kind: "fixture",
        parentId: kitchen.id,
      });
      expect((await createFixture(bar.id)).status).toBe(201);

      const duplicate = await createFixture(kitchen.id);
      expect(duplicate.status).toBe(409);
      expect(await duplicate.json()).toMatchObject({
        error: API_ERROR_CODE.TARGET_NAME_EXISTS,
      });
      expect((await createFixture(null)).status).toBe(400);
    });

    it("refuses to place a fixture inside equipment", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", {
          name: "Door",
          kind: "fixture",
          parentId: world.alpha.targets.fridge.id,
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: API_ERROR_CODE.TARGET_PARENT_NOT_AREA,
      });
    });

    it("is admin-only for writes", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        {
          method: "POST",
          actor: asEmployee(world.alpha),
          body: JSON.stringify({ name: "Kitchen", kind: "area" }),
        },
      );

      expect(response.status).toBe(403);
    });
  });

  describe("forms", () => {
    const withDoorCheck: FormDefinition = {
      ...FRIDGE_CHECK_DEFINITION,
      fields: [
        ...FRIDGE_CHECK_DEFINITION.fields,
        {
          id: "door_closed",
          type: "checkbox",
          label: "Door closed",
          required: true,
        },
      ],
    };

    async function overrideFishFridge(): Promise<void> {
      await db
        .update(taskTemplateTargets)
        .set({ limitOverrides: { [FRIDGE_FIELD_ID]: { min: 0, max: 2 } } })
        .where(eq(taskTemplateTargets.targetId, world.alpha.targets.fridge.id));
    }

    it("lists the organisation's forms with their latest version", async () => {
      const response = await apiRequest("/forms", asAlpha("GET"));

      const body = formListResponseSchema.parse(await response.json());
      expect(body.items.map((item) => item.name).sort()).toEqual([
        "Cleaning",
        "Fridge check",
      ]);
      expect(body.items.every((item) => item.latestVersion.version === 1)).toBe(
        true,
      );
    });

    it("counts only active templates per form", async () => {
      await db
        .update(taskTemplates)
        .set({ archivedAt: new Date() })
        .where(eq(taskTemplates.id, world.alpha.templates.cleaning.id));

      const response = await apiRequest("/forms", asAlpha("GET"));

      const body = formListResponseSchema.parse(await response.json());
      const countByName = Object.fromEntries(
        body.items.map((item) => [item.name, item.templateCount]),
      );
      expect(countByName).toEqual({ "Fridge check": 1, Cleaning: 0 });
    });

    it("creates a form with version 1", async () => {
      const response = await apiRequest(
        "/forms",
        asAlpha("POST", {
          name: "Goods-in check",
          category: "goods_in",
          appliesTo: "location",
          definition: CLEANING_DEFINITION,
        }),
      );

      expect(response.status).toBe(201);
      const body = formResponseSchema.parse(await response.json());
      expect(body.latestVersion.version).toBe(1);
      expect(body.appliesTo).toBe("location");
    });

    it("refuses whole-location while a task checks items, and per-item while one checks none", async () => {
      const toLocation = await apiRequest(
        `/forms/${world.alpha.forms.fridgeCheck.id}`,
        asAlpha("PATCH", {
          name: "Fridge check",
          category: "temperature",
          appliesTo: "location",
        }),
      );
      const toPerItem = await apiRequest(
        `/forms/${world.alpha.forms.cleaning.id}`,
        asAlpha("PATCH", {
          name: "Cleaning",
          category: "cleaning",
          appliesTo: "per_item",
        }),
      );

      for (const response of [toLocation, toPerItem]) {
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
          error: API_ERROR_CODE.FORM_APPLIES_TO_IN_USE,
        });
      }
    });

    it("changes applies-to freely while no task uses the form", async () => {
      const created = await apiRequest(
        "/forms",
        asAlpha("POST", {
          name: "Room inspection",
          category: "hygiene",
          appliesTo: "location",
          definition: CLEANING_DEFINITION,
        }),
      );
      const form = formResponseSchema.parse(await created.json());

      const response = await apiRequest(
        `/forms/${form.id}`,
        asAlpha("PATCH", {
          name: "Room inspection",
          category: "hygiene",
          appliesTo: "per_item",
        }),
      );

      expect(response.status).toBe(200);
      expect(formResponseSchema.parse(await response.json()).appliesTo).toBe(
        "per_item",
      );
    });

    it("rejects a definition with duplicate field ids", async () => {
      const response = await apiRequest(
        "/forms",
        asAlpha("POST", {
          name: "Broken",
          category: "hygiene",
          appliesTo: "location",
          definition: {
            ...CLEANING_DEFINITION,
            fields: [
              ...CLEANING_DEFINITION.fields,
              ...CLEANING_DEFINITION.fields,
            ],
          },
        }),
      );

      expect(response.status).toBe(400);
    });

    it("cannot read another organisation's form", async () => {
      const response = await apiRequest(
        `/forms/${world.beta.forms.fridgeCheck.id}`,
        asAlpha("GET"),
      );

      expect(response.status).toBe(404);
    });

    it("publishes the next version and leaves an unchanged one alone", async () => {
      const published = await apiRequest(
        `/forms/${world.alpha.forms.fridgeCheck.id}/versions`,
        asAlpha("POST", { definition: withDoorCheck }),
      );
      expect(published.status).toBe(201);
      expect(
        formResponseSchema.parse(await published.json()).latestVersion.version,
      ).toBe(2);

      const repeated = await apiRequest(
        `/forms/${world.alpha.forms.fridgeCheck.id}/versions`,
        asAlpha("POST", { definition: withDoorCheck }),
      );
      expect(
        formResponseSchema.parse(await repeated.json()).latestVersion.version,
      ).toBe(2);
    });

    it("warns with every override a version would drop, then drops them once confirmed", async () => {
      await overrideFishFridge();
      const withoutTemperature: FormDefinition = {
        ...FRIDGE_CHECK_DEFINITION,
        fields: [
          {
            id: "door_closed",
            type: "checkbox",
            label: "Door closed",
            required: true,
          },
        ],
      };

      const refused = await apiRequest(
        `/forms/${world.alpha.forms.fridgeCheck.id}/versions`,
        asAlpha("POST", { definition: withoutTemperature }),
      );

      expect(refused.status).toBe(409);
      const error = (await refused.json()) as {
        error: string;
        details: unknown;
      };
      expect(error.error).toBe(API_ERROR_CODE.FORM_VERSION_DROPS_OVERRIDES);
      expect(droppedOverridesDetailsSchema.parse(error.details)).toEqual({
        droppedOverrides: [
          {
            templateId: world.alpha.templates.temperature.id,
            locationId: world.alpha.locations.main.id,
            locationName: world.alpha.locations.main.name,
            targetId: world.alpha.targets.fridge.id,
            targetName: world.alpha.targets.fridge.name,
            fieldId: FRIDGE_FIELD_ID,
            fieldLabel: "Temperature",
            limits: { min: 0, max: 2 },
          },
        ],
      });

      const unchanged = await apiRequest(
        `/forms/${world.alpha.forms.fridgeCheck.id}`,
        asAlpha("GET"),
      );
      expect(
        formResponseSchema.parse(await unchanged.json()).latestVersion.version,
      ).toBe(1);

      const confirmed = await apiRequest(
        `/forms/${world.alpha.forms.fridgeCheck.id}/versions`,
        asAlpha("POST", {
          definition: withoutTemperature,
          confirmDroppedOverrides: true,
        }),
      );
      expect(confirmed.status).toBe(201);

      const [link] = await db
        .select()
        .from(taskTemplateTargets)
        .where(eq(taskTemplateTargets.targetId, world.alpha.targets.fridge.id));
      expect(link?.limitOverrides).toEqual({});
    });

    it("refuses to archive a form a template uses, and archives it once unused", async () => {
      const refused = await apiRequest(
        `/forms/${world.alpha.forms.cleaning.id}`,
        asAlpha("DELETE"),
      );
      expect(refused.status).toBe(409);
      expect(await refused.json()).toMatchObject({
        error: API_ERROR_CODE.FORM_IN_USE,
      });

      await db
        .update(taskTemplates)
        .set({ archivedAt: new Date() })
        .where(eq(taskTemplates.id, world.alpha.templates.cleaning.id));

      const archived = await apiRequest(
        `/forms/${world.alpha.forms.cleaning.id}`,
        asAlpha("DELETE"),
      );
      expect(archived.status).toBe(204);
    });

    it("is admin-only", async () => {
      const response = await apiRequest("/forms", {
        actor: asEmployee(world.alpha),
      });

      expect(response.status).toBe(403);
    });
  });
});
