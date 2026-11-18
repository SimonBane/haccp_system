import { TARGET_KIND, type TargetResponse } from "@haccp/shared";

export type AreaNode = {
  area: TargetResponse;
  equipment: TargetResponse[];
  /** Parts of the room itself (walls, floor); they never exist outside an area. */
  fixtures: TargetResponse[];
  areas: AreaNode[];
};

export type TargetTree = {
  areas: AreaNode[];
  /** Equipment placed in no area. */
  loose: TargetResponse[];
};

export type TargetScope =
  { type: "all" } | { type: "equipment" } | { type: "area"; areaId: string };

export type TargetListRow =
  | { type: "item"; target: TargetResponse; depth: number }
  | { type: "add"; area: TargetResponse; depth: number };

type TreeEntry = { target: TargetResponse; node?: AreaNode };

function byName(a: TargetResponse, b: TargetResponse): number {
  return a.name.localeCompare(b.name);
}

/** Areas own their equipment, fixtures and sub-areas; a parent that is missing or not an area leaves the item at the top. */
export function buildTargetTree(items: readonly TargetResponse[]): TargetTree {
  const areas = new Map(
    items
      .filter((item) => item.kind === TARGET_KIND.AREA)
      .map((area): [string, AreaNode] => [
        area.id,
        { area, equipment: [], fixtures: [], areas: [] },
      ]),
  );
  const roots: AreaNode[] = [];
  const loose: TargetResponse[] = [];

  for (const item of [...items].sort(byName)) {
    const parent = item.parentId ? areas.get(item.parentId) : undefined;
    if (item.kind === TARGET_KIND.AREA) {
      const node = areas.get(item.id)!;
      if (parent) parent.areas.push(node);
      else roots.push(node);
    } else if (parent && item.kind === TARGET_KIND.FIXTURE) {
      parent.fixtures.push(item);
    } else if (parent) {
      parent.equipment.push(item);
    } else {
      loose.push(item);
    }
  }

  return { areas: roots, loose };
}

function matches(item: TargetResponse, needle: string) {
  return needle === "" || item.name.toLocaleLowerCase().includes(needle);
}

/** Keeps an area when it, or anything inside it, matches; a matching area keeps all its contents. */
export function filterTargetTree(tree: TargetTree, query: string): TargetTree {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === "") return tree;

  function filterNode(node: AreaNode): AreaNode | null {
    if (matches(node.area, needle)) return node;
    const areas = node.areas.flatMap((child) => filterNode(child) ?? []);
    const equipment = node.equipment.filter((item) => matches(item, needle));
    const fixtures = node.fixtures.filter((item) => matches(item, needle));
    return areas.length > 0 || equipment.length > 0 || fixtures.length > 0
      ? { area: node.area, equipment, fixtures, areas }
      : null;
  }

  return {
    areas: tree.areas.flatMap((node) => filterNode(node) ?? []),
    loose: tree.loose.filter((item) => matches(item, needle)),
  };
}

// Equipment and areas sit side by side in name order, so standalone equipment is never pushed to the end.
function sortEntries(entries: TreeEntry[]): TreeEntry[] {
  return entries.sort((a, b) => byName(a.target, b.target));
}

function rootEntries(tree: TargetTree): TreeEntry[] {
  return sortEntries([
    ...tree.areas.map((node) => ({ target: node.area, node })),
    ...tree.loose.map((target) => ({ target })),
  ]);
}

// The room's own parts lead, so "Walls, Floor" read as the room before what stands in it.
function childEntries(node: AreaNode): TreeEntry[] {
  return [
    ...sortEntries(node.fixtures.map((target) => ({ target }))),
    ...sortEntries([
      ...node.areas.map((child) => ({ target: child.area, node: child })),
      ...node.equipment.map((target) => ({ target })),
    ]),
  ];
}

function findNode(nodes: AreaNode[], areaId: string): AreaNode | null {
  for (const node of nodes) {
    if (node.area.id === areaId) return node;
    const found = findNode(node.areas, areaId);
    if (found) return found;
  }
  return null;
}

