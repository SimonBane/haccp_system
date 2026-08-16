import { occurrenceKey } from "./today-grouping";
import { findTimelineGroup } from "./today-timeline";
import type {
  TodayTaskGroup,
  TodayTimeline,
  TodayTimelineItem,
} from "./today-timeline";

/** Needs a range and equipment; a tap on a template missing either is an error toast, not an empty dialog. */
export function isChainableTemperatureItem(item: TodayTimelineItem): boolean {
  return (
    item.task.type === "temperature" &&
    !item.isCompleted &&
    item.task.minTempC !== null &&
    item.task.maxTempC !== null &&
    Boolean(item.task.equipmentId)
  );
}

/** Uses the clock-independent group: a round is decided by its checks, not the clock. */
export function chainableTemperatureItems(
  group: TodayTaskGroup,
): TodayTimelineItem[] {
  return group.items.filter(isChainableTemperatureItem);
}

/** Queue from the tapped check to the end of its group — does not wrap. */
export function buildTemperatureRoundKeys(
  timeline: TodayTimeline,
  tapped: TodayTimelineItem,
): string[] {
  const tappedKey = occurrenceKey(tapped.task);
  const group = findTimelineGroup(timeline, tappedKey);
  if (!group) return [tappedKey];

  const pending = chainableTemperatureItems(group).map((item) =>
    occurrenceKey(item.task),
  );

  const start = pending.indexOf(tappedKey);
  if (start === -1) return [tappedKey];

  return pending.slice(start);
}
