import {
  API_ERROR_CODE,
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
  taskOccurrences,
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

    it("stores an item's own range and refuses one on a component", async () => {
      const kitchen = await createArea("Kitchen", null);
      const range = { temperature: { min: null, max: 16 } };

      const room = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", { name: "Cutting room", kind: "area", limits: range }),
      );
      const walls = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", {
          name: "Walls",
          kind: "component",
          parentId: kitchen.id,
          limits: range,
        }),
      );

      expect(room.status).toBe(201);
      expect(targetResponseSchema.parse(await room.json()).limits).toEqual(
        range,
      );
      expect(walls.status).toBe(400);
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

    it("creates components inside areas, repeating a name only across areas", async () => {
      const kitchen = await createArea("Kitchen");
      const bar = await createArea("Bar");
      const createComponent = (parentId: string | null) =>
        apiRequest(
          targetsPath(world.alpha.locations.main.id),
          asAlpha("POST", { name: "Walls", kind: "component", parentId }),
        );

      const kitchenWalls = await createComponent(kitchen.id);
      expect(kitchenWalls.status).toBe(201);
      expect(targetResponseSchema.parse(await kitchenWalls.json())).toMatchObject({
        kind: "component",
        parentId: kitchen.id,
      });
      expect((await createComponent(bar.id)).status).toBe(201);

      const duplicate = await createComponent(kitchen.id);
      expect(duplicate.status).toBe(409);
      expect(await duplicate.json()).toMatchObject({
        error: API_ERROR_CODE.TARGET_NAME_EXISTS,
      });
      expect((await createComponent(null)).status).toBe(400);
    });

    it("refuses to place a component inside equipment", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", {
          name: "Door",
          kind: "component",
          parentId: world.alpha.targets.fridge.id,
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: API_ERROR_CODE.TARGET_PARENT_NOT_AREA,
      });
    });

    describe("duplicate", () => {
      const mainId = () => world.alpha.locations.main.id;

      async function createIn(
        name: string,
        kind: "equipment" | "area" | "component",
        parentId: string | null,
        limits: Record<string, unknown> = {},
      ) {
        const response = await apiRequest(
          targetsPath(mainId()),
          asAlpha("POST", { name, kind, parentId, limits }),
        );
        expect(response.status).toBe(201);
        return targetResponseSchema.parse(await response.json());
      }

      async function listAll() {
        const response = await apiRequest(targetsPath(mainId()), asAlpha("GET"));
        return targetListResponseSchema.parse(await response.json()).items;
      }

      const duplicate = (sourceId: string, body: unknown) =>
        apiRequest(
          `${targetsPath(mainId())}/${sourceId}/duplicate`,
          asAlpha("POST", body),
        );

      // Kitchen ⟵ Cold room ⟵ Fish fridge; Kitchen ⟵ Walls
      async function seedKitchen() {
        const kitchen = await createIn("Kitchen", "area", null, {
          temperature: { min: 10, max: 25 },
        });
        const cold = await createIn("Cold room", "area", kitchen.id);
        const fridge = await createIn("Fish fridge", "equipment", cold.id, {
          temperature: { min: 0, max: 4 },
        });
        const walls = await createIn("Walls", "component", kitchen.id);
        return { kitchen, cold, fridge, walls };
      }

      it("copies an area with everything inside it, keeping ranges and nesting", async () => {
        const { kitchen, cold, fridge, walls } = await seedKitchen();

        const response = await duplicate(kitchen.id, {
          target: {
            name: "Kitchen 2",
            kind: "area",
            parentId: null,
            limits: { temperature: { min: 10, max: 25 } },
          },
          contents: [
            { sourceId: cold.id, name: "Cold room 2" },
            { sourceId: fridge.id, name: "Fish fridge 2" },
            { sourceId: walls.id, name: "Walls" },
          ],
        });

        expect(response.status).toBe(201);
        const copy = targetResponseSchema.parse(await response.json());
        expect(copy).toMatchObject({ name: "Kitchen 2", kind: "area", parentId: null });

        const items = await listAll();
        const byName = (name: string, parentId: string) =>
          items.find((item) => item.name === name && item.parentId === parentId);
        const coldCopy = byName("Cold room 2", copy.id);
        expect(coldCopy).toMatchObject({ kind: "area", limits: {} });
        expect(byName("Fish fridge 2", coldCopy!.id)).toMatchObject({
          kind: "equipment",
          limits: { temperature: { min: 0, max: 4 } },
          taskCount: 0,
        });
        expect(byName("Walls", copy.id)).toMatchObject({ kind: "component" });
        expect(items.filter((item) => item.parentId === kitchen.id)).toHaveLength(2);
      });

      it("copies only the area when no contents are named", async () => {
        const { kitchen } = await seedKitchen();
        const before = (await listAll()).length;

        const response = await duplicate(kitchen.id, {
          target: { name: "Kitchen 2", kind: "area", parentId: null },
        });

        expect(response.status).toBe(201);
        expect(await listAll()).toHaveLength(before + 1);
      });

      it("refuses contents from outside the copied area and writes nothing", async () => {
        const { kitchen, cold } = await seedKitchen();
        const before = (await listAll()).length;

        const response = await duplicate(kitchen.id, {
          target: { name: "Kitchen 2", kind: "area", parentId: null },
          contents: [
            { sourceId: cold.id, name: "Cold room 2" },
            { sourceId: world.alpha.targets.fridge.id, name: "Fridge 2" },
          ],
        });

        expect(response.status).toBe(400);
        expect(await listAll()).toHaveLength(before);
      });

      it("refuses an item whose own area is left out of the copy", async () => {
        const { kitchen, fridge } = await seedKitchen();

        const response = await duplicate(kitchen.id, {
          target: { name: "Kitchen 2", kind: "area", parentId: null },
          contents: [{ sourceId: fridge.id, name: "Fish fridge 2" }],
        });

        expect(response.status).toBe(400);
      });

      it("rolls the whole copy back when one name is taken", async () => {
        const { kitchen, cold } = await seedKitchen();
        const before = (await listAll()).length;

        const response = await duplicate(kitchen.id, {
          target: { name: "Kitchen 2", kind: "area", parentId: null },
          contents: [{ sourceId: cold.id, name: world.alpha.targets.fridge.name }],
        });

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
          error: API_ERROR_CODE.TARGET_NAME_EXISTS,
        });
        expect(await listAll()).toHaveLength(before);
      });

      it("cannot copy another organisation's item", async () => {
        const response = await duplicate(world.beta.targets.fridge.id, {
          target: { name: "Stolen fridge", kind: "equipment", parentId: null },
        });

        expect(response.status).toBe(404);
      });

      it("is admin-only", async () => {
        const response = await apiRequest(
          `${targetsPath(mainId())}/${world.alpha.targets.fridge.id}/duplicate`,
          {
            method: "POST",
            actor: asEmployee(world.alpha),
            body: JSON.stringify({
              target: { name: "Fridge 2", kind: "equipment", parentId: null },
            }),
          },
        );

        expect(response.status).toBe(403);
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

    it("keeps judging an item by its own range after a new version", async () => {
      const fridge = world.alpha.targets.fridge;
      const updated = await apiRequest(
        `/locations/${world.alpha.locations.main.id}/targets/${fridge.id}`,
        asAlpha("PATCH", {
          name: fridge.name,
          kind: "equipment",
          limits: { temperature: { min: null, max: 2 } },
        }),
      );
      expect(updated.status).toBe(200);

      const published = await apiRequest(
        `/forms/${world.alpha.forms.fridgeCheck.id}/versions`,
        asAlpha("POST", { definition: withDoorCheck }),
      );
      expect(published.status).toBe(201);
      const versionId = formResponseSchema.parse(await published.json())
        .latestVersion.id;

      const upcoming = await db
        .select()
        .from(taskOccurrences)
        .where(eq(taskOccurrences.formVersionId, versionId));
      expect(upcoming.length).toBeGreaterThan(0);
      expect(
        upcoming.every(
          (row) =>
            row.resolvedLimits[FRIDGE_FIELD_ID]?.max === 2 &&
            row.resolvedLimits[FRIDGE_FIELD_ID]?.min === null,
        ),
      ).toBe(true);
    });

    it("judges each field of one item by the item's range for what it measures", async () => {
      const fridge = world.alpha.targets.fridge;
      const updated = await apiRequest(
        `/locations/${world.alpha.locations.main.id}/targets/${fridge.id}`,
        asAlpha("PATCH", {
          name: fridge.name,
          kind: "equipment",
          limits: {
            temperature: { min: 0, max: 4 },
            humidity: { min: 80, max: 90 },
          },
        }),
      );
      expect(updated.status).toBe(200);

      const withHumidity: FormDefinition = {
        ...FRIDGE_CHECK_DEFINITION,
        fields: [
          ...FRIDGE_CHECK_DEFINITION.fields,
          {
            id: "humidity",
            type: "measurement",
            label: "Humidity",
            required: true,
            parameter: "humidity",
            unit: "percent",
            limits: { min: null, max: 95 },
          },
        ],
      };
      const published = await apiRequest(
        `/forms/${world.alpha.forms.fridgeCheck.id}/versions`,
        asAlpha("POST", { definition: withHumidity }),
      );
      expect(published.status).toBe(201);
      const versionId = formResponseSchema.parse(await published.json())
        .latestVersion.id;

      const upcoming = await db
        .select()
        .from(taskOccurrences)
        .where(eq(taskOccurrences.formVersionId, versionId));
      expect(upcoming.length).toBeGreaterThan(0);
      for (const row of upcoming) {
        expect(row.resolvedLimits).toEqual({
          [FRIDGE_FIELD_ID]: { min: 0, max: 4 },
          humidity: { min: 80, max: 90 },
        });
      }
    });

    it("refuses a version that switches a published field to another parameter", async () => {
      const switched: FormDefinition = {
        ...FRIDGE_CHECK_DEFINITION,
        fields: FRIDGE_CHECK_DEFINITION.fields.map((field) =>
          field.type === "measurement"
            ? { ...field, parameter: "humidity", unit: "percent" }
            : field,
        ),
      };

      const response = await apiRequest(
        `/forms/${world.alpha.forms.fridgeCheck.id}/versions`,
        asAlpha("POST", { definition: switched }),
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: API_ERROR_CODE.FORM_FIELD_PARAMETER_CHANGED,
        details: { fieldIds: [FRIDGE_FIELD_ID] },
      });
    });

    it("refuses an item range for a measurement that always uses the form's limits", async () => {
      const fridge = world.alpha.targets.fridge;
      const response = await apiRequest(
        `/locations/${world.alpha.locations.main.id}/targets/${fridge.id}`,
        asAlpha("PATCH", {
          name: fridge.name,
          kind: "equipment",
          limits: { ph: { min: 4, max: 6 } },
        }),
      );

      expect(response.status).toBe(400);
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
