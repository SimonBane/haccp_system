import { TARGET_KIND, type TargetKind, type TargetResponse } from "@haccp/shared";
import { buildTargetTree, flattenAreas } from "@/features/targets/lib/target-tree";

export type TargetGroup = { key: string; label: string; items: TargetResponse[] };

export const STANDALONE_GROUP_KEY = "standalone";

const KIND_ORDER: Record<TargetKind, number> = {
  [TARGET_KIND.AREA]: 0,
  [TARGET_KIND.COMPONENT]: 1,
  [TARGET_KIND.EQUIPMENT]: 2,
};

function byKindThenName(a: TargetResponse, b: TargetResponse): number {
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name);
}

/** One group per room in tree order — the room itself, its components, then its equipment — with items in no room last. */
export function groupByRoom(
  targets: readonly TargetResponse[],
  allTargets: readonly TargetResponse[],
  standaloneLabel: string,
): TargetGroup[] {
  const rooms = flattenAreas(buildTargetTree(allTargets)).map(({ area }) => area);
  const byRoom = new Map(rooms.map((room): [string, TargetResponse[]] => [room.id, []]));
  const standalone: TargetResponse[] = [];
  for (const target of targets) {
    const roomId = target.kind === TARGET_KIND.AREA ? target.id : target.parentId;
    const list = roomId ? byRoom.get(roomId) : undefined;
    if (list) list.push(target);
    else standalone.push(target);
  }

  const groups = rooms.flatMap((room) => {
    const items = byRoom.get(room.id)!;
    return items.length > 0
      ? [{ key: room.id, label: room.name, items: items.sort(byKindThenName) }]
      : [];
  });
  return standalone.length > 0
    ? [
        ...groups,
        {
          key: STANDALONE_GROUP_KEY,
          label: standaloneLabel,
          items: standalone.sort(byKindThenName),
        },
      ]
    : groups;
}
