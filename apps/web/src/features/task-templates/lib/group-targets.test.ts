import type { TargetResponse } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { groupByRoom, STANDALONE_GROUP_KEY } from "./group-targets";

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
    taskCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

const kitchen = target("kitchen", "Kitchen", "area");
const cold = target("cold", "Cold room", "area");
const slicer = target("slicer", "Slicer", "equipment", "kitchen");
const mincer = target("mincer", "Mincer", "equipment", "kitchen");
const fridge = target("fridge", "Fish fridge", "equipment", "cold");
const probe = target("probe", "Probe", "equipment");
const all = [kitchen, cold, slicer, mincer, fridge, probe];

describe("groupByRoom", () => {
  const walls = target("k-walls", "Walls", "fixture", "kitchen");
  const floor = target("k-floor", "Floor", "fixture", "kitchen");
  const coldWalls = target("c-walls", "Walls", "fixture", "cold");
  const everything = [...all, walls, floor, coldWalls];

  function describeGroups(groups: ReturnType<typeof groupByRoom>) {
    return groups.map((group) => [group.label, group.items.map((item) => item.id)]);
  }

  it("lists each room itself, then its fixtures, then its equipment, with items in no room last", () => {
    const groups = groupByRoom(
      [slicer, probe, walls, kitchen, mincer, floor, fridge],
      everything,
      "Not in a room",
    );

    expect(describeGroups(groups)).toEqual([
      ["Cold room", ["fridge"]],
      ["Kitchen", ["kitchen", "k-floor", "k-walls", "mincer", "slicer"]],
      ["Not in a room", ["probe"]],
    ]);
    expect(groups.at(-1)!.key).toBe(STANDALONE_GROUP_KEY);
  });

  it("keeps same-named fixtures under each of their rooms", () => {
    expect(describeGroups(groupByRoom([walls, coldWalls], everything, "Not in a room"))).toEqual([
      ["Cold room", ["c-walls"]],
      ["Kitchen", ["k-walls"]],
    ]);
  });

  it("follows the room tree, a nested room after its parent", () => {
    const nested = target("cold", "Cold room", "area", "kitchen");
    const groups = groupByRoom(
      [nested, kitchen],
      [kitchen, nested],
      "Not in a room",
    );

    expect(describeGroups(groups)).toEqual([
      ["Kitchen", ["kitchen"]],
      ["Cold room", ["cold"]],
    ]);
  });
});