/** The rows the list shows for a scope: a flat equipment list, or the nested tree with an add row closing each open area. */
export function buildTargetRows(
  items: readonly TargetResponse[],
  options: {
    scope: TargetScope;
    query: string;
    isOpen: (areaId: string) => boolean;
  },
): TargetListRow[] {
  const needle = options.query.trim().toLocaleLowerCase();

  if (options.scope.type === "equipment") {
    return items
      .filter(
        (item) => item.kind === TARGET_KIND.EQUIPMENT && matches(item, needle),
      )
      .sort(byName)
      .map((target) => ({ type: "item", target, depth: 0 }));
  }

  // Searching opens every area so a match is never hidden in a collapsed one.
  const searching = needle !== "";
  const tree = filterTargetTree(buildTargetTree(items), needle);
  const rows: TargetListRow[] = [];

  const walk = (entries: TreeEntry[], depth: number) => {
    for (const { target, node } of entries) {
      rows.push({ type: "item", target, depth });
      if (node && (searching || options.isOpen(target.id))) {
        walk(childEntries(node), depth + 1);
        if (!searching)
          rows.push({ type: "add", area: target, depth: depth + 1 });
      }
    }
  };

  if (options.scope.type === "all") {
    walk(rootEntries(tree), 0);
    return rows;
  }

  const node = findNode(tree.areas, options.scope.areaId);
  if (!node) return rows;
  walk(childEntries(node), 0);
  if (!searching) rows.push({ type: "add", area: node.area, depth: 0 });
  return rows;
}

/** Ids of `areaId` and every area nested inside it — an area cannot move into any of them. */
export function areaWithDescendants(
  items: readonly TargetResponse[],
  areaId: string,
): Set<string> {
  const ids = new Set([areaId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const item of items) {
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** Areas in tree order with their nesting depth, for the area pickers. */
export function flattenAreas(
  tree: TargetTree,
): { area: TargetResponse; depth: number }[] {
  const result: { area: TargetResponse; depth: number }[] = [];
  const walk = (nodes: AreaNode[], depth: number) => {
    for (const node of nodes) {
      result.push({ area: node.area, depth });
      walk(node.areas, depth + 1);
    }
  };
  walk(tree.areas, 0);
  return result;
}

/** Areas the selection can move into: never a selected area or anything nested inside one. */
export function moveDestinations(
  items: readonly TargetResponse[],
  selected: ReadonlySet<string>,
): { area: TargetResponse; depth: number }[] {
  const blocked = new Set<string>();
  for (const item of items) {
    if (item.kind === TARGET_KIND.AREA && selected.has(item.id)) {
      for (const id of areaWithDescendants(items, item.id)) blocked.add(id);
    }
  }
  return flattenAreas(buildTargetTree(items)).filter(
    ({ area }) => !blocked.has(area.id),
  );
}

/** The API refuses to delete an area that still holds items: children go first, and an area keeping anything unselected stays. */
export function planDeletion(
  items: readonly TargetResponse[],
  selected: ReadonlySet<string>,
): { waves: TargetResponse[][]; kept: TargetResponse[] } {
  const byId = new Map(items.map((item) => [item.id, item]));
  const children = new Map<string, TargetResponse[]>();
  for (const item of items) {
    if (!item.parentId) continue;
    children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
  }

  const keeps = new Map<string, boolean>();
  const keepsSomething = (id: string): boolean => {
    const known = keeps.get(id);
    if (known !== undefined) return known;
    const result = (children.get(id) ?? []).some(
      (child) => !selected.has(child.id) || keepsSomething(child.id),
    );
    keeps.set(id, result);
    return result;
  };

  const depthOf = (item: TargetResponse) => {
    let depth = 0;
    let parent = item.parentId ? byId.get(item.parentId) : undefined;
    while (parent) {
      depth += 1;
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return depth;
  };

  const chosen = items.filter((item) => selected.has(item.id));
  const kept = chosen.filter((item) => keepsSomething(item.id));
  const deletable = chosen.filter((item) => !keepsSomething(item.id));

  const byDepth = new Map<number, TargetResponse[]>();
  for (const item of deletable) {
    const depth = depthOf(item);
    byDepth.set(depth, [...(byDepth.get(depth) ?? []), item]);
  }
  const waves = [...byDepth.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, wave]) => wave);

  return { waves, kept };
}

export type AreaContents = { equipment: number; fixtures: number; areas: number };

/** What each area really holds, so a filtered view can still say "4 items inside". */
export function countAreaContents(
  items: readonly TargetResponse[],
): Map<string, AreaContents> {
  const counts = new Map<string, AreaContents>();
  for (const item of items) {
    if (!item.parentId) continue;
    const entry = counts.get(item.parentId) ?? {
      equipment: 0,
      fixtures: 0,
      areas: 0,
    };
    if (item.kind === TARGET_KIND.AREA) entry.areas += 1;
    else if (item.kind === TARGET_KIND.FIXTURE) entry.fixtures += 1;
    else entry.equipment += 1;
    counts.set(item.parentId, entry);
  }
  return counts;
}
