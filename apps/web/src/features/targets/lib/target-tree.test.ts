import type { TargetResponse } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  areaWithDescendants,
  buildTargetRows,
  buildTargetTree,
  countAreaContents,
  filterTargetTree,
  flattenAreas,
  moveDestinations,
  planDeletion,
  type TargetListRow,
} from "./target-tree";

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

const items = [
  target("kitchen", "Kitchen", "area"),
  target("cold", "Cold room", "area", "kitchen"),
  target("mincer", "Mincer", "equipment", "kitchen"),
  target("fridge", "Fish fridge", "equipment", "cold"),
  target("probe", "Probe thermometer", "equipment"),
  target("corridor", "Corridor", "area"),
];

describe("buildTargetTree", () => {
  it("nests equipment and sub-areas under their area, sorted by name", () => {
    const tree = buildTargetTree(items);

    expect(tree.areas.map((node) => node.area.id)).toEqual([
      "corridor",
      "kitchen",
    ]);
    const kitchen = tree.areas[1]!;
    expect(kitchen.equipment.map((item) => item.id)).toEqual(["mincer"]);
    expect(kitchen.areas[0]!.equipment.map((item) => item.id)).toEqual([
      "fridge",
    ]);
    expect(tree.loose.map((item) => item.id)).toEqual(["probe"]);
  });

  it("keeps an item whose parent is gone at the top", () => {
    const tree = buildTargetTree([
      target("orphan", "Orphan", "equipment", "missing"),
    ]);

    expect(tree.loose.map((item) => item.id)).toEqual(["orphan"]);
  });
});

describe("components", () => {
  const withComponents = [
    target("kitchen", "Kitchen", "area"),
    target("mincer", "Mincer", "equipment", "kitchen"),
    target("walls", "Walls", "component", "kitchen"),
    target("ceiling", "Ceiling", "component", "kitchen"),
    target("bar", "Bar", "area"),
    target("bar-walls", "Walls", "component", "bar"),
  ];

  it("keeps components with their own area, apart from its equipment", () => {
    const kitchen = buildTargetTree(withComponents).areas.find(
      (node) => node.area.id === "kitchen",
    )!;

    expect(kitchen.components.map((item) => item.id)).toEqual(["ceiling", "walls"]);
    expect(kitchen.equipment.map((item) => item.id)).toEqual(["mincer"]);
  });

  it("lists an area's components before what stands in it", () => {
    const rows = buildTargetRows(withComponents, {
      scope: "rooms",
      query: "",
      isOpen: (areaId) => areaId === "kitchen",
    });

    expect(describeRows(rows)).toEqual([
      "bar:0",
      "kitchen:0",
      "ceiling:1",
      "walls:1",
      "mincer:1",
    ]);
  });

  it("finds a component by name in every area that has one", () => {
    const result = filterTargetTree(buildTargetTree(withComponents), "walls");

    expect(
      result.areas.map((node) => node.components.map((item) => item.id)),
    ).toEqual([["bar-walls"], ["walls"]]);
  });

  it("counts components apart from equipment", () => {
    expect(countAreaContents(withComponents).get("kitchen")).toEqual({
      equipment: 1,
      components: 2,
      areas: 0,
    });
  });
});

describe("filterTargetTree", () => {
  const tree = buildTargetTree(items);

  it("keeps the areas around matching equipment", () => {
    const result = filterTargetTree(tree, "fish");

    expect(result.areas.map((node) => node.area.id)).toEqual(["kitchen"]);
    expect(result.areas[0]!.equipment).toEqual([]);
    expect(result.areas[0]!.areas[0]!.equipment.map((i) => i.id)).toEqual([
      "fridge",
    ]);
    expect(result.loose).toEqual([]);
  });

  it("shows a matching area with all its contents", () => {
    const result = filterTargetTree(tree, "kitch");

    expect(result.areas[0]!.equipment.map((item) => item.id)).toEqual([
      "mincer",
    ]);
  });

  it("returns the tree untouched without a query", () => {
    expect(filterTargetTree(tree, "  ")).toBe(tree);
  });
});

