import { describe, expect, it } from "vitest";
import {
  STARTER_TARGET_TYPES,
  targetInputSchema,
  targetKindSchema,
  targetTypeInputSchema,
} from "./target.js";

const TYPE_ID = "11111111-1111-4111-8111-111111111111";

describe("targetInputSchema", () => {
  it("defaults parentId to null", () => {
    expect(
      targetInputSchema.parse({ name: "Fish fridge", targetTypeId: TYPE_ID })
        .parentId,
    ).toBeNull();
  });

  it("trims and requires a name", () => {
    expect(
      targetInputSchema.parse({
        name: "  Prep surface 2 ",
        targetTypeId: TYPE_ID,
      }).name,
    ).toBe("Prep surface 2");
    expect(
      targetInputSchema.safeParse({ name: "  ", targetTypeId: TYPE_ID })
        .success,
    ).toBe(false);
  });
});

describe("targetTypeInputSchema", () => {
  it("accepts the fixed kinds only", () => {
    expect(
      targetTypeInputSchema.safeParse({ name: "Toilet", kind: "area" }).success,
    ).toBe(true);
    expect(
      targetTypeInputSchema.safeParse({ name: "Toilet", kind: "room" }).success,
    ).toBe(false);
  });
});

describe("STARTER_TARGET_TYPES", () => {
  it("uses valid kinds and unique keys", () => {
    for (const starter of STARTER_TARGET_TYPES) {
      expect(targetKindSchema.safeParse(starter.kind).success).toBe(true);
    }
    const keys = STARTER_TARGET_TYPES.map((starter) => starter.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
