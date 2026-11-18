import { TARGET_KIND, type TargetKind, type TodayTaskItem } from "@haccp/shared";
import type { TodayTimelineItem } from "./today-timeline";

export type TodayRoomEntry = {
  type: "room";
  id: string;
  name: string;
  items: TodayTimelineItem[];
};

export type TimeGroupEntry =
  | { type: "item"; item: TodayTimelineItem }
  | TodayRoomEntry;

const KIND_ORDER: Record<TargetKind, number> = {
  [TARGET_KIND.AREA]: 0,
  [TARGET_KIND.FIXTURE]: 1,
  [TARGET_KIND.EQUIPMENT]: 2,
};

/** "Walls" inside the Kitchen 2 card, where "Kitchen 2 › Walls" would repeat its heading. */
export function labelInRoom(task: TodayTaskItem): string | null {
  if (!task.area || !task.targetName) return task.targetName;
  const prefix = `${task.area.name} › `;
  return task.targetName.startsWith(prefix)
    ? task.targetName.slice(prefix.length)
    : task.targetName;
}

function inRoomOrder(a: TodayTimelineItem, b: TodayTimelineItem): number {
  const kindA = a.task.targetKind ? KIND_ORDER[a.task.targetKind] : 0;
  const kindB = b.task.targetKind ? KIND_ORDER[b.task.targetKind] : 0;
  return (
    kindA - kindB ||
    (labelInRoom(a.task) ?? "").localeCompare(labelInRoom(b.task) ?? "") ||
    a.task.title.localeCompare(b.task.title)
  );
}

/** A room with two or more checks in the slot becomes one card where its first check stood; the rest stay rows. */
export function buildTimeGroupEntries(
  items: readonly TodayTimelineItem[],
): TimeGroupEntry[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const id = item.task.area?.id;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const rooms = new Map<string, TodayRoomEntry>();
  const entries: TimeGroupEntry[] = [];
  for (const item of items) {
    const area = item.task.area;
    if (!area || (counts.get(area.id) ?? 0) < 2) {
      entries.push({ type: "item", item });
      continue;
    }
    let room = rooms.get(area.id);
    if (!room) {
      room = { type: "room", id: area.id, name: area.name, items: [] };
      rooms.set(area.id, room);
      entries.push(room);
    }
    room.items.push(item);
  }

  for (const room of rooms.values()) room.items.sort(inRoomOrder);
  return entries;
}

/** The slot's checks in the order the entries show them. */
export function entryItems(
  entries: readonly TimeGroupEntry[],
): TodayTimelineItem[] {
  return entries.flatMap((entry) =>
    entry.type === "room" ? entry.items : [entry.item],
  );
}
