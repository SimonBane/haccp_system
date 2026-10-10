import {
  API_ERROR_CODE,
  droppedOverridesDetailsSchema,
  formListResponseSchema,
  formResponseSchema,
  targetListResponseSchema,
  targetResponseSchema,
  targetTypeListResponseSchema,
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

  describe("target types", () => {
    it("lists only the caller's organisation's types", async () => {
      const response = await apiRequest("/target-types", asAlpha("GET"));

      expect(response.status).toBe(200);
      const body = targetTypeListResponseSchema.parse(await response.json());
      expect(body.items.map((item) => item.id)).toEqual([
        world.alpha.targetTypes.fridge.id,
      ]);
    });

    it("refuses a duplicate active name with TARGET_TYPE_NAME_EXISTS", async () => {
      const response = await apiRequest(
        "/target-types",
        asAlpha("POST", { name: "Fridge", kind: "equipment" }),
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: API_ERROR_CODE.TARGET_TYPE_NAME_EXISTS,
      });
    });

    it("refuses to archive a type still used by a target", async () => {
      const response = await apiRequest(
        `/target-types/${world.alpha.targetTypes.fridge.id}`,
        asAlpha("DELETE"),
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: API_ERROR_CODE.TARGET_TYPE_IN_USE,
      });
    });

    it("cannot touch another organisation's type", async () => {
      const response = await apiRequest(
        `/target-types/${world.beta.targetTypes.fridge.id}`,
        asAlpha("PATCH", { name: "Hijacked", kind: "area" }),
      );

      expect(response.status).toBe(404);
    });

    it("is admin-only", async () => {
      const response = await apiRequest("/target-types", {
        actor: asEmployee(world.alpha),
      });

      expect(response.status).toBe(403);
    });
  });

  describe("targets", () => {
    const targetsPath = (locationId: string) =>
      `/locations/${locationId}/targets`;

    it("creates a target nested inside another, with its type", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", {
          name: "Top shelf",
          targetTypeId: world.alpha.targetTypes.fridge.id,
          parentId: world.alpha.targets.fridge.id,
        }),
      );

      expect(response.status).toBe(201);
      expect(targetResponseSchema.parse(await response.json())).toMatchObject({
        name: "Top shelf",
        parentId: world.alpha.targets.fridge.id,
        targetTypeName: "Fridge",
        kind: "equipment",
      });
    });

    it("refuses another organisation's type", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", {
          name: "Borrowed",
          targetTypeId: world.beta.targetTypes.fridge.id,
        }),
      );

      expect(response.status).toBe(404);
    });

    it("refuses a parent from another location", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.annex.id),
        asAlpha("POST", {
          name: "Annex shelf",
          targetTypeId: world.alpha.targetTypes.fridge.id,
          parentId: world.alpha.targets.fridge.id,
        }),
      );

      expect(response.status).toBe(404);
    });

    it("refuses to nest a target inside its own child", async () => {
      const child = targetResponseSchema.parse(
        await (
          await apiRequest(
            targetsPath(world.alpha.locations.main.id),
            asAlpha("POST", {
              name: "Shelf",
              targetTypeId: world.alpha.targetTypes.fridge.id,
              parentId: world.alpha.targets.fridge.id,
            }),
          )
        ).json(),
      );

      const response = await apiRequest(
        `${targetsPath(world.alpha.locations.main.id)}/${world.alpha.targets.fridge.id}`,
        asAlpha("PATCH", {
          name: "Fridge 1",
          targetTypeId: world.alpha.targetTypes.fridge.id,
          parentId: child.id,
        }),
      );

      expect(response.status).toBe(400);
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
          targetTypeId: world.alpha.targetTypes.fridge.id,
        }),
      );
      expect(recreated.status).toBe(201);
    });

    it("refuses a duplicate active name at the same location", async () => {
      const response = await apiRequest(
        targetsPath(world.alpha.locations.main.id),
        asAlpha("POST", {
          name: world.alpha.targets.fridge.name,
          targetTypeId: world.alpha.targetTypes.fridge.id,
        }),
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: API_ERROR_CODE.TARGET_NAME_EXISTS,
      });
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

    it("creates a form with version 1", async () => {
      const response = await apiRequest(
        "/forms",
        asAlpha("POST", {
          name: "Goods-in check",
          category: "goods_in",
          definition: CLEANING_DEFINITION,
        }),
      );

      expect(response.status).toBe(201);
      expect(
        formResponseSchema.parse(await response.json()).latestVersion.version,
      ).toBe(1);
    });

    it("rejects a definition with duplicate field ids", async () => {
      const response = await apiRequest(
        "/forms",
        asAlpha("POST", {
          name: "Broken",
          category: "other",
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
            templateTitle: world.alpha.templates.temperature.title,
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
