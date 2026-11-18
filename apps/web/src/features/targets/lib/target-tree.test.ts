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

describe("fixtures", () => {
  const withFixtures = [
    target("kitchen", "Kitchen", "area"),
    target("mincer", "Mincer", "equipment", "kitchen"),
    target("walls", "Walls", "fixture", "kitchen"),
    target("ceiling", "Ceiling", "fixture", "kitchen"),
    target("bar", "Bar", "area"),
    target("bar-walls", "Walls", "fixture", "bar"),
  ];

  it("keeps fixtures with their own area, apart from its equipment", () => {
    const kitchen = buildTargetTree(withFixtures).areas.find(
      (node) => node.area.id === "kitchen",
    )!;

    expect(kitchen.fixtures.map((item) => item.id)).toEqual(["ceiling", "walls"]);
    expect(kitchen.equipment.map((item) => item.id)).toEqual(["mincer"]);
  });

  it("lists an area's fixtures before what stands in it", () => {
    const rows = buildTargetRows(withFixtures, {
      scope: { type: "area", areaId: "kitchen" },
      query: "",
      isOpen: () => true,
    });

    expect(describeRows(rows)).toEqual([
      "ceiling:0",
      "walls:0",
      "mincer:0",
      "+kitchen:0",
    ]);
  });

  it("finds a fixture by name in every area that has one", () => {
    const result = filterTargetTree(buildTargetTree(withFixtures), "walls");

    expect(
      result.areas.map((node) => node.fixtures.map((item) => item.id)),
    ).toEqual([["bar-walls"], ["walls"]]);
  });

  it("counts fixtures apart from equipment", () => {
    expect(countAreaContents(withFixtures).get("kitchen")).toEqual({
      equipment: 1,
      fixtures: 2,
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
      : `+${row.area.id}:${row.depth}`,
  );
}

describe("buildTargetRows", () => {
  const allOpen = () => true;

  it("nests everything and closes each open area with an add row", () => {
    const rows = buildTargetRows(items, {
      scope: { type: "all" },
      query: "",
      isOpen: allOpen,
    });

    expect(describeRows(rows)).toEqual([
      "corridor:0",
      "+corridor:1",
      "kitchen:0",
      "cold:1",
      "fridge:2",
      "+cold:2",
      "mincer:1",
      "+kitchen:1",
      "probe:0",
    ]);
  });

  it("puts standalone equipment among areas in name order, not after them", () => {
    const rows = buildTargetRows(
      [...items, target("chiller", "Blast chiller", "equipment")],
      { scope: { type: "all" }, query: "", isOpen: () => false },
    );

    expect(describeRows(rows)).toEqual([
      "chiller:0",
      "corridor:0",
      "kitchen:0",
      "probe:0",
    ]);
  });

  it("opens every matching branch while searching and drops add rows", () => {
    const rows = buildTargetRows(items, {
      scope: { type: "all" },
      query: "fish",
      isOpen: () => false,
    });

    expect(describeRows(rows)).toEqual(["kitchen:0", "cold:1", "fridge:2"]);
  });

  it("lists all equipment flat, wherever it stands", () => {
    const rows = buildTargetRows(items, {
      scope: { type: "equipment" },
      query: "",
      isOpen: allOpen,
    });

    expect(describeRows(rows)).toEqual(["fridge:0", "mincer:0", "probe:0"]);
  });

  it("shows an area's contents from the top, ending with its add row", () => {
    const rows = buildTargetRows(items, {
      scope: { type: "area", areaId: "kitchen" },
      query: "",
      isOpen: allOpen,
    });

    expect(describeRows(rows)).toEqual([
      "cold:0",
      "fridge:1",
      "+cold:1",
      "mincer:0",
      "+kitchen:0",
    ]);
  });

  it("shows nothing for an area that is gone", () => {
    expect(
      buildTargetRows(items, {
        scope: { type: "area", areaId: "missing" },
        query: "",
        isOpen: allOpen,
      }),
    ).toEqual([]);
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

    expect(counts.get("kitchen")).toEqual({ equipment: 1, fixtures: 0, areas: 1 });
    expect(counts.get("cold")).toEqual({ equipment: 1, fixtures: 0, areas: 0 });
    expect(counts.has("corridor")).toBe(false);
  });
});
