import { describe, expect, it } from "vitest";
import {
  TARGET_NAME_MAX_LENGTH,
  isTargetNameTaken,
  targetDisplayName,
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

  it("accepts only equipment, area and fixture", () => {
    expect(
      targetInputSchema.safeParse({ name: "Kitchen", kind: "area" }).success,
    ).toBe(true);
    expect(
      targetInputSchema.safeParse({
        name: "Walls",
        kind: "fixture",
        parentId: AREA_ID,
      }).success,
    ).toBe(true);
    for (const kind of ["surface", "vehicle", "room"]) {
      expect(
        targetInputSchema.safeParse({ name: "Kitchen", kind }).success,
      ).toBe(false);
    }
  });

  it("refuses a fixture outside an area", () => {
    const result = targetInputSchema.safeParse({ name: "Walls", kind: "fixture" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["parentId"]);
  });
});

describe("isTargetNameTaken", () => {
  const existing = [
    { id: "a", name: "Kitchen", kind: "area", parentId: null },
    { id: "b", name: "Walls", kind: "fixture", parentId: AREA_ID },
    { id: "c", name: "Fridge", kind: "equipment", parentId: AREA_ID },
  ] as const;

  it("lets a fixture name repeat in another area but not in the same one", () => {
    expect(
      isTargetNameTaken(existing, { name: "Walls", kind: "fixture", parentId: OTHER_AREA_ID }),
    ).toBe(false);
    expect(
      isTargetNameTaken(existing, { name: "Walls", kind: "fixture", parentId: AREA_ID }),
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

  it("never clashes a fixture with equipment or an area, nor an item with itself", () => {
    expect(
      isTargetNameTaken(existing, { name: "Kitchen", kind: "fixture", parentId: AREA_ID }),
    ).toBe(false);
    expect(
      isTargetNameTaken(existing, { id: "b", name: "Walls", kind: "fixture", parentId: AREA_ID }),
    ).toBe(false);
  });
});

describe("targetDisplayName", () => {
  it("prefixes only fixtures with their area", () => {
    expect(targetDisplayName({ name: "Walls", kind: "fixture" }, "Kitchen 2")).toBe(
      "Kitchen 2 › Walls",
    );
    expect(targetDisplayName({ name: "Fridge", kind: "equipment" }, "Kitchen 2")).toBe(
      "Fridge",
    );
    expect(targetDisplayName({ name: "Walls", kind: "fixture" }, null)).toBe("Walls");
  });
});

describe("target name limit", () => {
  it("accepts the limit and rejects one character more", () => {
    const name = "a".repeat(TARGET_NAME_MAX_LENGTH);
    expect(targetInputSchema.safeParse({ name, kind: "area" }).success).toBe(true);
    expect(targetInputSchema.safeParse({ name: `${name}a`, kind: "area" }).success).toBe(false);
  });
});
