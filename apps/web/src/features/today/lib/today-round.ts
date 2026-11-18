import { isQuickCompleteForm } from "@/features/forms/lib/answer-draft";
import { occurrenceKey } from "./today-grouping";
import { buildTimeGroupEntries, entryItems } from "./today-rooms";
import { findTimelineGroup } from "./today-timeline";
import type {
  TodayTaskGroup,
  TodayTimeline,
  TodayTimelineItem,
} from "./today-timeline";

/** Anything but a lone required tick needs its answers entered. */
export function needsRecordFlow(item: TodayTimelineItem): boolean {
  return item.form !== null && !isQuickCompleteForm(item.form.definition);
}

export function isChainableItem(item: TodayTimelineItem): boolean {
  return (
    needsRecordFlow(item) &&
    !item.isCompleted &&
    item.task.status !== "upcoming"
  );
}

/** The slot's open checks in display order, room cards included. */
export function chainableItems(group: TodayTaskGroup): TodayTimelineItem[] {
  return entryItems(buildTimeGroupEntries(group.items)).filter(isChainableItem);
}

/** "slot" walks the whole time slot; "item" walks the rest of the tapped check's room card, or of the slot. */
export type RoundScope = "slot" | "item";

export function buildRoundKeys(
  timeline: TodayTimeline,
  tapped: TodayTimelineItem,
  scope: RoundScope = "item",
): string[] {
  const tappedKey = occurrenceKey(tapped.task);
  const group = findTimelineGroup(timeline, tappedKey);
  if (!group) return [tappedKey];

  const entries = buildTimeGroupEntries(group.items);
  const room =
    scope === "item"
      ? entries.find(
          (entry) =>
            entry.type === "room" &&
            entry.items.some((item) => occurrenceKey(item.task) === tappedKey),
        )
      : undefined;
  const walk = room?.type === "room" ? room.items : entryItems(entries);
  const pending = walk
    .filter(isChainableItem)
    .map((item) => occurrenceKey(item.task));

  const start = pending.indexOf(tappedKey);
  if (start === -1) return [tappedKey];

  return pending.slice(start);
}
