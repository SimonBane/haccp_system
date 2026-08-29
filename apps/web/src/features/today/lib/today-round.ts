import { TASK_TEMPLATE_TYPE } from "@haccp/shared";
import { occurrenceKey } from "./today-grouping";
import { findTimelineGroup } from "./today-timeline";
import type {
  TodayTaskGroup,
  TodayTimeline,
  TodayTimelineItem,
} from "./today-timeline";

export function isChainableTemperatureItem(item: TodayTimelineItem): boolean {
  return (
    item.task.type === TASK_TEMPLATE_TYPE.TEMPERATURE &&
    !item.isCompleted &&
    item.task.status !== "upcoming" &&
    item.task.minTempC !== null &&
    item.task.maxTempC !== null &&
    Boolean(item.task.equipmentId)
  );
}

export function chainableTemperatureItems(
  group: TodayTaskGroup,
): TodayTimelineItem[] {
  return group.items.filter(isChainableTemperatureItem);
}

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
