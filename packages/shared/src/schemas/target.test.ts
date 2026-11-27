import { describe, expect, it } from "vitest";
import {
  TARGET_NAME_MAX_LENGTH,
  isTargetNameTaken,
  splitTargetDisplayName,
  targetDisplayName,
  targetDuplicateInputSchema,
  targetInputSchema,
} from "./target.js";

const AREA_ID = "8f9d3a52-6f2e-4c1b-9a7e-1d2c3b4a5f60";
const OTHER_AREA_ID = "0b6e2d1c-3a4f-4e5d-8c7b-9a8f7e6d5c4b";

describe("targetInputSchema", () => {
  it("defaults parentId to null", () => {
    expect(
      targetInputSchema.parse({ name: "Fish fridge", kind: "equipment" })
        .parentId,
    ).toBeNull();
  });

  it("trims and requires a name", () => {
    expect(
      targetInputSchema.parse({ name: "  Prep table 2 ", kind: "equipment" })
        .name,
    ).toBe("Prep table 2");
    expect(
      targetInputSchema.safeParse({ name: "  ", kind: "equipment" }).success,
    ).toBe(false);
  });

  it("accepts only equipment, area and component", () => {
    expect(
      targetInputSchema.safeParse({ name: "Kitchen", kind: "area" }).success,
    ).toBe(true);
    expect(
      targetInputSchema.safeParse({
        name: "Walls",
        kind: "component",
        parentId: AREA_ID,
      }).success,
    ).toBe(true);
    for (const kind of ["surface", "vehicle", "room"]) {
      expect(
        targetInputSchema.safeParse({ name: "Kitchen", kind }).success,
      ).toBe(false);
    }
  });

  it("refuses a component outside an area", () => {
    const result = targetInputSchema.safeParse({ name: "Walls", kind: "component" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["parentId"]);
  });
});

describe("targetInputSchema limits", () => {
  const fridge = { name: "Fridge 20", kind: "equipment" };

  it("defaults to no range of its own", () => {
    expect(targetInputSchema.parse(fridge).limits).toEqual({});
  });

  it("keys a range by parameter and accepts one-sided bounds", () => {
    const limits = {
      temperature: { min: 0, max: 4 },
      humidity: { min: 80, max: null },
    };

    expect(targetInputSchema.parse({ ...fridge, limits }).limits).toEqual(limits);
  });

  it("refuses an empty range, a reversed one and one beyond the parameter's unit", () => {
    const parse = (limits: unknown) =>
      targetInputSchema.safeParse({ ...fridge, limits }).success;

    expect(parse({ temperature: { min: null, max: null } })).toBe(false);
    expect(parse({ temperature: { min: 8, max: 7 } })).toBe(false);
    expect(parse({ temperature: { min: null, max: 120 } })).toBe(false);
    expect(parse({ humidity: { min: 80, max: 101 } })).toBe(false);
    expect(parse({ celsius: { min: null, max: 4 } })).toBe(false);
  });

  it("refuses a range for a measurement that always uses the form's limits", () => {
    expect(
      targetInputSchema.safeParse({ ...fridge, limits: { ph: { min: 4, max: 6 } } })
        .success,
    ).toBe(false);
  });

  it("gives an area a range but never a component", () => {
    const limits = { temperature: { min: null, max: 16 } };

    expect(
      targetInputSchema.safeParse({ name: "Cutting room", kind: "area", limits })
        .success,
    ).toBe(true);
    expect(
      targetInputSchema.safeParse({
        name: "Walls",
        kind: "component",
        parentId: AREA_ID,
        limits,
      }).success,
    ).toBe(false);
  });
});

describe("isTargetNameTaken", () => {
  const existing = [
    { id: "a", name: "Kitchen", kind: "area", parentId: null },
    { id: "b", name: "Walls", kind: "component", parentId: AREA_ID },
    { id: "c", name: "Fridge", kind: "equipment", parentId: AREA_ID },
  ] as const;

  it("lets a component name repeat in another area but not in the same one", () => {
    expect(
      isTargetNameTaken(existing, { name: "Walls", kind: "component", parentId: OTHER_AREA_ID }),
    ).toBe(false);
    expect(
      isTargetNameTaken(existing, { name: "Walls", kind: "component", parentId: AREA_ID }),
    ).toBe(true);
  });

  it("keeps equipment and area names unique across the location", () => {
    expect(
      isTargetNameTaken(existing, { name: "Fridge", kind: "equipment", parentId: null }),
    ).toBe(true);
    expect(
      isTargetNameTaken(existing, { name: "Kitchen", kind: "equipment", parentId: null }),
    ).toBe(true);
  });

  it("never clashes a component with equipment or an area, nor an item with itself", () => {
    expect(
      isTargetNameTaken(existing, { name: "Kitchen", kind: "component", parentId: AREA_ID }),
    ).toBe(false);
    expect(
      isTargetNameTaken(existing, { id: "b", name: "Walls", kind: "component", parentId: AREA_ID }),
    ).toBe(false);
  });
});

describe("targetDisplayName", () => {
  it("prefixes only components with their area", () => {
    expect(targetDisplayName({ name: "Walls", kind: "component" }, "Kitchen 2")).toBe(
      "Kitchen 2 › Walls",
    );
    expect(targetDisplayName({ name: "Fridge", kind: "equipment" }, "Kitchen 2")).toBe(
      "Fridge",
    );
    expect(targetDisplayName({ name: "Walls", kind: "component" }, null)).toBe("Walls");
  });
});

describe("splitTargetDisplayName", () => {
  it("reads a component's area back out of its display name", () => {
    expect(splitTargetDisplayName("Kitchen 2 › Walls")).toEqual({
      area: "Kitchen 2",
      name: "Walls",
    });
  });

  it("leaves a name without an area whole", () => {
    expect(splitTargetDisplayName("Fridge")).toEqual({ area: null, name: "Fridge" });
  });

  it("round-trips what targetDisplayName wrote", () => {
    const shown = targetDisplayName({ name: "Floor", kind: "component" }, "Cold room");
    expect(splitTargetDisplayName(shown)).toEqual({ area: "Cold room", name: "Floor" });
  });
});

describe("target name limit", () => {
  it("accepts the limit and rejects one character more", () => {
    const name = "a".repeat(TARGET_NAME_MAX_LENGTH);
    expect(targetInputSchema.safeParse({ name, kind: "area" }).success).toBe(true);
    expect(targetInputSchema.safeParse({ name: `${name}a`, kind: "area" }).success).toBe(false);
  });
});

describe("targetDuplicateInputSchema", () => {
  const target = { name: "Kitchen 2", kind: "area" };

  it("copies nothing inside by default", () => {
    expect(targetDuplicateInputSchema.parse({ target }).contents).toEqual([]);
  });

  it("refuses the same item twice in the contents", () => {
    expect(
      targetDuplicateInputSchema.safeParse({
        target,
        contents: [
          { sourceId: AREA_ID, name: "Cold room 2" },
          { sourceId: AREA_ID, name: "Cold room 3" },
        ],
      }).success,
    ).toBe(false);
  });
});
