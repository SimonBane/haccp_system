import { TARGET_NAME_MAX_LENGTH, type TargetResponse } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { planContentsCopy } from "./duplicate-contents";

function target(
  id: string,
  name: string,
  kind: TargetResponse["kind"],
  parentId: string | null = null,
): TargetResponse {
  return {
    id,
    locationId: "loc",
    name,
    kind,
    parentId,
    limits: {},
    taskCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

const copyName = (name: string, attempt: number) =>
  attempt === 1 ? `${name} (Copy)` : `${name} (Copy ${attempt})`;

// Kitchen ⟵ Cold room ⟵ Fridge; Kitchen ⟵ Walls; Fridge (Copy) already exists elsewhere.
const items = [
  target("kitchen", "Kitchen", "area"),
  target("cold", "Cold room", "area", "kitchen"),
  target("fridge", "Fridge", "equipment", "cold"),
  target("walls", "Walls", "component", "kitchen"),
  target("old-copy", "Fridge (Copy)", "equipment"),
  target("bar", "Bar", "area"),
];

describe("planContentsCopy", () => {
  it("names every item inside the area, components keeping theirs", () => {
    expect(
      planContentsCopy(
        items,
        "kitchen",
        { name: "Kitchen (Copy)", parentId: null },
        copyName,
      ),
    ).toEqual([
      { sourceId: "cold", name: "Cold room (Copy)" },
      { sourceId: "walls", name: "Walls" },
      { sourceId: "fridge", name: "Fridge (Copy 2)" },
    ]);
  });

  it("is empty for an area with nothing inside", () => {
    expect(
      planContentsCopy(
        items,
        "bar",
        { name: "Bar (Copy)", parentId: null },
        copyName,
      ),
    ).toEqual([]);
  });

  it("never clashes with the copy's own name", () => {
    expect(
      planContentsCopy(
        items,
        "kitchen",
        { name: "Cold room (Copy)", parentId: null },
        copyName,
      )[0],
    ).toEqual({ sourceId: "cold", name: "Cold room (Copy 2)" });
  });

  it("shortens a long name so its copy still fits", () => {
    const long = "x".repeat(TARGET_NAME_MAX_LENGTH);
    const [only] = planContentsCopy(
      [target("a", "Area", "area"), target("e", long, "equipment", "a")],
      "a",
      { name: "Area 2", parentId: null },
      copyName,
    );
    expect(only!.name).toHaveLength(TARGET_NAME_MAX_LENGTH);
    expect(only!.name.endsWith(" (Copy)")).toBe(true);
  });
});