function describeRows(rows: TargetListRow[]) {
  return rows.map((row) =>
    row.type === "item"
      ? `${row.target.id}:${row.depth}`
      : `standalone(${row.count})`,
  );
}

describe("buildTargetRows", () => {
  const allOpen = () => true;

  it("groups by room, then lists standalone equipment", () => {
    const rows = buildTargetRows(items, {
      scope: "all",
      query: "",
      isOpen: allOpen,
    });

    expect(describeRows(rows)).toEqual([
      "corridor:0",
      "kitchen:0",
      "cold:1",
      "fridge:2",
      "mincer:1",
      "standalone(1)",
      "probe:0",
    ]);
  });

  it("leaves standalone equipment out of the rooms view", () => {
    const rows = buildTargetRows(items, {
      scope: "rooms",
      query: "",
      isOpen: () => false,
    });

    expect(describeRows(rows)).toEqual(["corridor:0", "kitchen:0"]);
  });

  it("opens every matching branch while searching", () => {
    const rows = buildTargetRows(items, {
      scope: "all",
      query: "fish",
      isOpen: () => false,
    });

    expect(describeRows(rows)).toEqual(["kitchen:0", "cold:1", "fridge:2"]);
  });

  it("lists all equipment flat, wherever it stands", () => {
    const rows = buildTargetRows(items, {
      scope: "equipment",
      query: "",
      isOpen: allOpen,
    });

    expect(describeRows(rows)).toEqual(["fridge:0", "mincer:0", "probe:0"]);
  });
});

describe("moveDestinations", () => {
  it("never offers a selected area or anything nested inside it", () => {
    expect(
      moveDestinations(items, new Set(["kitchen"])).map(({ area }) => area.id),
    ).toEqual(["corridor"]);
  });

  it("offers every area for selected equipment", () => {
    expect(
      moveDestinations(items, new Set(["probe"])).map(({ area }) => area.id),
    ).toEqual(["corridor", "kitchen", "cold"]);
  });
});

describe("planDeletion", () => {
  const ids = (list: TargetResponse[]) => list.map((item) => item.id);

  it("deletes children before the areas that hold them", () => {
    const plan = planDeletion(
      items,
      new Set(["kitchen", "cold", "fridge", "mincer"]),
    );

    expect(plan.waves.map(ids)).toEqual([
      ["fridge"],
      ["cold", "mincer"],
      ["kitchen"],
    ]);
    expect(plan.kept).toEqual([]);
  });

  it("keeps an area that would still hold something unselected", () => {
    const plan = planDeletion(items, new Set(["kitchen", "mincer"]));

    expect(ids(plan.kept)).toEqual(["kitchen"]);
    expect(plan.waves.map(ids)).toEqual([["mincer"]]);
  });
});

describe("areaWithDescendants", () => {
  it("collects the area and everything nested inside it", () => {
    expect([...areaWithDescendants(items, "kitchen")].sort()).toEqual([
      "cold",
      "fridge",
      "kitchen",
      "mincer",
    ]);
  });
});

describe("flattenAreas", () => {
  it("lists areas in tree order with their depth", () => {
    expect(
      flattenAreas(buildTargetTree(items)).map(
        ({ area, depth }) => `${area.id}:${depth}`,
      ),
    ).toEqual(["corridor:0", "kitchen:0", "cold:1"]);
  });
});

describe("countAreaContents", () => {
  it("counts each area's direct equipment and sub-areas", () => {
    const counts = countAreaContents(items);

    expect(counts.get("kitchen")).toEqual({ equipment: 1, components: 0, areas: 1 });
    expect(counts.get("cold")).toEqual({ equipment: 1, components: 0, areas: 0 });
    expect(counts.has("corridor")).toBe(false);
  });
});
