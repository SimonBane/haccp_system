import { isQuickCompleteForm } from "@/features/forms/lib/answer-draft";
import { occurrenceKey } from "./today-grouping";
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

export function chainableItems(group: TodayTaskGroup): TodayTimelineItem[] {
  return group.items.filter(isChainableItem);
}

/** The rest of the tapped item's time slot, so one walk past the fridges records them all. */
export function buildRoundKeys(
  timeline: TodayTimeline,
  tapped: TodayTimelineItem,
): string[] {
  const tappedKey = occurrenceKey(tapped.task);
  const group = findTimelineGroup(timeline, tappedKey);
  if (!group) return [tappedKey];

  const pending = chainableItems(group).map((item) => occurrenceKey(item.task));

  const start = pending.indexOf(tappedKey);
  if (start === -1) return [tappedKey];

  return pending.slice(start);
}
